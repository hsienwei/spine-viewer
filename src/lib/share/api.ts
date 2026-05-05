import type { SpineSourceFiles } from '../spine/versionDetection'
import type { PreparedShareUpload, ShareManifest } from './types'

export interface ShareUploadResult {
  shareUrl: string
  token: string
  expiresAt: string
}

const parseResponse = async <T>(response: Response): Promise<T> => { 
  if (response.ok) { 
    return response.json() as Promise<T> 
  } 

  let message = `Request failed: ${response.status}` 
  try { 
    const payload = await response.json() as { error?: string } 
    if (payload.error) { 
      message = payload.error 
    } 
  } catch { 
    // Ignore JSON parse failures and keep fallback message. 
  } 
  throw new Error(message) 
} 

export const normalizeShareErrorMessage = (message: string) => {
  const normalized = message.toLowerCase()

  if (normalized.includes('expired')) {
    return 'This share link expired. Ask the sender for a new link.'
  }
  if (normalized.includes('revoked')) {
    return 'This share link was revoked by the sender.'
  }
  if (normalized.includes('not found')) {
    return 'This share link is unavailable or was deleted.'
  }
  if (normalized.includes('asset not found')) {
    return 'The share exists, but one or more assets are missing.'
  }
  if (normalized.includes('failed to download shared asset')) {
    return 'A shared asset could not be downloaded.'
  }

  return message
}

export const createShareLink = async (payload: PreparedShareUpload): Promise<ShareUploadResult> => {
  const formData = new FormData()
  formData.set('skeleton', payload.sourceFiles.skeletonFile)
  formData.set('atlas', payload.sourceFiles.atlasFile)
  formData.set('manifest', JSON.stringify(payload.manifest))

  payload.processedTextures.forEach(file => {
    formData.set(`texture:${file.name}`, file)
  })

  const response = await fetch('/api/share/upload', {
    method: 'POST',
    body: formData
  })

  return parseResponse<ShareUploadResult>(response)
}

export const extractShareTokenFromPath = (pathname: string) => {
  const match = pathname.match(/^\/s\/([^/]+)$/)
  return match?.[1] || null
}

export const fetchShareManifest = async (token: string) => {
  const response = await fetch(`/api/share/${token}/manifest`, {
    cache: 'no-store'
  })

  return parseResponse<ShareManifest>(response)
}

export const revokeShareLink = async (token: string) => {
  const response = await fetch(`/api/share/${token}/revoke`, {
    method: 'POST',
    cache: 'no-store'
  })

  return parseResponse<{ revoked: boolean; revokedAt: string }>(response)
}

export const fetchSharedSourceFiles = async (
  token: string,
  manifest: ShareManifest
): Promise<SpineSourceFiles> => {
  const fetchAsFile = async (name: string, type: string) => {
    const response = await fetch(`/api/share/${token}/object/${encodeURIComponent(name)}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`Failed to download shared asset: ${name}`)
    }

    const blob = await response.blob()
    return new File([blob], name, { type })
  }

  const [skeletonFile, atlasFile, ...textureFiles] = await Promise.all([
    fetchAsFile(manifest.files.skeleton.name, manifest.files.skeleton.mimeType),
    fetchAsFile(manifest.files.atlas.name, manifest.files.atlas.mimeType),
    ...manifest.files.textures.map(texture => fetchAsFile(texture.logicalName, texture.mimeType))
  ])

  return {
    skeletonFile,
    atlasFile,
    textureFiles
  }
}
