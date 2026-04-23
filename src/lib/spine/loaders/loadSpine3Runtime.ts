const SPINE3_VENDOR_RUNTIME_PATH = 'vendor/spine-3.8/dist/spine-webgl-3.8.js'

let spine3RuntimePromise: Promise<unknown> | null = null

const getSpine3RuntimeUrl = () => {
  const baseUrl = import.meta.env.BASE_URL || '/'
  return new URL(SPINE3_VENDOR_RUNTIME_PATH, window.location.origin + baseUrl).toString()
}

export const loadSpine3Runtime = async () => {
  if (!spine3RuntimePromise) {
    const runtimeUrl = getSpine3RuntimeUrl()
    spine3RuntimePromise = import(/* @vite-ignore */ runtimeUrl)
  }

  return spine3RuntimePromise
}
