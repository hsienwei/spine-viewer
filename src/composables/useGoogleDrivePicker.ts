import { ref } from 'vue'
import { createGoogleOAuthState, isValidGoogleOAuthState } from '../lib/googleOAuthState'

const CLIENT_ID = '749366685781-0cah3e4qgffj8e0hb8v4h65f6n5c0r2n.apps.googleusercontent.com'
const API_KEY = 'AIzaSyD6uVUdGZwUw_Ttt8k7dmBAX8anL97aps0'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const SUPPORTED_EXTENSIONS = new Set(['json', 'atlas', 'png'])
// Module-level singletons shared across component instances
let gapiReady = false
let tokenClient: any = null
let accessToken = ''
let resolveFiles: ((files: File[]) => void) | null = null
let rejectFiles: ((error: Error) => void) | null = null
let pendingOAuthState = ''

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const el = document.createElement('script')
    el.src = src
    el.onload = () => resolve()
    el.onerror = reject
    document.head.appendChild(el)
  })

const isSupportedSpineFileName = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return SUPPORTED_EXTENSIONS.has(ext)
}

export function useGoogleDrivePicker() {
  const isLoading = ref(false)
  const isAuthed = ref(!!accessToken)
  const error = ref('')

  const makeDocsView = (ownedByMe: boolean) => {
    const g = (window as any).google
    const view = new g.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMode(g.picker.DocsViewMode.LIST)
    if (!ownedByMe) view.setOwnedByMe(false)
    return view
  }

  const clearPendingPicker = () => {
    resolveFiles = null
    rejectFiles = null
  }

  const driveFetch = async (url: string) => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 401) {
      accessToken = ''
      isAuthed.value = false
      throw new Error('Google Drive authorization expired. Please open Drive again.')
    }
    return res
  }

  const downloadDriveFile = async (id: string, name: string) => {
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
    if (!res.ok) {
      throw new Error(`Failed to download ${name}: ${res.status}`)
    }

    const blob = await res.blob()
    return new File([blob], name)
  }

  const listFolderItems = async (folderId: string) => {
    const items: Array<{ id: string; name: string; mimeType: string }> = []
    let pageToken = ''

    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken,files(id,name,mimeType)',
        orderBy: 'folder,name',
        pageSize: '1000',
        includeItemsFromAllDrives: 'true',
        supportsAllDrives: 'true',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Failed to list Google Drive folder: ${res.status}`)
      }

      const data = await res.json()
      items.push(...(data.files || []))
      pageToken = data.nextPageToken || ''
    } while (pageToken)

    return items
  }

  const downloadFolderFiles = async (folderId: string): Promise<File[]> => {
    const folderFiles: File[] = []
    const items = await listFolderItems(folderId)

    for (const item of items) {
      if (item.mimeType === FOLDER_MIME_TYPE) {
        folderFiles.push(...await downloadFolderFiles(item.id))
        continue
      }

      if (!item.mimeType.startsWith('application/vnd.google-apps.') && isSupportedSpineFileName(item.name)) {
        folderFiles.push(await downloadDriveFile(item.id, item.name))
      }
    }

    return folderFiles
  }

  const showPicker = () => {
    const g = (window as any).google
    const builder = new g.picker.PickerBuilder()
      .setDeveloperKey(API_KEY)
      .setOAuthToken(accessToken)
      .setLocale('zh-TW')

    builder
      .addView(makeDocsView(true))
      .addView(makeDocsView(false))
      .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .enableFeature(g.picker.Feature.SUPPORT_DRIVES)
      .setCallback(async (data: any) => {
        if (data.action === g.picker.Action.CANCEL) {
          resolveFiles?.([])
          clearPendingPicker()
          return
        }
        if (data.action !== g.picker.Action.PICKED) return

        isLoading.value = true
        error.value = ''
        const files: File[] = []
        try {
          for (const doc of data.docs) {
            if (doc.mimeType === FOLDER_MIME_TYPE) {
              files.push(...await downloadFolderFiles(doc.id))
              continue
            }

            if (doc.mimeType?.startsWith('application/vnd.google-apps.')) {
              throw new Error(`${doc.name} is a Google Workspace file and cannot be loaded as a Spine asset`)
            }

            if (isSupportedSpineFileName(doc.name)) {
              files.push(await downloadDriveFile(doc.id, doc.name))
            }
          }
          resolveFiles?.(files)
          clearPendingPicker()
        } catch (e) {
          const pickerError = e instanceof Error ? e : new Error('Failed to load files from Google Drive')
          error.value = pickerError.message
          rejectFiles?.(pickerError)
          clearPendingPicker()
        } finally {
          isLoading.value = false
        }
      })

    builder
      .build()
      .setVisible(true)
  }

  const ensureReady = async () => {
    if (gapiReady) return
    error.value = ''
    await Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client'),
    ])
    await new Promise<void>(r => (window as any).gapi.load('picker', r))
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (res: any) => {
        if (!isValidGoogleOAuthState(pendingOAuthState, res.state)) {
          const authError = new Error('Google OAuth state validation failed')
          pendingOAuthState = ''
          error.value = authError.message
          rejectFiles?.(authError)
          clearPendingPicker()
          return
        }
        pendingOAuthState = ''
        if (res.error) {
          const authError = new Error(res.error_description || res.error)
          error.value = authError.message
          rejectFiles?.(authError)
          clearPendingPicker()
          return
        }
        if (res.access_token) {
          accessToken = res.access_token
          isAuthed.value = true
          showPicker()
        }
      },
    })
    gapiReady = true
  }

  const openDrivePicker = async (): Promise<File[]> => {
    await ensureReady()
    return new Promise((resolve, reject) => {
      resolveFiles = resolve
      rejectFiles = reject
      if (accessToken) {
        showPicker()
      } else {
        pendingOAuthState = createGoogleOAuthState()
        tokenClient.requestAccessToken({ prompt: 'consent', state: pendingOAuthState })
      }
    })
  }

  return { openDrivePicker, isLoading, isAuthed, error }
}
