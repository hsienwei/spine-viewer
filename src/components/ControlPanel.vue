<template>
  <div class="control-panel">
    <section class="section">
      <h3 class="section-title">Load Spine Files</h3>

      <div class="load-buttons">
        <button class="btn btn-primary" @click="triggerFileInput">
          Select Files
        </button>
        <button class="btn btn-google" @click="showDriveBrowser = true">
          <svg width="16" height="16" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
          Google Drive
        </button>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept=".json,.atlas,.png"
        class="hidden-input"
        @change="handleFileSelect"
      />

      <div v-if="selectedFiles.length > 0" class="file-list">
        <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-type">{{ getFileType(file.name) }}</span>
        </div>
      </div>

      <div v-if="selectedFiles.length > 0 && missingFiles.length > 0" class="missing-hint">
        <span>Missing: {{ missingFiles.join(', ') }}</span>
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
      <h3 class="section-title">Render Options</h3>
      <label class="toggle-row">
        <span class="toggle-label">Premultiplied Alpha</span>
        <input
          type="checkbox"
          :checked="props.premultipliedAlpha ?? true"
          @change="emit('premultiply-alpha-change', ($event.target as HTMLInputElement).checked)"
        />
      </label>
    </section>

    <div v-if="runtimeVersion !== null" class="section info-grid version-info">
      <div class="info-item">
        <span class="info-label">Detected:</span>
        <span class="info-value">{{ detectedVersionLabel }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Runtime:</span>
        <span class="info-value version-badge" :class="`version-badge-${runtimeVersion}`">
          {{ runtimeVersion }}.x
        </span>
      </div>
    </div>
  </div>

  <DriveBrowser
    v-if="showDriveBrowser"
    @close="showDriveBrowser = false"
    @confirm="handleDriveConfirm"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SpineDetectedVersion, SpineMajorVersion } from '../lib/spine/versionDetection'
import DriveBrowser from './DriveBrowser.vue'

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
  detectedVersion?: SpineDetectedVersion | null
  runtimeVersion?: SpineMajorVersion | null
  premultipliedAlpha?: boolean
}>()

const emit = defineEmits<{
  'file-selected': [payload: { files: File[] }]
  'animation-change': [name: string]
  'premultiply-alpha-change': [value: boolean]
}>()

const showDriveBrowser = ref(false)

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<FileData[]>([])
const localAnimation = ref('')

watch(() => props.currentAnimation, (val) => {
  if (val) localAnimation.value = val
})

const canLoad = computed(() => {
  const hasSkeleton = selectedFiles.value.some(f => f.type === 'skeleton')
  const hasAtlas = selectedFiles.value.some(f => f.type === 'atlas')
  return hasSkeleton && hasAtlas
})

const missingFiles = computed(() => {
  const missing: string[] = []
  if (!selectedFiles.value.some(f => f.type === 'skeleton')) missing.push('.json')
  if (!selectedFiles.value.some(f => f.type === 'atlas')) missing.push('.atlas')
  return missing
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
      files: selectedFiles.value.map(file => file.file)
    })
  }
}

const handleDriveConfirm = (files: File[]) => {
  showDriveBrowser.value = false
  if (files.length > 0) processFiles(files)
}

const emitAnimationChange = () => {
  if (localAnimation.value) {
    emit('animation-change', localAnimation.value)
  }
}

const detectedVersionLabel = computed(() => {
  if (props.detectedVersion === 3) return '3.x'
  if (props.detectedVersion === 4) return '4.x'
  return 'unknown'
})

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

.load-buttons {
  display: flex;
  gap: 8px;
}

.load-buttons .btn {
  flex: 1;
}

.btn-google {
  background: #fff;
  color: #444;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
}

.btn-google:hover:not(:disabled) {
  background: #f5f5f5;
}

.btn-google:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-success:disabled {
  background: #666;
  cursor: not-allowed;
}

.missing-hint {
  font-size: 12px;
  color: #f4845f;
  padding: 6px 8px;
  background: rgba(244, 132, 95, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(244, 132, 95, 0.25);
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

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  cursor: pointer;
}

.toggle-label {
  color: #ddd;
}

.version-info {
  margin-top: 2px;
}

.version-badge {
  font-weight: 600;
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
}

.version-badge-3 {
  color: #f9c74f;
  background: rgba(249, 199, 79, 0.12);
}

.version-badge-4 {
  color: #4fc3f7;
  background: rgba(79, 195, 247, 0.12);
}
</style>
