<template>
  <div class="spine-canvas-container">
    <canvas ref="canvasRef" class="spine-canvas"></canvas>
    <div v-if="loading" class="loading-overlay">
      <span>Loading...</span>
    </div>
    <div v-if="error" class="error-overlay">
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  skeletonUrl?: string
  atlasUrl?: string
  textures?: string[]
  animationName?: string
  isPlaying?: boolean
  playbackRate?: number
}>()

const emit = defineEmits<{
  loaded: [data: { animations: string[]; skeletonName: string }]
  error: [error: string]
}>()

// Use emit in template bindings
void emit

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const error = ref('')

// Watch for prop changes to reload/change animation
watch(() => props.skeletonUrl, () => {
  // Will implement after loading logic
})

onMounted(() => {
  if (canvasRef.value) {
    canvasRef.value.width = 800
    canvasRef.value.height = 600
  }
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
}

.error-overlay {
  background: rgba(255, 0, 0, 0.7);
  color: #ff6b6b;
}
</style>