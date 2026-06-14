import { ref } from 'vue'
import { createGoogleOAuthState, isValidGoogleOAuthState } from '../lib/googleOAuthState'

const CLIENT_ID = '749366685781-jtf30dimpd6i2rto68q2tc9gafabkd94.apps.googleusercontent.com'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

let gapiReady = false
let tokenClient: any = null
let accessToken = ''
let onToken: (() => void) | null = null
let onTokenError: ((error: Error) => void) | null = null
let pendingOAuthState = ''

export interface DriveItem {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const el = document.createElement('script')
    el.src = src
    el.onload = () => resolve()
    el.onerror = reject
    document.head.appendChild(el)
  })

const ensureReady = async () => {
  if (gapiReady) return
  await loadScript('https://accounts.google.com/gsi/client')
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (res: any) => {
      if (!isValidGoogleOAuthState(pendingOAuthState, res.state)) {
        const error = new Error('Google OAuth state validation failed')
        pendingOAuthState = ''
        onTokenError?.(error)
        onToken = null
        onTokenError = null
        return
      }
      pendingOAuthState = ''
      if (res.error) {
        const error = new Error(res.error_description || res.error)
        onTokenError?.(error)
        onToken = null
        onTokenError = null
        return
      }
      if (res.access_token) {
        accessToken = res.access_token
        onToken?.()
        onToken = null
        onTokenError = null
      }
    },
  })
  gapiReady = true
}

async function driveGet(path: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Drive API ${res.status}`)
  return res.json()
}

function mapItems(files: any[]): DriveItem[] {
  return files.map(f => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }))
}

export function useGoogleDrive() {
  const isAuthed = ref(!!accessToken)

  const signIn = async (): Promise<void> => {
    await ensureReady()
    if (accessToken) return
    return new Promise((resolve, reject) => {
      onToken = () => { isAuthed.value = true; resolve() }
      onTokenError = reject
      pendingOAuthState = createGoogleOAuthState()
      tokenClient.requestAccessToken({ prompt: '', state: pendingOAuthState })
    })
  }

  const listFolder = async (folderId: string): Promise<DriveItem[]> => {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
    const data = await driveGet(`files?q=${q}&fields=files(id,name,mimeType)&orderBy=folder,name&pageSize=1000`)
    return mapItems(data.files || [])
  }

  const listSharedWithMe = async (): Promise<DriveItem[]> => {
    const q = encodeURIComponent(`sharedWithMe=true and trashed=false`)
    const data = await driveGet(`files?q=${q}&fields=files(id,name,mimeType)&orderBy=folder,name&pageSize=1000`)
    return mapItems(data.files || [])
  }

  const downloadFile = async (id: string, name: string): Promise<File> => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const blob = await res.blob()
    return new File([blob], name)
  }

  return { isAuthed, signIn, listFolder, listSharedWithMe, downloadFile }
}
