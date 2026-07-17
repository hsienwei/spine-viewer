<template>
  <div class="spine-canvas-container">
    <canvas
      :key="canvasKey"
      ref="canvasRef"
      class="spine-canvas"
      :class="{ 'is-dragging': isPanning }"
      @wheel.prevent="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @pointerleave="handlePointerUp"
      @touchstart.prevent="handleTouchStart"
      @touchmove.prevent="handleTouchMove"
      @touchend.prevent="handleTouchEnd"
      @touchcancel.prevent="handleTouchEnd"
    ></canvas>
    <div v-if="loading" class="loading-overlay">
      <span>Loading...</span>
    </div>
    <div v-if="errorMsg" class="error-overlay">
      <span>{{ errorMsg }}</span>
    </div>
    <div v-if="showViewportOverlay" class="viewport-overlay">
      <div class="viewport-metrics">
        <span>Zoom {{ zoomPercent }}</span>
        <span>X {{ offsetXPercent }}</span>
        <span>Y {{ offsetYPercent }}</span>
      </div>
      <button class="reset-view-btn" type="button" @click="resetView">
        Reset View
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { DEFAULT_SPINE_DEBUG_OPTIONS, DEFAULT_SPINE_TEXTURE_FILTERING, Spine3RuntimeAdapter, Spine4RuntimeAdapter } from '../lib/spine/adapters'
import { detectSpineVersion } from '../lib/spine/versionDetection'
import type { SpineSelectionState, SpineSkeletonStructure } from '../lib/spine/skeletonStructure'
import type { SpineAnimationEventPayload, SpineAnimationSummary, SpineDebugOptions, SpineRuntimeSession, SpineTextureFiltering, SpineTrackEntry, SpineTrackPlaybackState } from '../lib/spine/adapters'
import type { SpineDetectedVersion, SpineMajorVersion } from '../lib/spine/versionDetection'

const props = defineProps<{
  files?: File[]
  animationName?: string
  animationTracks?: SpineTrackEntry[]
  skinName?: string
  isPlaying?: boolean
  playbackRate?: number
  debugOptions?: Partial<SpineDebugOptions>
  selection?: SpineSelectionState
  premultipliedAlpha?: boolean
  textureFiltering?: SpineTextureFiltering
}>()

const emit = defineEmits<{
  (e: 'loaded', data: {
    animations: string[]
    animationSummaries: SpineAnimationSummary[]
    skins: string[]
    currentSkin: string
    skeletonName: string
    drawCall: number
    duration: number
    structure: SpineSkeletonStructure
    detectedVersion: SpineDetectedVersion
    initialRuntimeVersion: SpineMajorVersion
    runtimeVersion: SpineMajorVersion
    fallbackUsed: boolean
  }): void
  (e: 'error', error: string): void
  (e: 'timeUpdate', state: {
    currentTime: number
    duration: number
    drawCall: number
    tracks: SpineTrackPlaybackState[]
  }): void
  (e: 'runtimeEvent', payload: SpineAnimationEventPayload): void
  (e: 'canvas-tap'): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasKey = ref(0)
const loading = ref(false)
const errorMsg = ref('')
const isViewerReady = ref(false)
const isPanning = ref(false)
const currentBounds = ref({ width: 0, height: 0 })
const panOffset = ref({ x: 0, y: 0 })
const viewScale = ref(1)
const MIN_VIEW_SCALE = 0.2
const MAX_VIEW_SCALE = 10

let activeSession: SpineRuntimeSession | null = null
let loadRequestId = 0
let activePointerId: number | null = null
let lastPointerPosition = { x: 0, y: 0 }
let resizeObserver: ResizeObserver | null = null
const activePointers = new Map<number, { x: number; y: number }>()
let pinchDistance: number | null = null
let isTouchGestureActive = false
let touchStartPosition: { x: number; y: number } | null = null
let didTouchMove = false

const runtimeAdapters = {
  3: new Spine3RuntimeAdapter(),
  4: new Spine4RuntimeAdapter()
} as const

interface LoadAttemptFailure {
  version: SpineMajorVersion
  message: string
}

const parseDebugRuntime = (value: string | null): SpineMajorVersion | null => {
  if (value === '3') return 3
  if (value === '4') return 4
  return null
}

const getDebugRuntimeOverrides = () => {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return {
      primaryRuntime: null as SpineMajorVersion | null,
      failRuntime: null as SpineMajorVersion | null
    }
  }

  const params = new URLSearchParams(window.location.search)
  return {
    primaryRuntime: parseDebugRuntime(params.get('debugPrimaryRuntime')),
    failRuntime: parseDebugRuntime(params.get('debugFailRuntime'))
  }
}

