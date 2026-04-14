<template>
  <div class="spine-canvas-container">
    <canvas
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
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

let spine: any = null

const props = defineProps<{
  skeletonUrl?: string
  atlasUrl?: string
  textures?: string[]
  animationName?: string
  isPlaying?: boolean
  playbackRate?: number
  showBones?: boolean
  showSlots?: boolean
}>()

const emit = defineEmits<{
  (e: 'loaded', data: { animations: string[]; skeletonName: string; drawCall: number; duration: number }): void
  (e: 'error', error: string): void
  (e: 'timeUpdate', currentTime: number, duration: number, drawCall: number): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const errorMsg = ref('')

let spineCanvas: any = null
let skeleton: any = null
let animationState: any = null
let preloadedImages: Map<string, HTMLImageElement> = new Map()
const isViewerReady = ref(false)
const viewScale = ref(1)
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const currentBounds = ref({ width: 0, height: 0 })

let activePointerId: number | null = null
let lastPointerPosition = { x: 0, y: 0 }

const hasValidBounds = computed(() => currentBounds.value.width > 0 && currentBounds.value.height > 0)
const showViewportOverlay = computed(() => {
  return isViewerReady.value && hasValidBounds.value && !loading.value && !errorMsg.value
})
const FIT_PADDING_RATIO = 0.92
const zoomPercent = computed(() => `${Math.round(viewScale.value * 100)}%`)
const offsetXPercent = computed(() => formatOffsetPercent(panOffset.value.x, currentBounds.value.width))
const offsetYPercent = computed(() => formatOffsetPercent(panOffset.value.y, currentBounds.value.height))

const getCurrentTrack = () => animationState?.getCurrent(0) || null

const getAnimationDuration = (): number => {
  const track = getCurrentTrack()
  return track?.animation?.duration || 0
}

const seekTo = (time: number) => {
  const track = getCurrentTrack()
  if (!track || !skeleton || !animationState) return

  const duration = track.animation?.duration || 0
  const nextTime = duration > 0 ? Math.max(0, Math.min(time, duration)) : Math.max(0, time)
  track.trackTime = nextTime
  track.animationLast = nextTime
  animationState.apply(skeleton)
  skeleton.updateWorldTransform(spine.Physics.update)
}

const preloadTextures = async (): Promise<void> => {
  if (!props.textures || props.textures.length === 0) return
  
  const promises = props.textures.map((texUrl: string) => {
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const filename = texUrl.split('/').pop() || texUrl
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

const formatOffsetPercent = (offset: number, size: number): string => {
  if (!size) return '0%'
  const percent = (offset / size) * 100
  const rounded = Math.round(percent * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

const resetView = () => {
  viewScale.value = 1
  panOffset.value = { x: 0, y: 0 }
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
  if (!props.skeletonUrl || !props.atlasUrl || !canvasRef.value) return
  
  loading.value = true
  errorMsg.value = ''
  isViewerReady.value = false
  currentBounds.value = { width: 0, height: 0 }
  resetView()

  try {
    if (!spine) {
      const module = await import('@esotericsoftware/spine-webgl')
      spine = module
    }

    await preloadTextures()

    const canvas = canvasRef.value
    canvas.width = canvas.clientWidth * window.devicePixelRatio
    canvas.height = canvas.clientHeight * window.devicePixelRatio

    const app = {
      loadAssets: (sc: any) => {
        sc.assetManager.loadText(props.skeletonUrl!)
        sc.assetManager.loadText(props.atlasUrl!)
      },
      initialize: (sc: any) => {
        initializeSpine(sc)
      },
      render: (sc: any) => {
        renderSpine(sc)
      }
    }

    const config = {
      app,
      pathPrefix: '',
      webglConfig: { alpha: true }
    }

    spineCanvas = new spine.SpineCanvas(canvas, config)
    
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load'
    isViewerReady.value = false
    emit('error', errorMsg.value)
  }
  
  loading.value = false
}

const initializeSpine = (sc: any) => {
  try {
    const atlasText = sc.assetManager.get(props.atlasUrl!)
    const skeletonText = sc.assetManager.get(props.skeletonUrl!)

    if (!atlasText || !skeletonText) {
      errorMsg.value = 'Failed to load assets'
      return
    }

    // TextureAtlas 只接受 atlasText，不接受 callback
    const atlas = new spine.TextureAtlas(atlasText)

    // 為每個 atlas page 設定對應的 GLTexture
    for (const page of atlas.pages) {
      const img = preloadedImages.get(page.name)
        || preloadedImages.get(page.name + '.png')
        || preloadedImages.get(page.name + '.jpg')
        || Array.from(preloadedImages.values())[0]

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
    const firstAnim = props.animationName || animations[0]
    
    if (firstAnim && animationState) {
      animationState.setAnimation(0, firstAnim, true)
    }

    const animData = skeletonData.animations.find((a: any) => a.name === firstAnim)
    const duration = animData?.duration || 0
    isViewerReady.value = true

    emit('loaded', {
      animations,
      skeletonName: skeletonData.name || 'spine',
      drawCall: 0,
      duration
    })

  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to initialize'
    isViewerReady.value = false
    emit('error', errorMsg.value)
  }
}

const renderSpine = (sc: any) => {
  if (!skeleton || !animationState || !sc.renderer) return

  const delta = sc.time.delta
  const timeScale = props.isPlaying !== false ? (props.playbackRate || 1) : 0

  // 正確的 Spine 更新順序：update → apply → updateWorldTransform
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

  // 根據骨架 bounds 自動定位攝影機
  const bounds = skeleton.getBoundsRect()
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    const camera = sc.renderer.camera
    const canvasWidth = sc.htmlCanvas.width
    const canvasHeight = sc.htmlCanvas.height
    currentBounds.value = { width: bounds.width, height: bounds.height }

    camera.position.x = bounds.x + bounds.width / 2 + panOffset.value.x
    camera.position.y = bounds.y + bounds.height / 2 + panOffset.value.y

    const scaleX = (canvasWidth / bounds.width) * FIT_PADDING_RATIO
    const scaleY = (canvasHeight / bounds.height) * FIT_PADDING_RATIO
    camera.zoom = Math.min(scaleX, scaleY) * viewScale.value

    camera.update()
  }

  sc.clear(0.15, 0.15, 0.15, 1)

  sc.renderer.begin()
  sc.renderer.drawSkeleton(skeleton, true)
  if (props.showBones || props.showSlots) {
    sc.renderer.skeletonDebugRenderer.drawBones = !!props.showBones
    sc.renderer.skeletonDebugRenderer.drawRegionAttachments = !!props.showSlots
    sc.renderer.skeletonDebugRenderer.drawBoundingBoxes = false
    sc.renderer.skeletonDebugRenderer.drawMeshHull = false
    sc.renderer.skeletonDebugRenderer.drawMeshTriangles = false
    sc.renderer.skeletonDebugRenderer.drawPaths = false
    sc.renderer.skeletonDebugRenderer.drawSkeletonXY = false
    sc.renderer.skeletonDebugRenderer.drawClipping = false
    sc.renderer.drawSkeletonDebug(skeleton, true)
  }
  const frameDrawCall = sc.renderer.batcher.getDrawCalls()
  sc.renderer.end()

  emit('timeUpdate', currentTime, animationDuration, frameDrawCall)
}

watch(() => props.skeletonUrl, (val) => {
  if (val && props.atlasUrl) loadSpine()
})

watch(() => props.animationName, (animName) => {
  if (animName && animationState) {
    animationState.setAnimation(0, animName, true)
  }
})

watch(() => props.isPlaying, (playing) => {
  if (playing === false) {
    const track = getCurrentTrack()
    if (track) {
      emit('timeUpdate', track.trackTime, getAnimationDuration(), 0)
    }
  }
})

onMounted(() => {
  if (props.skeletonUrl && props.atlasUrl) {
    loadSpine()
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (spineCanvas) {
    spineCanvas.dispose()
  }
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  if (canvasRef.value && spineCanvas) {
    const canvas = canvasRef.value
    canvas.width = canvas.clientWidth * window.devicePixelRatio
    canvas.height = canvas.clientHeight * window.devicePixelRatio
  }
}

const handleWheel = (event: WheelEvent) => {
  if (!skeleton) return

  const zoomDelta = event.deltaY < 0 ? 1.1 : 0.9
  viewScale.value = Math.min(10, Math.max(0.2, viewScale.value * zoomDelta))
}

const handlePointerDown = (event: PointerEvent) => {
  if (!canvasRef.value || !skeleton) return

  activePointerId = event.pointerId
  lastPointerPosition = { x: event.clientX, y: event.clientY }
  isPanning.value = true
  canvasRef.value.setPointerCapture(event.pointerId)
}

const handlePointerMove = (event: PointerEvent) => {
  if (!isPanning.value || activePointerId !== event.pointerId || !spineCanvas) return

  const camera = spineCanvas.renderer?.camera

  if (!camera?.zoom) return

  const previousPoint = getCanvasScreenPoint(lastPointerPosition.x, lastPointerPosition.y)
  const currentPoint = getCanvasScreenPoint(event.clientX, event.clientY)

  if (!previousPoint || !currentPoint || !spine?.Vector3) return

  const previousWorld = camera.screenToWorld(
    new spine.Vector3(previousPoint.x, previousPoint.y, 0),
    canvasRef.value!.width,
    canvasRef.value!.height
  )
  const currentWorld = camera.screenToWorld(
    new spine.Vector3(currentPoint.x, currentPoint.y, 0),
    canvasRef.value!.width,
    canvasRef.value!.height
  )

  panOffset.value = {
    x: panOffset.value.x + (previousWorld.x - currentWorld.x),
    y: panOffset.value.y + (previousWorld.y - currentWorld.y)
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
