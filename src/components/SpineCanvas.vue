<template>
  <div class="spine-canvas-container">
    <canvas ref="canvasRef" class="spine-canvas"></canvas>
    <div v-if="loading" class="loading-overlay">
      <span>Loading...</span>
    </div>
    <div v-if="errorMsg" class="error-overlay">
      <span>{{ errorMsg }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

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
  (e: 'timeUpdate', currentTime: number, duration: number): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const errorMsg = ref('')

let spineCanvas: any = null
let skeleton: any = null
let animationState: any = null
let preloadedImages: Map<string, HTMLImageElement> = new Map()

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

const loadSpine = async () => {
  if (!props.skeletonUrl || !props.atlasUrl || !canvasRef.value) return
  
  loading.value = true
  errorMsg.value = ''

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

    const atlas = new spine.TextureAtlas(atlasText, (pageName: string) => {
      const img = preloadedImages.get(pageName) 
        || preloadedImages.get(pageName + '.png')
        || preloadedImages.get(pageName + '.jpg')
        || Array.from(preloadedImages.values())[0]
      
      if (img) {
        return new spine.Texture(img)
      }
      
      console.warn(`No preloaded image for page: ${pageName}`)
      return null
    })

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

    emit('loaded', {
      animations,
      skeletonName: skeletonData.name || 'spine',
      drawCall: 0,
      duration
    })

  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to initialize'
    emit('error', errorMsg.value)
  }
}

const renderSpine = (sc: any) => {
  if (!skeleton || !animationState || !sc.renderer) return

  const delta = sc.time.delta
  const timeScale = props.isPlaying !== false ? (props.playbackRate || 1) : 0
  
  animationState.update(delta * timeScale)
  skeleton.update(delta)
  skeleton.updateWorldTransform(0)

  const track = animationState.getCurrent(0)
  if (track) {
    emit('timeUpdate', track.trackTime, track.animation.duration)
  }

  // Get skeleton bounds
  let centerX = 0, centerY = 0
  try {
    const bounds = skeleton.getBoundsRect()
    if (bounds) {
      centerX = bounds.x + bounds.width / 2
      centerY = bounds.y + bounds.height / 2
      console.log('=== Debug Info ===')
      console.log('Bounds:', bounds)
      console.log('Center:', centerX, centerY)
      console.log('Canvas:', sc.htmlCanvas.width, 'x', sc.htmlCanvas.height)
    }
  } catch (e) {
    console.log('Bounds error:', e)
  }

  // Simplified camera - fixed zoom = 1
  sc.renderer.camera.position.x = -centerX
  sc.renderer.camera.position.y = -centerY  
  sc.renderer.camera.position.z = 500
  sc.renderer.camera.zoom = 1

  console.log('Camera:', {
    x: sc.renderer.camera.position.x,
    y: sc.renderer.camera.position.y,
    z: sc.renderer.camera.position.z,
    zoom: sc.renderer.camera.zoom
  })

  sc.renderer.camera.update()

  sc.clear(0.2, 0.2, 0.2, 1)

  sc.renderer.begin()
  sc.renderer.drawSkeleton(skeleton, true)
  sc.renderer.end()
}

watch(() => props.skeletonUrl, (val) => {
  if (val && props.atlasUrl) loadSpine()
})

watch(() => props.animationName, (animName) => {
  if (animName && animationState) {
    animationState.setAnimation(0, animName, true)
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
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 16px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10;
}

.loading-overlay {
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
}

.error-overlay {
  background: rgba(255, 50, 50, 0.8);
  color: #ffaaaa;
}
</style>