const hasValidBounds = computed(() => currentBounds.value.width > 0 && currentBounds.value.height > 0)
const showViewportOverlay = computed(() => {
  return isViewerReady.value && hasValidBounds.value && !loading.value && !errorMsg.value
})
const zoomPercent = computed(() => `${Math.round(viewScale.value * 100)}%`)
const offsetXPercent = computed(() => formatOffsetPercent(panOffset.value.x, currentBounds.value.width))
const offsetYPercent = computed(() => formatOffsetPercent(panOffset.value.y, currentBounds.value.height))

const getDebugOptions = (): SpineDebugOptions => ({
  ...DEFAULT_SPINE_DEBUG_OPTIONS,
  ...props.debugOptions
})

const getTextureFiltering = (): SpineTextureFiltering => {
  return props.textureFiltering ?? DEFAULT_SPINE_TEXTURE_FILTERING
}

const setLoadError = (message: string) => {
  errorMsg.value = message
  isViewerReady.value = false
  loading.value = false
  emit('error', message)
}

const disposeCurrentSession = () => {
  activeSession?.dispose()
  activeSession = null
  isViewerReady.value = false
  currentBounds.value = { width: 0, height: 0 }
  panOffset.value = { x: 0, y: 0 }
  viewScale.value = 1
  // 強制重建 canvas 元素，避免舊 WebGL context 干擾新 session
  canvasKey.value += 1
}

const syncSessionState = () => {
  if (!activeSession) return

  activeSession.setTracks(props.animationTracks || [])
  activeSession.setPlayback(props.isPlaying !== false, props.playbackRate || 1)
  if (props.skinName) {
    activeSession.setSkin(props.skinName)
  }
  activeSession.setDebugOptions(getDebugOptions())
  activeSession.setTextureFiltering(getTextureFiltering())
  activeSession.setSelection(props.selection || { boneName: null, slotName: null })
  activeSession.setPremultipliedAlpha(props.premultipliedAlpha ?? true)
  viewScale.value = activeSession.getViewScale()
}

const seekTo = (time: number, trackIndex = 0) => {
  activeSession?.seekTo(time, trackIndex)
}

const resetView = () => {
  activeSession?.resetView()
  panOffset.value = { x: 0, y: 0 }
  viewScale.value = activeSession?.getViewScale() || 1
}

const formatOffsetPercent = (offset: number, size: number): string => {
  if (!size) return '0%'
  const percent = (offset / size) * 100
  const rounded = Math.round(percent * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

const getCanvasScreenPoint = (clientX: number, clientY: number) => {
  const canvas = canvasRef.value
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return null

  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height
  }
}

const clampViewScale = (scale: number) => {
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale))
}

const getPinchMetrics = () => {
  if (activePointers.size < 2) return null

  const [firstPointer, secondPointer] = Array.from(activePointers.values())
  const dx = secondPointer.x - firstPointer.x
  const dy = secondPointer.y - firstPointer.y

  return {
    distance: Math.hypot(dx, dy),
    midpoint: {
      x: (firstPointer.x + secondPointer.x) / 2,
      y: (firstPointer.y + secondPointer.y) / 2
    }
  }
}

const getTouchMetrics = (touches: TouchList) => {
  if (touches.length < 2) return null

  const firstTouch = touches[0]
  const secondTouch = touches[1]
  const dx = secondTouch.clientX - firstTouch.clientX
  const dy = secondTouch.clientY - firstTouch.clientY

  return {
    distance: Math.hypot(dx, dy),
    midpoint: {
      x: (firstTouch.clientX + secondTouch.clientX) / 2,
      y: (firstTouch.clientY + secondTouch.clientY) / 2
    }
  }
}

