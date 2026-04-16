import { loadSpine3Runtime } from '../loaders/loadSpine3Runtime'
import type { SpineRuntimeAdapter, SpineRuntimeSession, SpineSessionCreateInput } from './types'

const SPINE3_RUNTIME_UNAVAILABLE_MESSAGE =
  'Spine 3.x runtime bundle is not ready. Replace vendor/spine-3.8/dist/spine-webgl-3.8.js with a real Spine 3.8 build, and ensure it exports the required runtime APIs.'

const REQUIRED_SPINE3_EXPORTS = [
  'SpineCanvas',
  'TextureAtlas',
  'AtlasAttachmentLoader',
  'SkeletonJson',
  'Skeleton',
  'AnimationStateData',
  'AnimationState',
  'GLTexture',
  'Vector3'
] as const

const resolveRuntimeNamespace = (module: Record<string, unknown>) => {
  const runtimeCandidate = module.default && typeof module.default === 'object'
    ? module.default as Record<string, unknown>
    : module

  return runtimeCandidate
}

const validateSpine3Runtime = (runtime: Record<string, unknown>) => {
  const missingExports = REQUIRED_SPINE3_EXPORTS.filter(name => !(name in runtime))
  if (missingExports.length > 0) {
    throw new Error(
      `${SPINE3_RUNTIME_UNAVAILABLE_MESSAGE} Missing exports: ${missingExports.join(', ')}`
    )
  }
}

export class Spine3RuntimeAdapter implements SpineRuntimeAdapter {
  version = 3 as const

  async createSession(input: SpineSessionCreateInput): Promise<SpineRuntimeSession> {
    try {
      const module = await loadSpine3Runtime() as Record<string, unknown>
      const runtime = resolveRuntimeNamespace(module)
      validateSpine3Runtime(runtime)
    } catch (error) {
      const message = error instanceof Error ? error.message : SPINE3_RUNTIME_UNAVAILABLE_MESSAGE
      input.onError(message)
      throw new Error(message)
    }

    const message = 'Spine 3.x runtime bundle loaded, but session initialization is not implemented yet.'
    input.onError(message)
    throw new Error(message)
  }
}

export { SPINE3_RUNTIME_UNAVAILABLE_MESSAGE }
