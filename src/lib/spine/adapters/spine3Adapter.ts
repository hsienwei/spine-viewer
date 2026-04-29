import { createSpineResolvedResources } from '../fileResources'
import { buildSkeletonStructure } from '../skeletonStructure'
import { loadSpine3Runtime } from '../loaders/loadSpine3Runtime'
import { createAxisOverlay } from './axisOverlay'
import { extractAnimationSummaries } from './extractAnimationSummaries'
import { DEFAULT_SPINE_DEBUG_OPTIONS, DEFAULT_SPINE_TEXTURE_FILTERING } from './types'
import type {
  SpineAnimationEventType,
  SpineDebugOptions,
  SpineRuntimeAdapter,
  SpineRuntimeSession,
  SpineSessionCreateInput,
  SpineTextureFiltering,
  SpineTrackEntry
} from './types'

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
      let atlas: any = null
      let context: any = null
      let renderer: any = null
      let skeleton: any = null
      let animationState: any = null
      let animFrameId = 0
      let lastTime = Date.now() / 1000
      let viewScale = 1
      let panOffset = { x: 0, y: 0 }
      let currentDebugOptions: SpineDebugOptions = { ...DEFAULT_SPINE_DEBUG_OPTIONS }
      let currentTextureFiltering: SpineTextureFiltering = input.textureFiltering ?? DEFAULT_SPINE_TEXTURE_FILTERING
      let currentSelection = { boneName: null as string | null, slotName: null as string | null }
      let playbackEnabled = true
      let playbackRate = 1
      let availableSkins: string[] = []
      let currentSkinName = ''
      let premultipliedAlpha = input.premultipliedAlpha ?? true
      let settled = false
      let disposed = false
      let currentBounds = { width: 0, height: 0 }
      let fittedBounds: { x: number; y: number; width: number; height: number } | null = null
      let fittedCameraCenter = { x: 0, y: 0 }
      let fittedCameraZoom = 1
      let needsCameraFit = true
      let appliedTrackEntries: SpineTrackEntry[] = []

      const getNormalizedTrackTime = (entry: any) => {
        if (typeof entry?.trackTime !== 'number') return null

        const duration = entry?.animation?.duration
        if (typeof duration === 'number' && duration > 0) {
          return entry.trackTime % duration
        }

        return entry.trackTime
      }

      const getTrackMeta = (entry: any) => ({
        trackIndex: typeof entry?.trackIndex === 'number' ? entry.trackIndex : 0,
        animationName: entry?.animation?.name ?? null,
        trackTime: getNormalizedTrackTime(entry)
      })

      const emitStateEvent = (
        type: Exclude<SpineAnimationEventType, 'event'>,
        entry: any,
        loopCount: number | null = null
      ) => {
        input.onAnimationEvent({
          type,
          ...getTrackMeta(entry),
          loopCount
        })
      }

      const emitTimelineEvent = (entry: any, timelineEvent: any) => {
        const eventTime = typeof timelineEvent?.time === 'number'
          ? timelineEvent.time
          : getNormalizedTrackTime(entry)

        input.onAnimationEvent({
          type: 'event',
          ...getTrackMeta(entry),
          trackTime: eventTime,
          eventName: timelineEvent?.data?.name ?? timelineEvent?.name ?? null,
          intValue: typeof timelineEvent?.intValue === 'number' ? timelineEvent.intValue : null,
          floatValue: typeof timelineEvent?.floatValue === 'number' ? timelineEvent.floatValue : null,
          stringValue: typeof timelineEvent?.stringValue === 'string' ? timelineEvent.stringValue : null,
          volume: typeof timelineEvent?.volume === 'number' ? timelineEvent.volume : null,
          balance: typeof timelineEvent?.balance === 'number' ? timelineEvent.balance : null
        })
      }

      const attachAnimationListener = () => {
        if (!animationState || typeof animationState.addListener !== 'function') return

        animationState.addListener({
          start: (entry: any) => emitStateEvent('start', entry),
          interrupt: (entry: any) => emitStateEvent('interrupt', entry),
          end: (entry: any) => emitStateEvent('end', entry),
          dispose: (entry: any) => emitStateEvent('dispose', entry),
          complete: (entry: any) => {
            const duration = entry?.animation?.duration
            const loopCount = typeof entry?.trackTime === 'number' && typeof duration === 'number' && duration > 0
              ? Math.floor(entry.trackTime / duration)
              : null
            emitStateEvent('complete', entry, loopCount)
          },
          event: (entry: any, timelineEvent: any) => emitTimelineEvent(entry, timelineEvent)
        })
      }

      const cleanup = () => {
        if (animFrameId) {
          cancelAnimationFrame(animFrameId)
          animFrameId = 0
        }
        if (renderer) {
          try { renderer.dispose() } catch (_) {}
          renderer = null
        }
        atlas = null
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

      const applyTrackAnimation = (track: SpineTrackEntry) => {
        if (!animationState) return

        const entry = animationState.setAnimation(track.trackIndex, track.animationName, track.loop)
        if (entry && typeof track.mixDuration === 'number') {
          entry.mixDuration = Math.max(0, track.mixDuration)
        }
      }

      const syncTracks = (tracks: SpineTrackEntry[]) => {
        if (!animationState) return

        const nextTracks = [...tracks]
          .filter(track => track.trackIndex >= 0 && !!track.animationName)
          .sort((a, b) => a.trackIndex - b.trackIndex)

        const maxTrackIndex = Math.max(
          -1,
          ...appliedTrackEntries.map(track => track.trackIndex),
          ...nextTracks.map(track => track.trackIndex)
        )

        for (let trackIndex = 0; trackIndex <= maxTrackIndex; trackIndex += 1) {
          const nextTrack = nextTracks.find(track => track.trackIndex === trackIndex)
          const prevTrack = appliedTrackEntries.find(track => track.trackIndex === trackIndex)

          if (!nextTrack) {
            if (prevTrack && typeof animationState.clearTrack === 'function') {
              animationState.clearTrack(trackIndex)
            }
            continue
          }

          if (
            prevTrack
            && prevTrack.animationName === nextTrack.animationName
            && prevTrack.loop === nextTrack.loop
            && prevTrack.mixDuration === nextTrack.mixDuration
          ) {
            continue
          }

          applyTrackAnimation(nextTrack)
        }

        appliedTrackEntries = nextTracks.map(track => ({ ...track }))
      }

      const updateSkeletonWorldTransform = () => {
        skeleton?.updateWorldTransform()
      }

      const applySkin = (name: string | null | undefined) => {
        if (!skeleton || !name || !availableSkins.includes(name)) return

        skeleton.setSkinByName(name)
        currentSkinName = name
        skeleton.setSlotsToSetupPose()
        animationState?.apply(skeleton)
        updateSkeletonWorldTransform()
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

      // In 3.8: skeleton.getBounds(offset, size) takes Vector2 objects
      const getBoundsRect = () => {
        const offset = new spine.Vector2()
        const size = new spine.Vector2()
        skeleton.getBounds(offset, size)
        return { x: offset.x, y: offset.y, width: size.x, height: size.y }
      }

      const applyTextureFiltering = (filtering: SpineTextureFiltering) => {
        currentTextureFiltering = filtering

        if (!atlas?.pages?.length) return

        const minFilter = filtering === 'nearest' ? spine.TextureFilter.Nearest : spine.TextureFilter.Linear
        const magFilter = filtering === 'nearest' ? spine.TextureFilter.Nearest : spine.TextureFilter.Linear

        for (const page of atlas.pages) {
          page.texture?.setFilters(minFilter, magFilter)
        }
      }

      const drawWorldAxes = () => {
        if (!renderer?.camera || !spine.Vector3) return

        const overlay = createAxisOverlay({
          canvasWidth: input.canvas.width,
          canvasHeight: input.canvas.height,
          screenToWorld: (x, y) => {
            const point = renderer.camera.screenToWorld(
              new spine.Vector3(x, y, 0),
              input.canvas.width,
              input.canvas.height
            )

            return point ? { x: point.x, y: point.y } : null
          }
        })

        if (!overlay) return

        const xAxisColor = new spine.Color(0.92, 0.36, 0.36, 0.9)
        const yAxisColor = new spine.Color(0.3, 0.86, 0.58, 0.9)
        const originColor = new spine.Color(0.95, 0.95, 0.95, 0.95)

        renderer.line(
          overlay.xAxis.x1,
          overlay.xAxis.y1,
          overlay.xAxis.x2,
          overlay.xAxis.y2,
          xAxisColor,
          xAxisColor
        )
        renderer.line(
          overlay.yAxis.x1,
          overlay.yAxis.y1,
          overlay.yAxis.x2,
          overlay.yAxis.y2,
          yAxisColor,
          yAxisColor
        )
        renderer.circle(true, 0, 0, 3.5, originColor, 18)
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

      const drawPointAttachments = () => {
        if (!currentDebugOptions.showPoints || !skeleton?.slots || !spine.Vector2 || !spine.PointAttachment) return

        const pointColor = new spine.Color(0.95, 0.44, 0.2, 0.95)
        const directionColor = new spine.Color(1, 0.82, 0.3, 0.95)
        const worldPoint = new spine.Vector2()
        const directionLength = 22
        const arrowSize = 5

        for (const slot of skeleton.slots) {
          const attachment = slot?.attachment
          if (!(attachment instanceof spine.PointAttachment) || !slot.bone) continue

          attachment.computeWorldPosition(slot.bone, worldPoint)
          const rotation = attachment.computeWorldRotation(slot.bone) * Math.PI / 180
          const endX = worldPoint.x + Math.cos(rotation) * directionLength
          const endY = worldPoint.y + Math.sin(rotation) * directionLength

          renderer.circle(false, worldPoint.x, worldPoint.y, 5, pointColor, 18)
          renderer.circle(true, worldPoint.x, worldPoint.y, 2.2, pointColor, 12)
          renderer.line(worldPoint.x, worldPoint.y, endX, endY, directionColor, directionColor)

          const leftX = endX - Math.cos(rotation - Math.PI / 6) * arrowSize
          const leftY = endY - Math.sin(rotation - Math.PI / 6) * arrowSize
          const rightX = endX - Math.cos(rotation + Math.PI / 6) * arrowSize
          const rightY = endY - Math.sin(rotation + Math.PI / 6) * arrowSize

          renderer.line(endX, endY, leftX, leftY, directionColor, directionColor)
          renderer.line(endX, endY, rightX, rightY, directionColor, directionColor)
        }
      }

      const hasSkeletonDebugEnabled = () => (
        currentDebugOptions.showBones
        || currentDebugOptions.showRegions
        || currentDebugOptions.showBounds
        || currentDebugOptions.showPaths
        || currentDebugOptions.showClipping
        || currentDebugOptions.showMeshHull
        || currentDebugOptions.showMeshTriangles
      )

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
        if (currentDebugOptions.showAxes) {
          drawWorldAxes()
        }
        renderer.drawSkeleton(skeleton, premultipliedAlpha)

        if (hasSkeletonDebugEnabled()) {
          renderer.skeletonDebugRenderer.drawBones = currentDebugOptions.showBones
          renderer.skeletonDebugRenderer.drawRegionAttachments = currentDebugOptions.showRegions
          renderer.skeletonDebugRenderer.drawBoundingBoxes = currentDebugOptions.showBounds
          renderer.skeletonDebugRenderer.drawMeshHull = currentDebugOptions.showMeshHull
          renderer.skeletonDebugRenderer.drawMeshTriangles = currentDebugOptions.showMeshTriangles
          renderer.skeletonDebugRenderer.drawPaths = currentDebugOptions.showPaths
          renderer.skeletonDebugRenderer.drawSkeletonXY = false
          if ('drawClipping' in renderer.skeletonDebugRenderer) {
            renderer.skeletonDebugRenderer.drawClipping = currentDebugOptions.showClipping
          }
          renderer.drawSkeletonDebug(skeleton, premultipliedAlpha)
        }
        drawPointAttachments()
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
            const track = { trackIndex: 0, animationName: name, loop, mixDuration: 0 }
            applyTrackAnimation(track)
            appliedTrackEntries = [track]
          }
        },
        setTracks: (tracks: SpineTrackEntry[]) => {
          syncTracks(tracks)
        },
        setSkin: (name: string) => {
          applySkin(name)
        },
        setPlayback: (enabled: boolean, nextRate: number) => {
          playbackEnabled = enabled
          playbackRate = nextRate
        },
        setPremultipliedAlpha: (value: boolean) => {
          premultipliedAlpha = value
        },
        setDebugOptions: (options: SpineDebugOptions) => {
          currentDebugOptions = options
        },
        setTextureFiltering: (filtering: SpineTextureFiltering) => {
          applyTextureFiltering(filtering)
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
          context = new spine.ManagedWebGLRenderingContext(input.canvas, { alpha: true, premultipliedAlpha: input.premultipliedAlpha ?? true })
          renderer = new spine.SceneRenderer(input.canvas, context)

          // 3.8 TextureAtlas uses a synchronous textureLoader callback per atlas page
          atlas = new spine.TextureAtlas(atlasText, (name: string) => {
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

          applyTextureFiltering(currentTextureFiltering)

          const atlasLoader = new spine.AtlasAttachmentLoader(atlas)
          const skeletonJson = new spine.SkeletonJson(atlasLoader)
          const skeletonData = skeletonJson.readSkeletonData(skeletonText)

          skeleton = new spine.Skeleton(skeletonData)
          availableSkins = Array.isArray(skeletonData.skins)
            ? skeletonData.skins
                .map((skin: any) => skin?.name)
                .filter((skinName: string | undefined): skinName is string => !!skinName)
            : []
          currentSkinName = (
            (input.skinName && availableSkins.includes(input.skinName) && input.skinName)
            || skeletonData.defaultSkin?.name
            || availableSkins[0]
            || ''
          )
          if (currentSkinName) {
            applySkin(currentSkinName)
          }
          const animationStateData = new spine.AnimationStateData(skeletonData)
          animationState = new spine.AnimationState(animationStateData)
          attachAnimationListener()

          const animationSummaries = extractAnimationSummaries(skeletonData.animations, spine)
          const animations: string[] = animationSummaries.map(animation => animation.name)
          const initialTracks = (input.animationTracks?.length
            ? input.animationTracks.filter(track => animations.includes(track.animationName))
            : []
          )
          const firstAnim = (input.animationName && animations.includes(input.animationName))
            ? input.animationName
            : initialTracks[0]?.animationName || animations[0]

          if (initialTracks.length > 0) {
            syncTracks(initialTracks)
          } else if (firstAnim) {
            const track = { trackIndex: 0, animationName: firstAnim, loop: true, mixDuration: 0 }
            applyTrackAnimation(track)
            appliedTrackEntries = [track]
          }

          renderer.resize(spine.ResizeMode.Expand)

          input.onLoaded({
            animations,
            animationSummaries,
            skins: availableSkins,
            currentSkin: currentSkinName,
            skeletonName: skeletonData.name || 'spine',
            drawCall: 0,
            duration: animationSummaries.find(animation => animation.name === firstAnim)?.duration || 0,
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
