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
import { Spine3RuntimeAdapter, Spine4RuntimeAdapter } from '../lib/spine/adapters'
import { detectSpineVersion } from '../lib/spine/versionDetection'
import type { SpineSelectionState, SpineSkeletonStructure } from '../lib/spine/skeletonStructure'
import type { SpineRuntimeSession } from '../lib/spine/adapters'
import type { SpineVersionMode } from '../lib/spine/versionDetection'

const props = defineProps<{
  files?: File[]
  versionMode?: SpineVersionMode
  animationName?: string
  isPlaying?: boolean
  playbackRate?: number
  showBones?: boolean
  showSlots?: boolean
  selection?: SpineSelectionState
}>()

const emit = defineEmits<{
  (e: 'loaded', data: {
    animations: string[]
    skeletonName: string
    drawCall: number
    duration: number
    structure: SpineSkeletonStructure
  }): void
  (e: 'error', error: string): void
  (e: 'timeUpdate', currentTime: number, duration: number, drawCall: number): void
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

let activeSession: SpineRuntimeSession | null = null
let loadRequestId = 0
let activePointerId: number | null = null
let lastPointerPosition = { x: 0, y: 0 }
let resizeObserver: ResizeObserver | null = null

const runtimeAdapters = {
  3: new Spine3RuntimeAdapter(),
  4: new Spine4RuntimeAdapter()
} as const
const hasValidBounds = computed(() => currentBounds.value.width > 0 && currentBounds.value.height > 0)
const showViewportOverlay = computed(() => {
  return isViewerReady.value && hasValidBounds.value && !loading.value && !errorMsg.value
})
const zoomPercent = computed(() => `${Math.round(viewScale.value * 100)}%`)
const offsetXPercent = computed(() => formatOffsetPercent(panOffset.value.x, currentBounds.value.width))
const offsetYPercent = computed(() => formatOffsetPercent(panOffset.value.y, currentBounds.value.height))

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

  activeSession.setPlayback(props.isPlaying !== false, props.playbackRate || 1)
  activeSession.setDebugOptions({
    showBones: !!props.showBones,
    showSlots: !!props.showSlots
  })
  activeSession.setSelection(props.selection || { boneName: null, slotName: null })
  viewScale.value = activeSession.getViewScale()
}

const seekTo = (time: number) => {
  activeSession?.seekTo(time)
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
    const detection = await detectSpineVersion(props.files, props.versionMode || 'auto')
    if (requestId !== loadRequestId) return

    const adapter = runtimeAdapters[detection.selectedVersion]
    const session = await adapter.createSession({
      canvas: canvasRef.value,
      sourceFiles: detection.sourceFiles,
      animationName: props.animationName,
      onLoaded: (data) => {
        if (requestId !== loadRequestId) return
        isViewerReady.value = true
        loading.value = false
        emit('loaded', data)
      },
      onError: (message) => {
        if (requestId !== loadRequestId) return
        setLoadError(message)
      },
      onTimeUpdate: (time, duration, drawCall) => {
        if (requestId !== loadRequestId) return
        emit('timeUpdate', time, duration, drawCall)
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

watch(() => props.versionMode, () => {
  if (props.files?.length) {
    loadSpine()
  }
})

watch(() => props.animationName, (animName) => {
  if (animName && activeSession) {
    activeSession.setAnimation(animName, true)
  }
})

watch([() => props.isPlaying, () => props.playbackRate], () => {
  activeSession?.setPlayback(props.isPlaying !== false, props.playbackRate || 1)
})

watch([() => props.showBones, () => props.showSlots], () => {
  activeSession?.setDebugOptions({
    showBones: !!props.showBones,
    showSlots: !!props.showSlots
  })
})

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
  const nextScale = Math.min(10, Math.max(0.2, activeSession.getViewScale() * zoomDelta))
  activeSession.adjustViewScale(nextScale)
  viewScale.value = nextScale
}

const handlePointerDown = (event: PointerEvent) => {
  if (!canvasRef.value || !activeSession) return

  activePointerId = event.pointerId
  lastPointerPosition = { x: event.clientX, y: event.clientY }
  isPanning.value = true
  canvasRef.value.setPointerCapture(event.pointerId)
}

const handlePointerMove = (event: PointerEvent) => {
  if (!isPanning.value || activePointerId !== event.pointerId || !activeSession) return

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
  if (activePointerId !== event.pointerId) return

  if (canvasRef.value?.hasPointerCapture(event.pointerId)) {
    canvasRef.value.releasePointerCapture(event.pointerId)
  }

  activePointerId = null
  isPanning.value = false
}

defineExpose({
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
  padding: 16px 24px;
  border-radius: 8px;
  font-size: 14px;
}

.loading-overlay {
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
}

.error-overlay {
  background: rgba(255, 50, 50, 0.8);
  color: #ffaaaa;
}

.viewport-overlay {
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.68);
  color: #f3f3f3;
  backdrop-filter: blur(8px);
}

.viewport-metrics {
  display: flex;
  gap: 10px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.reset-view-btn {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
}

.reset-view-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}
</style>
