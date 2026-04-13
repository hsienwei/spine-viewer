<template>
  <div class="control-panel">
    <!-- File Section -->
    <section class="section">
      <h3 class="section-title">Load Spine Files</h3>
      
      <!-- Select Files Button -->
      <button class="btn btn-primary" @click="triggerFileInput">
        📁 Select Files
      </button>
      <input 
        ref="fileInputRef"
        type="file"
        multiple
        accept=".json,.atlas,.png"
        class="hidden-input"
        @change="handleFileSelect"
      />
      
      <!-- Drop Zone -->
      <div 
        class="drop-zone"
        :class="{ 'drop-zone-active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <span>Drop .json, .atlas, .png files here</span>
      </div>

      <!-- Selected Files List -->
      <div v-if="selectedFiles.length > 0" class="file-list">
        <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-type">{{ getFileType(file.name) }}</span>
        </div>
      </div>

      <!-- Load Button -->
      <button 
        v-if="selectedFiles.length > 0" 
        class="btn btn-success" 
        :disabled="!canLoad"
        @click="loadFiles"
      >
        Load Animation
      </button>
    </section>

    <!-- Animation List -->
    <section v-if="animations.length > 0" class="section">
      <h3 class="section-title">Animation</h3>
      <select v-model="selectedAnimation" class="select-input">
        <option v-for="anim in animations" :key="anim" :value="anim">
          {{ anim }}
        </option>
      </select>
    </section>

    <!-- Playback Controls -->
    <section v-if="animations.length > 0" class="section">
      <h3 class="section-title">Playback</h3>
      
      <div class="playback-controls">
        <button class="btn btn-icon" @click="togglePlay">
          {{ isPlaying ? '⏸️' : '▶️' }}
        </button>
        <button class="btn btn-icon" @click="stop">
          ⏹️
        </button>
      </div>

      <!-- Timeline -->
      <div class="timeline">
        <input 
          type="range" 
          :min="0" 
          :max="duration" 
          :value="currentTime"
          class="slider"
          @input="seekTo($event)"
        />
        <div class="time-display">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>

      <!-- Speed Control -->
      <div class="speed-control">
        <label>Speed:</label>
        <input 
          type="range" 
          min="0.1" 
          max="3" 
          step="0.1"
          :value="playbackRate"
          class="slider"
          @input="setSpeed($event)"
        />
        <span>{{ playbackRate.toFixed(1) }}x</span>
      </div>
    </section>

    <!-- Info Panel -->
    <section v-if="animations.length > 0" class="section">
      <h3 class="section-title">Info</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Animation:</span>
          <span class="info-value">{{ selectedAnimation || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Time:</span>
          <span class="info-value">{{ formatTime(currentTime) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">DrawCall:</span>
          <span class="info-value">{{ drawCall }}</span>
        </div>
      </div>
    </section>

    <!-- Slot/Bone Controls -->
    <section v-if="animations.length > 0" class="section">
      <h3 class="section-title">Slots & Bones</h3>
      <div class="toggle-group">
        <label class="toggle-label">
          <input type="checkbox" v-model="showSlots" />
          Show Slots
        </label>
        <label class="toggle-label">
          <input type="checkbox" v-model="showBones" />
          Show Bones
        </label>
      </div>
    </section>

    <!-- Version Selector -->
    <section class="section">
      <h3 class="section-title">Spine Version</h3>
      <select v-model="spineVersion" class="select-input">
        <option value="4">4.x (Primary)</option>
        <option value="3">3.x (Fallback)</option>
      </select>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface FileData {
  name: string
  url: string
  type: 'skeleton' | 'atlas' | 'texture'
}

const emit = defineEmits<{
  'file-selected': [files: { skeleton: string; atlas: string; textures: string[] }]
  'animation-change': [name: string]
  'playback-change': [playing: boolean]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const selectedFiles = ref<FileData[]>([])
const animations = ref<string[]>([])
const selectedAnimation = ref('')
const isPlaying = ref(true)
const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref(1)
const drawCall = ref(0)
const showSlots = ref(false)
const showBones = ref(false)
const spineVersion = ref('4')

const canLoad = computed(() => {
  const hasSkeleton = selectedFiles.value.some(f => f.type === 'skeleton')
  const hasAtlas = selectedFiles.value.some(f => f.type === 'atlas')
  return hasSkeleton && hasAtlas
})

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const getFileType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (ext === 'json') return 'Skeleton'
  if (ext === 'atlas') return 'Atlas'
  if (ext === 'png') return 'Texture'
  return ext
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    processFiles(Array.from(target.files))
  }
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  if (event.dataTransfer?.files) {
    processFiles(Array.from(event.dataTransfer.files))
  }
}

const processFiles = (files: File[]) => {
  const newFiles: FileData[] = files.map(file => {
    const url = URL.createObjectURL(file)
    const ext = file.name.split('.').pop()?.toLowerCase()
    
    let type: 'skeleton' | 'atlas' | 'texture' = 'texture'
    if (ext === 'json') type = 'skeleton'
    else if (ext === 'atlas') type = 'atlas'
    else if (ext === 'png') type = 'texture'
    
    return {
      name: file.name,
      url,
      type
    }
  })
  
  selectedFiles.value = newFiles
}

const loadFiles = () => {
  const skeleton = selectedFiles.value.find(f => f.type === 'skeleton')
  const atlas = selectedFiles.value.find(f => f.type === 'atlas')
  const textures = selectedFiles.value.filter(f => f.type === 'texture').map(f => f.url)
  
  if (skeleton && atlas) {
    emit('file-selected', {
      skeleton: skeleton.url,
      atlas: atlas.url,
      textures
    })
    
    // Simulate loaded animations (will be replaced with actual Spine data)
    setTimeout(() => {
      animations.value = ['walk', 'run', 'idle', 'attack']
      selectedAnimation.value = animations.value[0]
      duration.value = 2.5
    }, 500)
  }
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  emit('playback-change', isPlaying.value)
}

const stop = () => {
  isPlaying.value = false
  currentTime.value = 0
  emit('playback-change', false)
}

const seekTo = (event: Event) => {
  const target = event.target as HTMLInputElement
  currentTime.value = parseFloat(target.value)
}

const setSpeed = (event: Event) => {
  const target = event.target as HTMLInputElement
  playbackRate.value = parseFloat(target.value)
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

watch(selectedAnimation, (newVal) => {
  if (newVal) {
    emit('animation-change', newVal)
  }
})
</script>

<style scoped>
.control-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hidden-input {
  display: none;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary {
  background: #4a9eff;
  color: white;
}

.btn-primary:hover {
  background: #3a8eef;
}

.btn-success {
  background: #4caf50;
  color: white;
}

.btn-success:disabled {
  background: #666;
  cursor: not-allowed;
}

.btn-icon {
  background: #333;
  color: white;
  padding: 8px 12px;
  font-size: 18px;
}

.btn-icon:hover {
  background: #444;
}

.drop-zone {
  border: 2px dashed #444;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  color: #888;
  transition: all 0.2s;
}

.drop-zone-active {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: #333;
  border-radius: 4px;
  font-size: 12px;
}

.file-name {
  color: #ddd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-type {
  color: #888;
  font-size: 10px;
}

.select-input {
  width: 100%;
  padding: 10px;
  background: #333;
  border: 1px solid #444;
  border-radius: 6px;
  color: white;
  font-size: 14px;
}

.playback-controls {
  display: flex;
  gap: 8px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slider {
  width: 100%;
  cursor: pointer;
}

.time-display {
  font-size: 12px;
  color: #888;
  text-align: center;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #aaa;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.info-label {
  color: #888;
}

.info-value {
  color: #ddd;
}

.toggle-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.toggle-label input {
  cursor: pointer;
}
</style>