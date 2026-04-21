import { ref } from 'vue'

const CLIENT_ID = '749366685781-0cah3e4qgffj8e0hb8v4h65f6n5c0r2n.apps.googleusercontent.com'
const API_KEY = 'AIzaSyD6uVUdGZwUw_Ttt8k7dmBAX8anL97aps0'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
// Module-level singletons shared across component instances
let gapiReady = false
let tokenClient: any = null
let accessToken = ''
let resolveFiles: ((files: File[]) => void) | null = null

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const el = document.createElement('script')
    el.src = src
    el.onload = () => resolve()
    el.onerror = reject
    document.head.appendChild(el)
  })

export function useGoogleDrivePicker() {
  const isLoading = ref(false)
  const isAuthed = ref(!!accessToken)

  const makeDocsView = (ownedByMe: boolean) => {
    const g = (window as any).google
    const view = new g.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
    if (!ownedByMe) view.setOwnedByMe(false)
    return view
  }

  const showPicker = () => {
    const g = (window as any).google
    new g.picker.PickerBuilder()
      .setDeveloperKey(API_KEY)
      .setOAuthToken(accessToken)
      .addView(makeDocsView(true))
      .addView(makeDocsView(false))
      .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .enableFeature(g.picker.Feature.SUPPORT_DRIVES)
      .setCallback(async (data: any) => {
        if (data.action === g.picker.Action.CANCEL) {
          resolveFiles?.([])
          resolveFiles = null
          return
        }
        if (data.action !== g.picker.Action.PICKED) return

        isLoading.value = true
        const files: File[] = []
        for (const doc of data.docs) {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (res.status === 401) {
            accessToken = ''
            isAuthed.value = false
          }
          const blob = await res.blob()
          files.push(new File([blob], doc.name))
        }
        isLoading.value = false
        resolveFiles?.(files)
        resolveFiles = null
      })
      .build()
      .setVisible(true)
  }

  const ensureReady = async () => {
    if (gapiReady) return
    await Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client'),
    ])
    await new Promise<void>(r => (window as any).gapi.load('picker', r))
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (res: any) => {
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
    return new Promise(resolve => {
      resolveFiles = resolve
      if (accessToken) {
        showPicker()
      } else {
        tokenClient.requestAccessToken({ prompt: '' })
      }
    })
  }

  return { openDrivePicker, isLoading, isAuthed }
}
