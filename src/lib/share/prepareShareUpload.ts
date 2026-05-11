import type { SpineSourceFiles } from '../spine/versionDetection'
import type { PreparedShareUpload, ShareManifest, ShareManifestTexture, ShareUploadOptions } from './types'

const readImageBitmap = async (file: File) => {
  const bitmap = await createImageBitmap(file)
  return bitmap
}

const buildWatermarkLabel = () => {
  const token = crypto.randomUUID().slice(0, 8).toUpperCase()
  return `SHARE ${token}`
}

const createTextMask = (canvas: HTMLCanvasElement, label: string) => {
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = canvas.width
  maskCanvas.height = canvas.height

  const maskContext = maskCanvas.getContext('2d')
  if (!maskContext) {
    throw new Error('Failed to create canvas context for watermark mask')
  }

  const minDimension = Math.min(canvas.width, canvas.height)
  const fontSize = Math.max(10, Math.round(minDimension * 0.018))
  const rowGap = Math.max(24, Math.round(fontSize * 2.4))
  const columnGap = Math.max(28, Math.round(fontSize * 2.8))

  maskContext.save()
  maskContext.font = `600 ${fontSize}px sans-serif`
  maskContext.textBaseline = 'middle'
  maskContext.textAlign = 'left'
  maskContext.fillStyle = 'rgba(255, 255, 255, 0.92)'

  const textWidth = Math.ceil(maskContext.measureText(label).width)
  const stepX = textWidth + columnGap

  for (let y = rowGap; y < canvas.height + rowGap; y += rowGap) {
    const rowIndex = Math.floor((y - rowGap) / rowGap)
    const offsetX = rowIndex % 2 === 0 ? columnGap : Math.round(columnGap + stepX / 2)

    for (let x = -textWidth; x < canvas.width + textWidth; x += stepX) {
      maskContext.fillText(label, x + offsetX, y)
    }
  }

  maskContext.restore()
  return maskContext.getImageData(0, 0, canvas.width, canvas.height)
}

const drawSoftTextWatermark = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  label: string
) => {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const mask = createTextMask(canvas, label).data

  const alphaThreshold = 36
  const maxTint = 0.11

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4
      const alpha = pixels[index + 3]
      if (alpha <= alphaThreshold) continue

      const maskAlpha = mask[index + 3] / 255
      if (maskAlpha <= 0) continue

      const alphaStrength = (alpha - alphaThreshold) / (255 - alphaThreshold)
      const strength = Math.min(maxTint, Math.max(0, maskAlpha * alphaStrength * maxTint))

      pixels[index] = Math.round(pixels[index] * (1 - strength))
      pixels[index + 1] = Math.round(pixels[index + 1] * (1 - strength))
      pixels[index + 2] = Math.round(pixels[index + 2] * (1 - strength))
    }
  }

  context.putImageData(imageData, 0, 0)
}

const processTextureFile = async (
  file: File,
  label: string,
  watermarkEnabled: boolean
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
  if (watermarkEnabled) {
    drawSoftTextWatermark(context, canvas, label)
  }
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

const trimSkeletonAnimations = async (
  skeletonFile: File,
  clipAnimationName: string | null
) => {
  if (!clipAnimationName) return skeletonFile

  const skeletonText = await skeletonFile.text()
  let parsed: Record<string, unknown>

  try {
    parsed = JSON.parse(skeletonText) as Record<string, unknown>
  } catch {
    throw new Error('Failed to parse skeleton JSON for share trimming')
  }

  const animationMap = parsed.animations
  if (!animationMap || typeof animationMap !== 'object' || Array.isArray(animationMap)) {
    throw new Error('Skeleton JSON does not contain a valid animations object')
  }

  if (!(clipAnimationName in animationMap)) {
    throw new Error(`Animation "${clipAnimationName}" was not found in skeleton JSON`)
  }

  const trimmedSkeleton = {
    ...parsed,
    animations: {
      [clipAnimationName]: (animationMap as Record<string, unknown>)[clipAnimationName]
    }
  }

  return new File(
    [JSON.stringify(trimmedSkeleton, null, 2)],
    skeletonFile.name,
    { type: skeletonFile.type || 'application/json' }
  )
}

export const prepareShareUpload = async (
  sourceFiles: SpineSourceFiles,
  options: ShareUploadOptions
): Promise<PreparedShareUpload> => {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const watermarkLabel = buildWatermarkLabel()
  const sharedSkeletonFile = await trimSkeletonAnimations(sourceFiles.skeletonFile, options.clipAnimationName)

  const processedTextures = await Promise.all(
    sourceFiles.textureFiles.map(file => processTextureFile(file, watermarkLabel, options.watermarkEnabled))
  )

  const manifest: ShareManifest = {
    shareId: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    files: {
      skeleton: {
        name: sharedSkeletonFile.name,
        mimeType: sharedSkeletonFile.type || 'application/json'
      },
      atlas: {
        name: sourceFiles.atlasFile.name,
        mimeType: sourceFiles.atlasFile.type || 'text/plain'
      },
      textures: processedTextures.map(item => item.textureManifest)
    },
    watermark: {
      enabled: options.watermarkEnabled,
      mode: options.watermarkEnabled ? 'soft-text' : 'none',
      label: options.watermarkEnabled ? watermarkLabel : null
    },
    defaults: {
      animationName: options.defaultAnimationName,
      skinName: options.defaultSkinName
    },
    content: {
      clipAnimationName: options.clipAnimationName
    }
  }

  return {
    sourceFiles: {
      ...sourceFiles,
      skeletonFile: sharedSkeletonFile
    },
    manifest,
    processedTextures: processedTextures.map(item => item.processedFile)
  }
}