const zoomAtClientPoint = (nextScale: number, clientX: number, clientY: number) => {
  if (!activeSession) return

  const clampedScale = clampViewScale(nextScale)
  const anchorPoint = getCanvasScreenPoint(clientX, clientY)
  const worldBeforeZoom = anchorPoint
    ? activeSession.screenToWorld(anchorPoint.x, anchorPoint.y)
    : null

  activeSession.adjustViewScale(clampedScale)
  viewScale.value = activeSession.getViewScale()

  if (!anchorPoint || !worldBeforeZoom) return

  const worldAfterZoom = activeSession.screenToWorld(anchorPoint.x, anchorPoint.y)
  if (!worldAfterZoom) return

  const dx = worldBeforeZoom.x - worldAfterZoom.x
  const dy = worldBeforeZoom.y - worldAfterZoom.y
  activeSession.panBy(dx, dy)
  panOffset.value = {
    x: panOffset.value.x + dx,
    y: panOffset.value.y + dy
  }
}

const loadSpine = async () => {
  if (!props.files?.length || !canvasRef.value) return

  const requestId = ++loadRequestId
  loading.value = true
  errorMsg.value = ''
  disposeCurrentSession()
  loading.value = true

  // 等 Vue 重建 canvas 元素後再繼續（canvasKey 已變）
  await nextTick()
  if (requestId !== loadRequestId || !canvasRef.value) return

  try {
    const detection = await detectSpineVersion(props.files, 'auto')
    if (requestId !== loadRequestId) return

    const debugRuntime = getDebugRuntimeOverrides()
    const primaryVersion = debugRuntime.primaryRuntime ?? detection.selectedVersion
    const fallbackVersions = debugRuntime.primaryRuntime && debugRuntime.primaryRuntime !== detection.selectedVersion
      ? [detection.selectedVersion, ...detection.fallbackCandidates]
      : detection.fallbackCandidates
    const candidateVersions = [primaryVersion, ...fallbackVersions]
      .filter((version, index, arr) => arr.indexOf(version) === index)
    const failures: LoadAttemptFailure[] = []

    for (const version of candidateVersions) {
      let attemptError = ''
      let loaded = false

      try {
        if (debugRuntime.failRuntime === version) {
          throw new Error(`[DEV] Forced Spine ${version}.x failure for fallback testing`)
        }

        const session = await runtimeAdapters[version].createSession({
          canvas: canvasRef.value,
          sourceFiles: detection.sourceFiles,
          animationName: props.animationName,
          animationTracks: props.animationTracks,
          skinName: props.skinName,
          premultipliedAlpha: props.premultipliedAlpha ?? true,
          textureFiltering: getTextureFiltering(),
          onLoaded: (data) => {
            if (requestId !== loadRequestId) return
            loaded = true
            isViewerReady.value = true
            loading.value = false
            emit('loaded', {
              ...data,
              detectedVersion: detection.detectedVersion,
              initialRuntimeVersion: primaryVersion,
              runtimeVersion: version,
              fallbackUsed: version !== primaryVersion
            })
          },
          onError: (message) => {
            attemptError = message
          },
          onAnimationEvent: (payload) => {
            if (requestId !== loadRequestId) return
            emit('runtimeEvent', payload)
          },
          onTimeUpdate: (state) => {
            if (requestId !== loadRequestId) return
            emit('timeUpdate', state)
          },
          onViewState: (state) => {
            if (requestId !== loadRequestId) return
            currentBounds.value = state.bounds
            panOffset.value = state.panOffset
            viewScale.value = state.viewScale
          }
        })

        if (requestId !== loadRequestId) {
          session.dispose()
          return
        }

        activeSession = session
        syncSessionState()
        return
      } catch (error) {
        if (requestId !== loadRequestId) return

        const message = attemptError || (error instanceof Error ? error.message : `Failed to initialize Spine ${version}.x runtime`)
        failures.push({ version, message })

        if (loaded) {
          return
        }
      }
    }

    const finalMessage = failures.length > 0
      ? failures.map(({ version, message }) => `Spine ${version}.x: ${message}`).join('\n')
      : 'Failed to load'
    setLoadError(finalMessage)
  } catch (e) {
    if (requestId === loadRequestId) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load')
    }
  }
}

watch(() => props.files, (files) => {
  if (files?.length) {
    loadSpine()
    return
  }

  loadRequestId += 1
  disposeCurrentSession()
  errorMsg.value = ''
}, { deep: false })

watch(() => props.animationTracks, (tracks) => {
  activeSession?.setTracks(tracks || [])
}, { deep: true })

