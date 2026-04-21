import { createSpineResolvedResources } from '../fileResources'
import { buildSkeletonStructure } from '../skeletonStructure'
import { loadSpine3Runtime } from '../loaders/loadSpine3Runtime'
import type { SpineDebugOptions, SpineRuntimeAdapter, SpineRuntimeSession, SpineSessionCreateInput } from './types'

const SPINE3_RUNTIME_UNAVAILABLE_MESSAGE =
  'Spine 3.x runtime bundle is not ready. Replace vendor/spine-3.8/dist/spine-webgl-3.8.js with a real Spine 3.8 build, and ensure it exports the required runtime APIs.'

const REQUIRED_SPINE3_EXPORTS = [
  'ManagedWebGLRenderingContext',
  'SceneRenderer',
  'TextureAtlas',
  'AtlasAttachmentLoader',
  'SkeletonJson',
  'Skeleton',
  'AnimationStateData',
  'AnimationState',
  'GLTexture'
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
    let spine: Record<string, any>

    try {
      const module = await loadSpine3Runtime() as Record<string, unknown>
      spine = resolveRuntimeNamespace(module)
      validateSpine3Runtime(spine)
    } catch (error) {
      const message = error instanceof Error ? error.message : SPINE3_RUNTIME_UNAVAILABLE_MESSAGE
      input.onError(message)
      throw new Error(message)
    }

    const resources = createSpineResolvedResources(input.sourceFiles)
    const preloadedImages = new Map<string, HTMLImageElement>()

    const preloadTextures = async () => {
      if (resources.textureUrls.length === 0) return
      const promises = resources.textureUrls.map((texUrl: string, i: number) => {
        return new Promise<void>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const filename = input.sourceFiles.textureFiles[i]?.name || texUrl
            preloadedImages.set(filename, img)
            resolve()
          }
          img.onerror = () => {
            console.error(`Failed to preload texture: ${texUrl}`)
            resolve()
          }
          img.src = texUrl
        })
      })
      await Promise.all(promises)
    }

    await preloadTextures()

    return new Promise<SpineRuntimeSession>((resolve, reject) => {
      let context: any = null
      let renderer: any = null
      let skeleton: any = null
      let animationState: any = null
      let animFrameId = 0
      let lastTime = Date.now() / 1000
      let viewScale = 1
      let panOffset = { x: 0, y: 0 }
      let currentDebugOptions: SpineDebugOptions = { showBones: false, showSlots: false }
      let currentSelection = { boneName: null as string | null, slotName: null as string | null }
      let playbackEnabled = true
      let playbackRate = 1
      let settled = false
      let disposed = false
      let currentBounds = { width: 0, height: 0 }
      let fittedBounds: { x: number; y: number; width: number; height: number } | null = null
      let fittedCameraCenter = { x: 0, y: 0 }
      let fittedCameraZoom = 1
      let needsCameraFit = true

      const cleanup = () => {
        if (animFrameId) {
          cancelAnimationFrame(animFrameId)
          animFrameId = 0
        }
        if (renderer) {
          try { renderer.dispose() } catch (_) {}
          renderer = null
        }
        context = null
        skeleton = null
        animationState = null
        preloadedImages.clear()
        resources.revokeAll()
      }

      const publishViewState = () => {
        input.onViewState({
          bounds: currentBounds,
          panOffset,
          viewScale
        })
      }

      const fail = (message: string) => {
        if (disposed) return
        input.onError(message)
        cleanup()
        if (!settled) {
          settled = true
          reject(new Error(message))
        }
      }

      const getCurrentTrack = () => animationState?.getCurrent(0) || null

      const fitCameraToBounds = (bounds: { x: number; y: number; width: number; height: number }) => {
        fittedBounds = { ...bounds }
        fittedCameraCenter = {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2
        }
        currentBounds = { width: bounds.width, height: bounds.height }
        fittedCameraZoom = 1
        needsCameraFit = false
      }

      // In 3.8: skeleton.getBounds(offset, size) takes Vector2 objects
      const getBoundsRect = () => {
        const offset = new spine.Vector2()
        const size = new spine.Vector2()
        skeleton.getBounds(offset, size)
        return { x: offset.x, y: offset.y, width: size.x, height: size.y }
      }

      const drawSelectionHighlight = () => {
        const selectedBone = currentSelection.boneName ? skeleton.findBone(currentSelection.boneName) : null
        const selectedSlot = currentSelection.slotName ? skeleton.findSlot(currentSelection.slotName) : null
        const slotBone = selectedSlot?.bone || null

        if (!selectedBone && !slotBone) return

        const accentColor = new spine.Color(0.98, 0.77, 0.2, 1)
        const secondaryColor = new spine.Color(0.2, 0.95, 0.85, 1)

        if (selectedBone) {
          if (selectedBone.parent) {
            renderer.line(
              selectedBone.parent.worldX, selectedBone.parent.worldY,
              selectedBone.worldX, selectedBone.worldY,
              accentColor, accentColor
            )
          }
          renderer.circle(false, selectedBone.worldX, selectedBone.worldY, 10, accentColor, 24)
          renderer.circle(true, selectedBone.worldX, selectedBone.worldY, 3.5, accentColor, 16)
        }

        if (slotBone) {
          renderer.circle(false, slotBone.worldX, slotBone.worldY, 16, secondaryColor, 24)
          renderer.circle(false, slotBone.worldX, slotBone.worldY, 8, secondaryColor, 24)
          renderer.line(
            slotBone.worldX - 12, slotBone.worldY,
            slotBone.worldX + 12, slotBone.worldY,
            secondaryColor, secondaryColor
          )
          renderer.line(
            slotBone.worldX, slotBone.worldY - 12,
            slotBone.worldX, slotBone.worldY + 12,
            secondaryColor, secondaryColor
          )
        }
      }

      const renderLoop = () => {
        if (disposed) return

        if (!skeleton || !animationState || !renderer) {
          animFrameId = requestAnimationFrame(renderLoop)
          return
        }

        const now = Date.now() / 1000
        const delta = Math.min(now - lastTime, 0.064)
        lastTime = now

        const timeScale = playbackEnabled ? playbackRate : 0
        animationState.update(delta * timeScale)
        animationState.apply(skeleton)
        // 3.8: updateWorldTransform() takes no arguments (no Physics enum)
        skeleton.updateWorldTransform()

        const track = getCurrentTrack()
        let currentTime = 0
        let animationDuration = 0
        if (track) {
          animationDuration = track.animation?.duration || 0
          currentTime = animationDuration > 0 ? (track.trackTime % animationDuration) : track.trackTime
        }

        const bounds = getBoundsRect()
        if (bounds.width > 0 && bounds.height > 0) {
          if (needsCameraFit || !fittedBounds) {
            fitCameraToBounds(bounds)
            publishViewState()
          }
          renderer.camera.position.set(
            fittedCameraCenter.x + panOffset.x,
            fittedCameraCenter.y + panOffset.y,
            0
          )
          renderer.camera.zoom = fittedCameraZoom * viewScale
        }

        // resize handles canvas dimensions, viewport, and camera.update()
        renderer.resize(spine.ResizeMode.Expand)

        const gl = context.gl
        gl.clearColor(0.15, 0.15, 0.15, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        renderer.begin()
        renderer.drawSkeleton(skeleton, true)

        if (currentDebugOptions.showBones || currentDebugOptions.showSlots) {
          renderer.skeletonDebugRenderer.drawBones = currentDebugOptions.showBones
          renderer.skeletonDebugRenderer.drawRegionAttachments = currentDebugOptions.showSlots
          renderer.skeletonDebugRenderer.drawBoundingBoxes = false
          renderer.skeletonDebugRenderer.drawMeshHull = false
          renderer.skeletonDebugRenderer.drawMeshTriangles = false
          renderer.skeletonDebugRenderer.drawPaths = false
          renderer.skeletonDebugRenderer.drawSkeletonXY = false
          renderer.drawSkeletonDebug(skeleton, true)
        }

        drawSelectionHighlight()
        const frameDrawCall = renderer.batcher.getDrawCalls()
        renderer.end()

        input.onTimeUpdate(currentTime, animationDuration, frameDrawCall)

        animFrameId = requestAnimationFrame(renderLoop)
      }

      const createSession = (): SpineRuntimeSession => ({
        version: 3,
        setAnimation: (name: string, loop: boolean) => {
          if (animationState && name) {
            animationState.setAnimation(0, name, loop)
          }
        },
        setPlayback: (enabled: boolean, nextRate: number) => {
          playbackEnabled = enabled
          playbackRate = nextRate
        },
        setDebugOptions: (options: SpineDebugOptions) => {
          currentDebugOptions = options
        },
        setSelection: (selection) => {
          currentSelection = selection
        },
        seekTo: (time: number) => {
          const track = getCurrentTrack()
          if (!track || !skeleton || !animationState) return
          const duration = track.animation?.duration || 0
          const nextTime = duration > 0 ? Math.max(0, Math.min(time, duration)) : Math.max(0, time)
          track.trackTime = nextTime
          track.animationLast = nextTime
          animationState.apply(skeleton)
          skeleton.updateWorldTransform()
        },
        resetView: () => {
          viewScale = 1
          panOffset = { x: 0, y: 0 }
          needsCameraFit = true
          publishViewState()
        },
        getViewScale: () => viewScale,
        adjustViewScale: (nextScale: number) => {
          viewScale = nextScale
          publishViewState()
        },
        panBy: (dx: number, dy: number) => {
          panOffset = { x: panOffset.x + dx, y: panOffset.y + dy }
          publishViewState()
        },
        screenToWorld: (x: number, y: number) => {
          if (!renderer || !spine.Vector3) return null
          const result = renderer.camera.screenToWorld(
            new spine.Vector3(x, y, 0),
            input.canvas.width,
            input.canvas.height
          )
          return { x: result.x, y: result.y }
        },
        resize: () => {
          if (!renderer) return
          renderer.resize(spine.ResizeMode.Expand)
          if (fittedBounds) {
            fitCameraToBounds(fittedBounds)
            publishViewState()
          }
        },
        dispose: () => {
          disposed = true
          cleanup()
        }
      })

      // Fetch skeleton and atlas text, then initialize
      const fetchText = (url: string): Promise<string> =>
        fetch(url).then(r => {
          if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.statusText}`)
          return r.text()
        })

      Promise.all([
        fetchText(resources.skeletonUrl),
        fetchText(resources.atlasUrl)
      ]).then(([skeletonText, atlasText]) => {
        if (disposed) return

        try {
          context = new spine.ManagedWebGLRenderingContext(input.canvas, { alpha: true })
          renderer = new spine.SceneRenderer(input.canvas, context)

          // 3.8 TextureAtlas uses a synchronous textureLoader callback per atlas page
          const atlas = new spine.TextureAtlas(atlasText, (name: string) => {
            const baseName = name.replace(/\.\w+$/, '')
            const img = preloadedImages.get(name)
              || preloadedImages.get(name + '.png')
              || preloadedImages.get(name + '.jpg')
              || preloadedImages.get(baseName)
              || preloadedImages.get(baseName + '.png')
              || preloadedImages.get(baseName + '.jpg')

            if (!img) throw new Error(`No preloaded image for atlas page: ${name}`)
            return new spine.GLTexture(context, img)
          })

          const atlasLoader = new spine.AtlasAttachmentLoader(atlas)
          const skeletonJson = new spine.SkeletonJson(atlasLoader)
          const skeletonData = skeletonJson.readSkeletonData(skeletonText)

          skeleton = new spine.Skeleton(skeletonData)
          const animationStateData = new spine.AnimationStateData(skeletonData)
          animationState = new spine.AnimationState(animationStateData)

          const animations: string[] = skeletonData.animations.map((a: any) => a.name)
          const firstAnim = (input.animationName && animations.includes(input.animationName))
            ? input.animationName
            : animations[0]

          if (firstAnim) {
            animationState.setAnimation(0, firstAnim, true)
          }

          renderer.resize(spine.ResizeMode.Expand)

          input.onLoaded({
            animations,
            skeletonName: skeletonData.name || 'spine',
            drawCall: 0,
            duration: skeletonData.animations.find((a: any) => a.name === firstAnim)?.duration || 0,
            structure: buildSkeletonStructure(skeletonData.bones, skeletonData.slots)
          })
          publishViewState()

          if (!settled) {
            settled = true
            resolve(createSession())
          }

          lastTime = Date.now() / 1000
          animFrameId = requestAnimationFrame(renderLoop)
        } catch (e) {
          fail(e instanceof Error ? e.message : 'Failed to initialize Spine 3.8')
        }
      }).catch(e => {
        fail(e instanceof Error ? e.message : 'Failed to load Spine 3.8 assets')
      })
    })
  }
}

export { SPINE3_RUNTIME_UNAVAILABLE_MESSAGE }
