<template>
  <div class="spine-viewer">
    <aside class="sidebar">
      <ControlPanel 
        @file-selected="handleFileSelected"
        @animation-change="handleAnimationChange"
        @playback-change="handlePlaybackChange"
      />
    </aside>
    <main class="main-content">
      <SpineCanvas 
        ref="spineCanvasRef"
        :skeleton-url="skeletonUrl"
        :atlas-url="atlasUrl"
        :textures="textures"
        :animation-name="animationName"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        @loaded="handleLoaded"
        @error="handleError"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import SpineCanvas from './components/SpineCanvas.vue'

const skeletonUrl = ref('')
const atlasUrl = ref('')
const textures = ref<string[]>([])
const animationName = ref('')
const isPlaying = ref(true)
const playbackRate = ref(1)
const spineCanvasRef = ref<InstanceType<typeof SpineCanvas> | null>(null)

const handleFileSelected = (files: { skeleton: string; atlas: string; textures: string[] }) => {
  skeletonUrl.value = files.skeleton
  atlasUrl.value = files.atlas
  textures.value = files.textures
}

const handleAnimationChange = (name: string) => {
  animationName.value = name
}

const handlePlaybackChange = (playing: boolean) => {
  isPlaying.value = playing
}

const handleLoaded = (data: { animations: string[]; skeletonName: string }) => {
  if (data.animations.length > 0) {
    animationName.value = data.animations[0]
  }
}

const handleError = (error: string) => {
  console.error('Spine Canvas Error:', error)
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.spine-viewer {
  display: flex;
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  color: #fff;
}

.sidebar {
  width: 300px;
  min-width: 300px;
  border-right: 1px solid #333;
  overflow-y: auto;
  background: #222;
}

.main-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}
</style>