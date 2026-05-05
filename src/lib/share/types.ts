import type { SpineSourceFiles } from '../spine/versionDetection'

export interface ShareManifestTexture {
  logicalName: string
  storedName: string
  mimeType: string
  width: number
  height: number
}

export interface ShareManifest {
  shareId: string
  createdAt: string
  expiresAt: string
  files: {
    skeleton: {
      name: string
      mimeType: string
    }
    atlas: {
      name: string
      mimeType: string
    }
    textures: ShareManifestTexture[]
  }
  watermark: {
    mode: 'tiled-diagonal'
    label: string
  }
}

export interface PreparedShareUpload {
  sourceFiles: SpineSourceFiles
  manifest: ShareManifest
  processedTextures: File[]
}
