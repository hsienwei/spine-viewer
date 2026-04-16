const SPINE3_VENDOR_IMPORT_PATH = '../../../../vendor/spine-3.8/dist/spine-webgl-3.8.js'

export const loadSpine3Runtime = async () => {
  return import(SPINE3_VENDOR_IMPORT_PATH)
}
