import { createSpineResolvedResources } from '../fileResources'
import { buildSkeletonStructure } from '../skeletonStructure'
import type { SpineDebugOptions, SpineRuntimeAdapter, SpineRuntimeSession, SpineSessionCreateInput } from './types'

let spine4ModulePromise: Promise<any> | null = null

const loadSpine4Module = async () => {
  if (!spine4ModulePromise) {
    spine4ModulePromise = import('@esotericsoftware/spine-webgl')
  }

  return spine4ModulePromise
}

export class Spine4RuntimeAdapter implements SpineRuntimeAdapter {
  version = 4 as const

  async createSession(input: SpineSessionCreateInput): Promise<SpineRuntimeSession> {
    const spine = await loadSpine4Module()
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
            console.error(`Failed to preload: ${texUrl}`)
            resolve()
          }
          img.src = texUrl
        })
      })

      await Promise.all(promises)
    }

    await preloadTextures()

    input.canvas.width = input.canvas.clientWidth * window.devicePixelRatio
    input.canvas.height = input.canvas.clientHeight * window.devicePixelRatio

    return new Promise<SpineRuntimeSession>((resolve, reject) => {
      let spineCanvas: any = null
      let skeleton: any = null
      let animationState: any = null
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
        if (spineCanvas) {
          spineCanvas.dispose()
          spineCanvas = null
        }
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

      const updateCanvasSize = () => {
        input.canvas.width = input.canvas.clientWidth * window.devicePixelRatio
        input.canvas.height = input.canvas.clientHeight * window.devicePixelRatio
      }

      const resizeRenderer = () => {
        if (!spineCanvas?.renderer) return

        spineCanvas.renderer.resize(spine.ResizeMode.Expand)
      }

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

      const createSession = (): SpineRuntimeSession => ({
        version: 4,
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
          skeleton.updateWorldTransform(spine.Physics.update)
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
          panOffset = {
            x: panOffset.x + dx,
            y: panOffset.y + dy
          }
          publishViewState()
        },
        screenToWorld: (x: number, y: number) => {
          const camera = spineCanvas?.renderer?.camera
          if (!camera || !spine?.Vector3) return null

          return camera.screenToWorld(
            new spine.Vector3(x, y, 0),
            input.canvas.width,
            input.canvas.height
          )
        },
        resize: () => {
          resizeRenderer()

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

      const initializeSpine = (sc: any) => {
        if (disposed) return

        try {
          const atlasText = sc.assetManager.get(resources.atlasUrl)
          const skeletonText = sc.assetManager.get(resources.skeletonUrl)

          if (!atlasText || !skeletonText) {
            fail('Failed to load assets')
            return
          }

          const atlas = new spine.TextureAtlas(atlasText)

          for (const page of atlas.pages) {
            const baseName = page.name.replace(/\.\w+$/, '')
            const img = preloadedImages.get(page.name)
              || preloadedImages.get(page.name + '.png')
              || preloadedImages.get(page.name + '.jpg')
              || preloadedImages.get(baseName)
              || preloadedImages.get(baseName + '.png')
              || preloadedImages.get(baseName + '.jpg')

            if (img) {
              page.setTexture(new spine.GLTexture(sc.gl, img))
            } else {
              console.warn(`No preloaded image for atlas page: ${page.name}`)
            }
          }

          const atlasLoader = new spine.AtlasAttachmentLoader(atlas)
          const skeletonJson = new spine.SkeletonJson(atlasLoader)
          const skeletonData = skeletonJson.readSkeletonData(skeletonText)

          skeleton = new spine.Skeleton(skeletonData)
          const animationStateData = new spine.AnimationStateData(skeletonData)
          animationState = new spine.AnimationState(animationStateData)

          const animations = skeletonData.animations.map((a: any) => a.name)
          const firstAnim = (input.animationName && animations.includes(input.animationName))
            ? input.animationName
            : animations[0]

          if (firstAnim && animationState) {
            animationState.setAnimation(0, firstAnim, true)
          }

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
        } catch (e) {
          fail(e instanceof Error ? e.message : 'Failed to initialize')
        }
      }

      const renderSpine = (sc: any) => {
        if (disposed || !skeleton || !animationState || !sc.renderer) return

        const delta = sc.time.delta
        const timeScale = playbackEnabled ? playbackRate : 0
        animationState.update(delta * timeScale)
        animationState.apply(skeleton)
        skeleton.update(delta)
        skeleton.updateWorldTransform(spine.Physics.update)

        const track = animationState.getCurrent(0)
        let currentTime = 0
        let animationDuration = 0
        if (track) {
          animationDuration = track.animation?.duration || 0
          currentTime = animationDuration > 0 ? (track.trackTime % animationDuration) : track.trackTime
        }

        const bounds = skeleton.getBoundsRect()
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          const camera = sc.renderer.camera
          if (needsCameraFit || !fittedBounds) {
            fitCameraToBounds(bounds)
          }

          camera.position.x = fittedCameraCenter.x + panOffset.x
          camera.position.y = fittedCameraCenter.y + panOffset.y
          camera.zoom = fittedCameraZoom * viewScale
          camera.update()
          publishViewState()
        }

        sc.clear(0.15, 0.15, 0.15, 1)

        sc.renderer.begin()
        sc.renderer.drawSkeleton(skeleton, true)
        if (currentDebugOptions.showBones || currentDebugOptions.showSlots) {
          sc.renderer.skeletonDebugRenderer.drawBones = currentDebugOptions.showBones
          sc.renderer.skeletonDebugRenderer.drawRegionAttachments = currentDebugOptions.showSlots
          sc.renderer.skeletonDebugRenderer.drawBoundingBoxes = false
          sc.renderer.skeletonDebugRenderer.drawMeshHull = false
          sc.renderer.skeletonDebugRenderer.drawMeshTriangles = false
          sc.renderer.skeletonDebugRenderer.drawPaths = false
          sc.renderer.skeletonDebugRenderer.drawSkeletonXY = false
          sc.renderer.skeletonDebugRenderer.drawClipping = false
          sc.renderer.drawSkeletonDebug(skeleton, true)
        }
        drawSelectionHighlight(sc)
        const frameDrawCall = sc.renderer.batcher.getDrawCalls()
        sc.renderer.end()

        input.onTimeUpdate(currentTime, animationDuration, frameDrawCall)
      }

      const drawSelectionHighlight = (sc: any) => {
        const selectedBone = currentSelection.boneName ? skeleton.findBone(currentSelection.boneName) : null
        const selectedSlot = currentSelection.slotName ? skeleton.findSlot(currentSelection.slotName) : null
        const slotBone = selectedSlot?.bone || null

        if (!selectedBone && !slotBone) return

        const accentColor = new spine.Color(0.98, 0.77, 0.2, 1)
        const secondaryColor = new spine.Color(0.2, 0.95, 0.85, 1)

        if (selectedBone) {
          if (selectedBone.parent) {
            sc.renderer.line(
              selectedBone.parent.worldX,
              selectedBone.parent.worldY,
              selectedBone.worldX,
              selectedBone.worldY,
              accentColor,
              accentColor
            )
          }

          sc.renderer.circle(false, selectedBone.worldX, selectedBone.worldY, 10, accentColor, 24)
          sc.renderer.circle(true, selectedBone.worldX, selectedBone.worldY, 3.5, accentColor, 16)
        }

        if (slotBone) {
          sc.renderer.circle(false, slotBone.worldX, slotBone.worldY, 16, secondaryColor, 24)
          sc.renderer.circle(false, slotBone.worldX, slotBone.worldY, 8, secondaryColor, 24)
          sc.renderer.line(
            slotBone.worldX - 12,
            slotBone.worldY,
            slotBone.worldX + 12,
            slotBone.worldY,
            secondaryColor,
            secondaryColor
          )
          sc.renderer.line(
            slotBone.worldX,
            slotBone.worldY - 12,
            slotBone.worldX,
            slotBone.worldY + 12,
            secondaryColor,
            secondaryColor
          )
        }
      }

      try {
        spineCanvas = new spine.SpineCanvas(input.canvas, {
          app: {
            loadAssets: (sc: any) => {
              sc.assetManager.loadText(resources.skeletonUrl)
              sc.assetManager.loadText(resources.atlasUrl)
            },
            initialize: (sc: any) => {
              resizeRenderer()
              initializeSpine(sc)
            },
            render: (sc: any) => {
              renderSpine(sc)
            }
          },
          pathPrefix: '',
          webglConfig: { alpha: true }
        })
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Failed to load')
      }
    })
  }
}
