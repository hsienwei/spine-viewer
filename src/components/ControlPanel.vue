<template>
  <div class="control-panel">

    <!-- Load Files -->
    <section class="section">
      <h3 class="section-title">Load Files</h3>
      <div class="load-buttons">
        <button class="btn btn-outline" @click="triggerFileInput">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v8M3 6l3.5 3.5L10 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1 10v1.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          Local
        </button>
        <button class="btn btn-outline" @click="showDriveBrowser = true">
          <svg width="14" height="12" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
          Drive
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
          <span class="file-type-dot" :class="`file-type-dot--${file.type}`"></span>
          <span class="file-name">{{ file.name }}</span>
          <span class="file-ext">{{ getFileExt(file.name) }}</span>
        </div>
      </div>

      <div v-if="isAnalyzingFiles" class="status-hint">
        Analyzing file groups...
      </div>

      <section v-if="assetGroups.length > 0" class="subsection">
        <h4 class="subsection-title">Detected Sets</h4>
        <div class="group-list">
          <label
            v-for="group in assetGroups"
            :key="group.id"
            class="group-card"
            :class="{ selected: selectedGroupId === group.id, disabled: !group.isLoadable }"
          >
            <input
              v-model="selectedGroupId"
              class="group-radio"
              type="radio"
              name="asset-group"
              :value="group.id"
            />
            <div class="group-copy">
              <div class="group-header">
                <span class="group-title">{{ group.label }}</span>
                <span class="group-status" :class="{ ready: group.isLoadable, invalid: !group.isLoadable }">
                  {{ group.isLoadable ? 'Ready' : 'Needs Fix' }}
                </span>
              </div>
              <div class="group-meta">
                <span>{{ group.skeletonFile.name }}</span>
                <span>{{ group.atlasFile?.name || 'No atlas' }}</span>
                <span>{{ group.textureFiles.length }} textures</span>
              </div>
              <div v-if="group.issues.length > 0" class="group-issues">
                {{ group.issues.join(' · ') }}
              </div>
            </div>
          </label>
        </div>
      </section>

      <div v-if="analysisIssues.length > 0" class="missing-hint">
        <div v-for="issue in analysisIssues" :key="issue">{{ issue }}</div>
      </div>

      <button
        v-if="selectedFiles.length > 0"
        class="btn btn-accent"
        :disabled="isAnalyzingFiles || !canLoad"
        @click="loadFiles"
      >
        Load Animation
      </button>
    </section>

    <!-- Animation -->
    <section v-if="animations && animations.length > 0" class="section">
      <h3 class="section-title">Animation</h3>
      <div class="select-wrapper">
        <select v-model="localAnimation" class="select-input" @change="emitAnimationChange">
          <option v-for="anim in animations" :key="anim" :value="anim">{{ anim }}</option>
        </select>
        <svg class="select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </section>

    <!-- Info -->
    <section v-if="animations && animations.length > 0" class="section">
      <h3 class="section-title">Info</h3>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Animation</span>
          <span class="info-value">{{ currentAnimation || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Draw Calls</span>
          <span class="info-value mono">{{ drawCall || 0 }}</span>
        </div>
      </div>
    </section>

    <!-- Render Options -->
    <section v-if="runtimeVersion !== null" class="section">
      <h3 class="section-title">Render</h3>
      <label class="toggle-row">
        <span class="toggle-label-text">XY Axes</span>
        <span class="toggle-switch">
          <input
            type="checkbox"
            class="toggle-input"
            :checked="props.showAxes !== false"
            @change="emit('show-axes-change', ($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
        </span>
      </label>
      <label class="toggle-row">
        <span class="toggle-label-text">Premultiplied Alpha</span>
        <span class="toggle-switch">
          <input
            type="checkbox"
            class="toggle-input"
            :checked="props.premultipliedAlpha ?? true"
            @change="emit('premultiply-alpha-change', ($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
        </span>
      </label>
    </section>

    <!-- Version Info -->
    <div v-if="runtimeVersion !== null" class="version-section">
      <div class="version-row">
        <span class="version-label">Detected</span>
        <span class="version-value">{{ detectedVersionLabel }}</span>
      </div>
      <div class="version-row">
        <span class="version-label">Runtime</span>
        <span class="version-badge" :class="`version-badge--${runtimeVersion}`">v{{ runtimeVersion }}.x</span>
      </div>
      <div v-if="fallbackStatusLabel" class="version-row">
        <span class="version-label">Fallback</span>
        <span class="version-value">{{ fallbackStatusLabel }}</span>
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
import {
  analyzeSpineFiles,
  type SpineDetectedVersion,
  type SpineFileGroupCandidate,
  type SpineMajorVersion
} from '../lib/spine/versionDetection'
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
  initialRuntimeVersion?: SpineMajorVersion | null
  fallbackUsed?: boolean
  showAxes?: boolean
  premultipliedAlpha?: boolean
}>()

const emit = defineEmits<{
  'file-selected': [payload: { files: File[] }]
  'animation-change': [name: string]
  'show-axes-change': [value: boolean]
  'premultiply-alpha-change': [value: boolean]
}>()

const showDriveBrowser = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<FileData[]>([])
const assetGroups = ref<SpineFileGroupCandidate[]>([])
const analysisIssues = ref<string[]>([])
const selectedGroupId = ref('')
const isAnalyzingFiles = ref(false)
const localAnimation = ref('')
let fileAnalysisRequestId = 0

watch(() => props.currentAnimation, (val) => {
  if (val) localAnimation.value = val
})

const selectedGroup = computed(() => {
  return assetGroups.value.find(group => group.id === selectedGroupId.value) || null
})

const canLoad = computed(() => !!selectedGroup.value?.isLoadable)

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const getFileExt = (filename: string): string => {
  return '.' + (filename.split('.').pop()?.toLowerCase() || '')
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    processFiles(Array.from(target.files))
  }
}

