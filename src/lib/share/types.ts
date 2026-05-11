import type { SpineSourceFiles } from '../spine/versionDetection'

export interface ShareManifestTexture {
  logicalName: string
  storedName: string
  mimeType: string
  width: number
  height: number
}

export interface ShareUploadOptions {
  watermarkEnabled: boolean
  clipAnimationName: string | null
  defaultAnimationName: string | null
  defaultSkinName: string | null
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
    enabled: boolean
    mode: 'none' | 'tiled-diagonal' | 'tiled-horizontal' | 'soft-diagonal' | 'soft-text'
    label: string | null
  }
  defaults?: {
    animationName: string | null
    skinName: string | null
  }
  content?: {
    clipAnimationName: string | null
  }
}

export interface PreparedShareUpload {
  sourceFiles: SpineSourceFiles
  manifest: ShareManifest
  processedTextures: File[]
}
