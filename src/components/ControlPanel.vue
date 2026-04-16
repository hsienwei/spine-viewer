<template>
  <div class="control-panel">
    <section class="section">
      <h3 class="section-title">Load Spine Files</h3>

      <button class="btn btn-primary" @click="triggerFileInput">
        Select Files
      </button>
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept=".json,.atlas,.png"
        class="hidden-input"
        @change="handleFileSelect"
      />

      <div
        class="drop-zone"
        :class="{ 'drop-zone-active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <span>Drop .json, .atlas, .png files here</span>
      </div>

      <div v-if="selectedFiles.length > 0" class="file-list">
        <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-type">{{ getFileType(file.name) }}</span>
        </div>
      </div>

      <button
        v-if="selectedFiles.length > 0"
        class="btn btn-success"
        :disabled="!canLoad"
        @click="loadFiles"
      >
        Load Animation
      </button>
    </section>

    <section v-if="animations && animations.length > 0" class="section">
      <h3 class="section-title">Animation</h3>
      <select v-model="localAnimation" class="select-input" @change="emitAnimationChange">
        <option v-for="anim in animations" :key="anim" :value="anim">
          {{ anim }}
        </option>
      </select>
    </section>

    <section v-if="animations && animations.length > 0" class="section">
      <h3 class="section-title">Info</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Animation:</span>
          <span class="info-value">{{ currentAnimation || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Time:</span>
          <span class="info-value">{{ formatTime(currentTime || 0) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">DrawCall:</span>
          <span class="info-value">{{ drawCall || 0 }}</span>
        </div>
      </div>
    </section>

    <section class="section">
      <h3 class="section-title">Spine Version</h3>
      <select v-model="spineVersion" class="select-input">
        <option value="auto">Auto</option>
        <option value="force-4">4.x (Force)</option>
        <option value="force-3">3.x (Force)</option>
      </select>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SpineVersionMode } from '../lib/spine/versionDetection'

interface FileData {
  name: string
  file: File
  type: 'skeleton' | 'atlas' | 'texture'
}

const props = defineProps<{
  animations?: string[]
  currentAnimation?: string
  currentTime?: number
  duration?: number
  drawCall?: number
}>()

const emit = defineEmits<{
  'file-selected': [payload: { files: File[]; versionMode: SpineVersionMode }]
  'animation-change': [name: string]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const selectedFiles = ref<FileData[]>([])
const localAnimation = ref('')
const spineVersion = ref<SpineVersionMode>('auto')

watch(() => props.currentAnimation, (val) => {
  if (val) localAnimation.value = val
})

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
    const ext = file.name.split('.').pop()?.toLowerCase()

    let type: 'skeleton' | 'atlas' | 'texture' = 'texture'
    if (ext === 'json') type = 'skeleton'
    else if (ext === 'atlas') type = 'atlas'
    else if (ext === 'png') type = 'texture'

    return {
      name: file.name,
      file,
      type
    }
  })

  selectedFiles.value = newFiles
}

const loadFiles = () => {
  if (canLoad.value) {
    emit('file-selected', {
      files: selectedFiles.value.map(file => file.file),
      versionMode: spineVersion.value
    })
  }
}

const emitAnimationChange = () => {
  if (localAnimation.value) {
    emit('animation-change', localAnimation.value)
  }
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.control-panel {
  height: 100%;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
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
</style>