watch(() => props.animationName, (animName) => {
  if (animName && activeSession && !(props.animationTracks?.length)) {
    activeSession.setAnimation(animName, true)
  }
})

watch(() => props.skinName, (skinName) => {
  if (skinName && activeSession) {
    activeSession.setSkin(skinName)
  }
})

watch([() => props.isPlaying, () => props.playbackRate], () => {
  activeSession?.setPlayback(props.isPlaying !== false, props.playbackRate || 1)
})

watch(() => props.premultipliedAlpha, (value) => {
  activeSession?.setPremultipliedAlpha(value ?? true)
})

watch(() => props.textureFiltering, (value) => {
  activeSession?.setTextureFiltering(value ?? DEFAULT_SPINE_TEXTURE_FILTERING)
})

watch(() => props.debugOptions, () => {
  activeSession?.setDebugOptions(getDebugOptions())
}, { deep: true })

watch(() => props.selection, (selection) => {
  activeSession?.setSelection(selection || { boneName: null, slotName: null })
}, { deep: false })

onMounted(() => {
  if (props.files?.length) {
    loadSpine()
  }

  if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
    resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(canvasRef.value)
  } else {
    window.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  loadRequestId += 1
  disposeCurrentSession()
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  activeSession?.resize()
}

const handleWheel = (event: WheelEvent) => {
  if (!activeSession) return

  const zoomDelta = event.deltaY < 0 ? 1.1 : 0.9
  zoomAtClientPoint(activeSession.getViewScale() * zoomDelta, event.clientX, event.clientY)
}

const handlePointerDown = (event: PointerEvent) => {
  if (!canvasRef.value || !activeSession) return
  if (isTouchGestureActive || event.pointerType === 'touch') return

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  canvasRef.value.setPointerCapture(event.pointerId)

  if (activePointers.size === 1) {
    activePointerId = event.pointerId
    lastPointerPosition = { x: event.clientX, y: event.clientY }
    isPanning.value = true
    pinchDistance = null
    return
  }

  if (activePointers.size >= 2) {
    activePointerId = null
    isPanning.value = false
    pinchDistance = getPinchMetrics()?.distance ?? null
  }
}

const handlePointerMove = (event: PointerEvent) => {
  if (isTouchGestureActive || event.pointerType === 'touch') return
  if (!activeSession || !activePointers.has(event.pointerId)) return

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (activePointers.size >= 2) {
    const pinchMetrics = getPinchMetrics()
    if (!pinchMetrics) return

    if (pinchDistance && pinchMetrics.distance > 0) {
      const scaleFactor = pinchMetrics.distance / pinchDistance
      zoomAtClientPoint(
        activeSession.getViewScale() / scaleFactor,
        pinchMetrics.midpoint.x,
        pinchMetrics.midpoint.y
      )
    }

    pinchDistance = pinchMetrics.distance
    return
  }

  if (!isPanning.value || activePointerId !== event.pointerId) return

  const previousPoint = getCanvasScreenPoint(lastPointerPosition.x, lastPointerPosition.y)
  const currentPoint = getCanvasScreenPoint(event.clientX, event.clientY)

  if (!previousPoint || !currentPoint) return

  const previousWorld = activeSession.screenToWorld(previousPoint.x, previousPoint.y)
  const currentWorld = activeSession.screenToWorld(currentPoint.x, currentPoint.y)

  if (!previousWorld || !currentWorld) return

  const dx = previousWorld.x - currentWorld.x
  const dy = previousWorld.y - currentWorld.y
  activeSession.panBy(dx, dy)
  panOffset.value = {
    x: panOffset.value.x + dx,
    y: panOffset.value.y + dy
  }

  lastPointerPosition = { x: event.clientX, y: event.clientY }
}

const handlePointerUp = (event: PointerEvent) => {
  if (isTouchGestureActive || event.pointerType === 'touch') return
  activePointers.delete(event.pointerId)

  if (canvasRef.value?.hasPointerCapture(event.pointerId)) {
    canvasRef.value.releasePointerCapture(event.pointerId)
  }

  if (activePointers.size >= 2) {
    activePointerId = null
    isPanning.value = false
    pinchDistance = getPinchMetrics()?.distance ?? null
    return
  }

  if (activePointers.size === 1) {
    const [pointerId, pointerPosition] = Array.from(activePointers.entries())[0]
    activePointerId = pointerId
    lastPointerPosition = { x: pointerPosition.x, y: pointerPosition.y }
    isPanning.value = true
    pinchDistance = null
    return
  }

  activePointerId = null
  isPanning.value = false
  pinchDistance = null
}

const handleTouchStart = (event: TouchEvent) => {
  if (!activeSession) return

  isTouchGestureActive = true

  if (event.touches.length >= 2) {
    didTouchMove = true
    isPanning.value = false
    activePointerId = null
    pinchDistance = getTouchMetrics(event.touches)?.distance ?? null
    return
  }

  if (event.touches.length === 1) {
    const touch = event.touches[0]
    touchStartPosition = { x: touch.clientX, y: touch.clientY }
    didTouchMove = false
    lastPointerPosition = { x: touch.clientX, y: touch.clientY }
    isPanning.value = true
    pinchDistance = null
  }
}

const handleTouchMove = (event: TouchEvent) => {
  if (!activeSession) return

  if (event.touches.length >= 2) {
    const touchMetrics = getTouchMetrics(event.touches)
    if (!touchMetrics) return

    if (pinchDistance && touchMetrics.distance > 0) {
      const scaleFactor = touchMetrics.distance / pinchDistance
      zoomAtClientPoint(
        activeSession.getViewScale() / scaleFactor,
        touchMetrics.midpoint.x,
        touchMetrics.midpoint.y
      )
    }

    pinchDistance = touchMetrics.distance
    isPanning.value = false
    return
  }

  if (event.touches.length !== 1 || !isPanning.value) return

  const touch = event.touches[0]
  if (touchStartPosition && Math.hypot(touch.clientX - touchStartPosition.x, touch.clientY - touchStartPosition.y) > 8) {
    didTouchMove = true
  }
  const previousPoint = getCanvasScreenPoint(lastPointerPosition.x, lastPointerPosition.y)
  const currentPoint = getCanvasScreenPoint(touch.clientX, touch.clientY)

  if (!previousPoint || !currentPoint) return

  const previousWorld = activeSession.screenToWorld(previousPoint.x, previousPoint.y)
  const currentWorld = activeSession.screenToWorld(currentPoint.x, currentPoint.y)

  if (!previousWorld || !currentWorld) return

  const dx = previousWorld.x - currentWorld.x
  const dy = previousWorld.y - currentWorld.y
  activeSession.panBy(dx, dy)
  panOffset.value = {
    x: panOffset.value.x + dx,
    y: panOffset.value.y + dy
  }
  lastPointerPosition = { x: touch.clientX, y: touch.clientY }
}

const handleTouchEnd = (event: TouchEvent) => {
  if (event.touches.length >= 2) {
    pinchDistance = getTouchMetrics(event.touches)?.distance ?? null
    isPanning.value = false
    return
  }

  if (event.touches.length === 1) {
    const touch = event.touches[0]
    lastPointerPosition = { x: touch.clientX, y: touch.clientY }
    pinchDistance = null
    isPanning.value = true
    return
  }

  isTouchGestureActive = false
  pinchDistance = null
  isPanning.value = false
  if (!didTouchMove) emit('canvas-tap')
  touchStartPosition = null
  didTouchMove = false
}

defineExpose({
  getCanvasElement: () => canvasRef.value,
  seekTo,
  resetView
})
</script>

<style scoped>
.spine-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.spine-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: grab;
  touch-action: none;
}

.spine-canvas.is-dragging {
  cursor: grabbing;
}

.loading-overlay,
.error-overlay,
.viewport-overlay {
  position: absolute;
  z-index: 10;
}

.loading-overlay,
.error-overlay {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.loading-overlay {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  background: var(--bg-overlay);
  border: 1px solid var(--border);
  backdrop-filter: blur(12px);
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-secondary);
  letter-spacing: 0.06em;
}

.loading-overlay::before {
  content: '';
  display: block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-overlay {
  padding: 14px 20px;
  border-radius: var(--radius-md);
  background: var(--bg-overlay);
  border: 1px solid rgba(196, 107, 90, 0.4);
  backdrop-filter: blur(12px);
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--danger);
  max-width: 320px;
  text-align: center;
}

.viewport-overlay {
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-md);
  background: var(--bg-overlay);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
}

.viewport-metrics {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.reset-view-btn {
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 10px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: border-color var(--transition), color var(--transition), background var(--transition);
}

.reset-view-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

</style>
