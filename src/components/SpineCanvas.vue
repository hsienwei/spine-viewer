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
  loaded: [data: { animations: string[]; skeletonName: string; drawCall: number }]
  error: [error: string]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const errorMsg = ref('')

let gl: WebGLRenderingContext | null = null
let animationId: number | null = null

const initWebGL = (): WebGLRenderingContext | null => {
  if (!canvasRef.value) return null
  
  const canvas = canvasRef.value
  const ctx = canvas.getContext('webgl') 
  if (!ctx) {
    errorMsg.value = 'WebGL not supported'
    return null
  }
  
  gl = ctx as WebGLRenderingContext
  canvas.width = canvas.clientWidth * window.devicePixelRatio
  canvas.height = canvas.clientHeight * window.devicePixelRatio
  gl.viewport(0, 0, canvas.width, canvas.height)
  
  return gl
}

onMounted(() => {
  if (props.skeletonUrl && props.atlasUrl) {
    loadSpine()
  }
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})

watch(() => props.skeletonUrl, () => {
  if (props.skeletonUrl && props.atlasUrl) {
    loadSpine()
  }
})

const loadSpine = async () => {
  if (!props.skeletonUrl || !props.atlasUrl) return
  
  loading.value = true
  errorMsg.value = ''
  
  try {
    // Load skeleton JSON
    const skeletonResponse = await fetch(props.skeletonUrl)
    const skeletonText = await skeletonResponse.text()
    
    // Load atlas (for now just get text)
    await fetch(props.atlasUrl)
    
    // For now, just emit loaded with placeholder data
    // Real spine-webgl integration requires more complex setup
    // The library uses a different pattern with SpineCanvasApp
    
    const animations = extractAnimations(skeletonText)
    
    emit('loaded', {
      animations,
      skeletonName: 'spine-skeleton',
      drawCall: 0
    })
    
    // Start render loop (placeholder - just clears canvas)
    startRenderLoop()
    
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load'
    emit('error', errorMsg.value)
  }
  
  loading.value = false
}

const extractAnimations = (skeletonText: string): string[] => {
  try {
    const data = JSON.parse(skeletonText)
    if (data.animations) {
      return Object.keys(data.animations)
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

const startRenderLoop = () => {
  if (!canvasRef.value) return
  
  const render = () => {
    if (!gl) {
      gl = initWebGL()
    }
    
    if (gl && canvasRef.value) {
      // Clear with dark background
      gl.clearColor(0.1, 0.1, 0.1, 1.0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    
    animationId = requestAnimationFrame(render)
  }
  
  render()
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
}

.loading-overlay {
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
}

.error-overlay {
  background: rgba(255, 0, 0, 0.7);
  color: #ff6b6b;
}
</style>