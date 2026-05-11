const DEFAULT_WEBM_FPS = 60

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

const getSupportedWebmMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser does not support WebM recording')
  }

  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ]

  return mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || ''
}

export interface RecordCanvasToWebmOptions {
  canvas: HTMLCanvasElement
  durationMs: number
  fileName: string
  fps?: number
  settleMs?: number
}

export const recordCanvasToWebm = async ({
  canvas,
  durationMs,
  fileName,
  fps = DEFAULT_WEBM_FPS,
  settleMs = 120
}: RecordCanvasToWebmOptions) => {
  if (typeof canvas.captureStream !== 'function') {
    throw new Error('This browser does not support canvas capture')
  }

  const mimeType = getSupportedWebmMimeType()
  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []

  await wait(settleMs)

  const blob = await new Promise<Blob>((resolve, reject) => {
    let stopTimer = 0

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    recorder.onerror = () => {
      reject(new Error('Failed to record WebM'))
    }

    recorder.onstop = () => {
      if (stopTimer) {
        window.clearTimeout(stopTimer)
      }

      stream.getTracks().forEach(track => track.stop())

      if (chunks.length === 0) {
        reject(new Error('Recorded WebM is empty'))
        return
      }

      resolve(new Blob(chunks, { type: mimeType || 'video/webm' }))
    }

    recorder.start()
    stopTimer = window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
    }, Math.max(250, Math.ceil(durationMs)))
  })

  return new File([blob], fileName, { type: blob.type || 'video/webm' })
}

export const downloadWebm = async (file: File) => {
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  return 'downloaded'
}
