import { createSpineResolvedResources } from '../fileResources'
import { buildSkeletonStructure } from '../skeletonStructure'
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
      let atlas: any = null
      let skeleton: any = null
      let animationState: any = null
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
        if (spineCanvas) {
          spineCanvas.dispose()
          spineCanvas = null
        }
        atlas = null
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
      const getTrackPlaybackStates = () => {
        const states = new Map<number, { trackIndex: number; animationName: string | null; currentTime: number; duration: number }>()

        for (const track of appliedTrackEntries) {
          states.set(track.trackIndex, {
            trackIndex: track.trackIndex,
            animationName: track.animationName || null,
            currentTime: 0,
            duration: 0
          })
        }

        for (let trackIndex = 0; trackIndex < 32; trackIndex += 1) {
          const entry = animationState?.getCurrent(trackIndex)
          if (!entry) continue

          const duration = entry.animation?.duration || 0
          const currentTime = duration > 0 ? (entry.trackTime % duration) : entry.trackTime
          states.set(trackIndex, {
            trackIndex,
            animationName: entry.animation?.name ?? null,
            currentTime,
            duration
          })
        }

        return [...states.values()].sort((a, b) => a.trackIndex - b.trackIndex)
      }

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
        skeleton?.updateWorldTransform(spine.Physics.update)
      }

      const applySkin = (name: string | null | undefined) => {
        if (!skeleton || !name || !availableSkins.includes(name)) return

        skeleton.setSkinByName(name)
        currentSkinName = name
        skeleton.setSlotsToSetupPose()
        animationState?.apply(skeleton)
        updateSkeletonWorldTransform()
      }

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

      const applyTextureFiltering = (filtering: SpineTextureFiltering) => {
        currentTextureFiltering = filtering

        if (!atlas?.pages?.length) return

        const minFilter = filtering === 'nearest' ? spine.TextureFilter.Nearest : spine.TextureFilter.Linear
        const magFilter = filtering === 'nearest' ? spine.TextureFilter.Nearest : spine.TextureFilter.Linear

        for (const page of atlas.pages) {
          page.texture?.setFilters(minFilter, magFilter)
        }
      }

      const createSession = (): SpineRuntimeSession => ({
        version: 4,
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
        seekTo: (time: number, trackIndex = 0) => {
          const track = animationState?.getCurrent(trackIndex) || null
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

          atlas = new spine.TextureAtlas(atlasText)

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
          const animations = animationSummaries.map(animation => animation.name)
          const initialTracks = (input.animationTracks?.length
            ? input.animationTracks.filter(track => animations.includes(track.animationName))
            : []
          )
          const firstAnim = (input.animationName && animations.includes(input.animationName))
            ? input.animationName
            : initialTracks[0]?.animationName || animations[0]

          if (initialTracks.length > 0) {
            syncTracks(initialTracks)
          } else if (firstAnim && animationState) {
            const track = { trackIndex: 0, animationName: firstAnim, loop: true, mixDuration: 0 }
            applyTrackAnimation(track)
            appliedTrackEntries = [track]
          }

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
        updateSkeletonWorldTransform()

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
        if (currentDebugOptions.showAxes) {
          drawWorldAxes(sc)
        }
        sc.renderer.drawSkeleton(skeleton, premultipliedAlpha)
        if (hasSkeletonDebugEnabled()) {
          sc.renderer.skeletonDebugRenderer.drawBones = currentDebugOptions.showBones
          sc.renderer.skeletonDebugRenderer.drawRegionAttachments = currentDebugOptions.showRegions
          sc.renderer.skeletonDebugRenderer.drawBoundingBoxes = currentDebugOptions.showBounds
          sc.renderer.skeletonDebugRenderer.drawMeshHull = currentDebugOptions.showMeshHull
          sc.renderer.skeletonDebugRenderer.drawMeshTriangles = currentDebugOptions.showMeshTriangles
          sc.renderer.skeletonDebugRenderer.drawPaths = currentDebugOptions.showPaths
          sc.renderer.skeletonDebugRenderer.drawSkeletonXY = false
          sc.renderer.skeletonDebugRenderer.drawClipping = currentDebugOptions.showClipping
          sc.renderer.drawSkeletonDebug(skeleton, premultipliedAlpha)
        }
        drawPointAttachments(sc)
        drawSelectionHighlight(sc)
        const frameDrawCall = sc.renderer.batcher.getDrawCalls()
        sc.renderer.end()

        input.onTimeUpdate({
          currentTime,
          duration: animationDuration,
          drawCall: frameDrawCall,
          tracks: getTrackPlaybackStates()
        })
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

      const drawPointAttachments = (sc: any) => {
        if (!currentDebugOptions.showPoints || !skeleton?.slots || !spine?.Vector2 || !spine?.PointAttachment) return

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

          sc.renderer.circle(false, worldPoint.x, worldPoint.y, 5, pointColor, 18)
          sc.renderer.circle(true, worldPoint.x, worldPoint.y, 2.2, pointColor, 12)
          sc.renderer.line(worldPoint.x, worldPoint.y, endX, endY, directionColor, directionColor)

          const leftX = endX - Math.cos(rotation - Math.PI / 6) * arrowSize
          const leftY = endY - Math.sin(rotation - Math.PI / 6) * arrowSize
          const rightX = endX - Math.cos(rotation + Math.PI / 6) * arrowSize
          const rightY = endY - Math.sin(rotation + Math.PI / 6) * arrowSize

          sc.renderer.line(endX, endY, leftX, leftY, directionColor, directionColor)
          sc.renderer.line(endX, endY, rightX, rightY, directionColor, directionColor)
        }
      }

      const drawWorldAxes = (sc: any) => {
        const camera = sc?.renderer?.camera
        if (!camera || !spine?.Vector3) return

        const overlay = createAxisOverlay({
          canvasWidth: input.canvas.width,
          canvasHeight: input.canvas.height,
          screenToWorld: (x, y) => {
            const point = camera.screenToWorld(
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

        sc.renderer.line(
          overlay.xAxis.x1,
          overlay.xAxis.y1,
          overlay.xAxis.x2,
          overlay.xAxis.y2,
          xAxisColor,
          xAxisColor
        )
        sc.renderer.line(
          overlay.yAxis.x1,
          overlay.yAxis.y1,
          overlay.yAxis.x2,
          overlay.yAxis.y2,
          yAxisColor,
          yAxisColor
        )
        sc.renderer.circle(true, 0, 0, 3.5, originColor, 18)
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
          webglConfig: { alpha: true, premultipliedAlpha: input.premultipliedAlpha ?? true }
        })
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Failed to load')
      }
    })
  }
}
