import type { SpineSourceFiles } from '../spine/versionDetection'
import type { PreparedShareUpload, ShareManifest, ShareManifestTexture } from './types'

const readImageBitmap = async (file: File) => {
  const bitmap = await createImageBitmap(file)
  return bitmap
}

const buildWatermarkLabel = () => {
  const token = crypto.randomUUID().slice(0, 8).toUpperCase()
  return `SHARE ${token}`
}

const drawTiledWatermark = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  label: string,
  expiresAtLabel: string
) => {
  context.save()
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(-Math.PI / 4)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(255, 255, 255, 0.08)'
  context.font = `700 ${Math.max(18, Math.round(canvas.width / 24))}px sans-serif`

  const phrase = `${label}  VIEW ONLY  ${expiresAtLabel}`
  const stepX = Math.max(260, Math.round(canvas.width * 0.3))
  const stepY = Math.max(180, Math.round(canvas.height * 0.2))

  for (let y = -canvas.height; y <= canvas.height; y += stepY) {
    for (let x = -canvas.width; x <= canvas.width; x += stepX) {
      context.fillText(phrase, x, y)
    }
  }
  context.restore()
}

const processTextureFile = async (
  file: File,
  label: string,
  expiresAtLabel: string
) => {
  const bitmap = await readImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Failed to create canvas context for texture processing')
  }

  context.drawImage(bitmap, 0, 0)
  drawTiledWatermark(context, canvas, label, expiresAtLabel)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => {
      if (!result) {
        reject(new Error(`Failed to export processed texture: ${file.name}`))
        return
      }
      resolve(result)
    }, 'image/webp', 1)
  })

  const storedName = file.name.replace(/\.[^.]+$/, '.webp')
  return {
    processedFile: new File([blob], storedName, { type: 'image/webp' }),
    textureManifest: {
      logicalName: file.name,
      storedName,
      mimeType: 'image/webp',
      width: canvas.width,
      height: canvas.height
    } satisfies ShareManifestTexture
  }
}

export const prepareShareUpload = async (sourceFiles: SpineSourceFiles): Promise<PreparedShareUpload> => {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const watermarkLabel = buildWatermarkLabel()
  const expiresAtLabel = `EXP ${expiresAt.toLocaleString()}`

  const processedTextures = await Promise.all(
    sourceFiles.textureFiles.map(file => processTextureFile(file, watermarkLabel, expiresAtLabel))
  )

  const manifest: ShareManifest = {
    shareId: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    files: {
      skeleton: {
        name: sourceFiles.skeletonFile.name,
        mimeType: sourceFiles.skeletonFile.type || 'application/json'
      },
      atlas: {
        name: sourceFiles.atlasFile.name,
        mimeType: sourceFiles.atlasFile.type || 'text/plain'
      },
      textures: processedTextures.map(item => item.textureManifest)
    },
    watermark: {
      mode: 'tiled-diagonal',
      label: watermarkLabel
    }
  }

  return {
    sourceFiles,
    manifest,
    processedTextures: processedTextures.map(item => item.processedFile)
  }
}