const processFiles = async (files: File[]) => {
  selectedFiles.value = files.map(file => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    let type: 'skeleton' | 'atlas' | 'texture' = 'texture'
    if (ext === 'json') type = 'skeleton'
    else if (ext === 'atlas') type = 'atlas'
    return { name: file.name, file, type }
  })

  const requestId = ++fileAnalysisRequestId
  isAnalyzingFiles.value = true
  assetGroups.value = []
  analysisIssues.value = []
  selectedGroupId.value = ''

  try {
    const analysis = await analyzeSpineFiles(files)
    if (requestId !== fileAnalysisRequestId) return

    assetGroups.value = analysis.groups
    analysisIssues.value = analysis.generalIssues
    selectedGroupId.value = analysis.groups.find(group => group.isLoadable)?.id || analysis.groups[0]?.id || ''
  } catch (error) {
    if (requestId !== fileAnalysisRequestId) return
    analysisIssues.value = [error instanceof Error ? error.message : 'Failed to analyze selected files']
  } finally {
    if (requestId === fileAnalysisRequestId) {
      isAnalyzingFiles.value = false
    }
  }
}

const loadFiles = () => {
  if (selectedGroup.value?.sourceFiles && selectedGroup.value.isLoadable) {
    emit('file-selected', {
      files: [
        selectedGroup.value.sourceFiles.skeletonFile,
        selectedGroup.value.sourceFiles.atlasFile,
        ...selectedGroup.value.sourceFiles.textureFiles
      ]
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

const fallbackStatusLabel = computed(() => {
  if (!props.fallbackUsed) return ''
  if (props.initialRuntimeVersion && props.runtimeVersion && props.initialRuntimeVersion !== props.runtimeVersion) {
    return `v${props.initialRuntimeVersion}.x -> v${props.runtimeVersion}.x`
  }
  return 'used'
})
</script>

<style scoped>
.control-panel {
  height: 100%;
  min-height: 0;
  padding: 14px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.control-panel::-webkit-scrollbar { width: 4px; }
.control-panel::-webkit-scrollbar-track { background: transparent; }
.control-panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.hidden-input { display: none; }

/* Buttons */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: var(--radius-md);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition), color var(--transition), box-shadow var(--transition);
  white-space: nowrap;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.btn-outline:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.btn-accent {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: #0c0b0a;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
}

.btn-accent:hover:not(:disabled) {
  background: #dba040;
  border-color: #dba040;
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.btn-accent:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.load-buttons {
  display: flex;
  gap: 8px;
}

.load-buttons .btn {
  flex: 1;
}

/* File List */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-sm);
}

.file-type-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.file-type-dot--skeleton { background: var(--info); }
.file-type-dot--atlas    { background: var(--success); }
.file-type-dot--texture  { background: var(--accent); }

.file-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-ext {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.missing-hint {
  font-size: 11px;
  color: var(--danger);
  padding: 6px 8px;
  background: rgba(196, 107, 90, 0.08);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(196, 107, 90, 0.2);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-hint {
  font-size: 11px;
  color: var(--text-muted);
  padding: 6px 8px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-muted);
}

.subsection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subsection-title {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), box-shadow var(--transition);
}

.group-card:hover {
  border-color: var(--border-glow);
}

.group-card.selected {
  border-color: var(--accent);
  background: var(--accent-dim);
  box-shadow: 0 0 0 1px rgba(201, 141, 42, 0.12);
}

.group-card.disabled {
  opacity: 0.82;
}

.group-radio {
  margin-top: 2px;
  accent-color: var(--accent);
  flex-shrink: 0;
}

.group-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-status {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.group-status.ready {
  color: var(--success);
}

.group-status.invalid {
  color: var(--danger);
}

.group-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--text-muted);
}

.group-issues {
  font-size: 11px;
  color: var(--danger);
  line-height: 1.4;
}

/* Custom Select */
.select-wrapper {
  position: relative;
}

.select-input {
  width: 100%;
  padding: 9px 32px 9px 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
  appearance: none;
  cursor: pointer;
  transition: border-color var(--transition);
}

.select-input:focus {
  outline: none;
  border-color: var(--accent);
}

.select-input option {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.select-chevron {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

/* Info Grid */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.info-label {
  font-size: 11px;
  color: var(--text-muted);
}

.info-value {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
  text-align: right;
}

.info-value.mono {
  font-family: var(--font-mono);
  color: var(--text-primary);
  font-size: 11px;
}

/* Toggle Switch */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-label-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 19px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: background var(--transition), border-color var(--transition);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 11px;
  height: 11px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: transform var(--transition), background var(--transition);
}

.toggle-input:checked + .toggle-track {
  background: var(--accent-dim);
  border-color: var(--accent);
}

.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(15px);
  background: var(--accent);
}

/* Version */
.version-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-md);
}

.version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.version-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.version-value {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}

.version-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 3px;
  letter-spacing: 0.05em;
}

.version-badge--3 {
  color: #e8c55a;
  background: rgba(232, 197, 90, 0.1);
  border: 1px solid rgba(232, 197, 90, 0.25);
}

:root[data-theme="light"] .version-badge--3 {
  color: #8a6200;
  background: rgba(138, 98, 0, 0.1);
  border: 1px solid rgba(138, 98, 0, 0.3);
}

.version-badge--4 {
  color: var(--info);
  background: rgba(91, 150, 212, 0.1);
  border: 1px solid rgba(91, 150, 212, 0.25);
}
</style>
