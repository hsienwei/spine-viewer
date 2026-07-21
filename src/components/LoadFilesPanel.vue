<template>
  <div class="load-files-panel">
    <div class="load-buttons">
      <div class="load-local-group">
        <button class="btn btn-outline" type="button" aria-label="Select Spine files" @click="triggerFileInput">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v8M3 6l3.5 3.5L10 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1 10v1.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          Files
        </button>
        <button class="btn btn-outline btn-folder" type="button" aria-label="Select a Spine asset folder" @click="triggerFolderInput">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1.5 4.25h3.1l1.05 1.15H11.5v4.85a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M1.5 5.4v-2.15a.75.75 0 0 1 .75-.75h2.05l1.05 1.15h5.4a.75.75 0 0 1 .75.75V5.4" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
          Folder
        </button>
      </div>
      <button class="btn btn-outline btn-drive" type="button" :disabled="isDrivePicking" aria-label="Select Spine files from Google Drive" @click="openDriveFiles">
        <svg width="14" height="12" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
          <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
          <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
          <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
        </svg>
        {{ isDrivePicking ? 'Picking...' : 'Drive' }}
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
    <input
      ref="folderInputRef"
      type="file"
      multiple
      webkitdirectory
      class="hidden-input"
      @change="handleFolderSelect"
    />
    <input
      ref="supplementalInputRef"
      type="file"
      multiple
      accept=".json,.atlas,.png"
      class="hidden-input"
      @change="handleSupplementalFileSelect"
    />

    <section v-if="selectedFiles.length > 0" class="file-summary-card">
      <div class="file-summary-header">
        <div class="file-summary-copy">
          <span class="file-summary-title">Loaded Files</span>
          <span class="file-summary-total">{{ selectedFiles.length }} files detected</span>
        </div>
        <button type="button" class="summary-toggle-btn" @click="isFileListExpanded = !isFileListExpanded">
          {{ isFileListExpanded ? 'Hide list' : 'Show list' }}
        </button>
      </div>
      <div class="file-summary-stats">
        <div class="file-summary-stat">
          <span class="file-type-dot file-type-dot--skeleton"></span>
          <span>{{ fileStats.skeleton }} skeleton</span>
        </div>
        <div class="file-summary-stat">
          <span class="file-type-dot file-type-dot--atlas"></span>
          <span>{{ fileStats.atlas }} atlas</span>
        </div>
        <div class="file-summary-stat">
          <span class="file-type-dot file-type-dot--texture"></span>
          <span>{{ fileStats.texture }} textures</span>
        </div>
      </div>

      <div v-if="isFileListExpanded" class="file-list">
        <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
          <span class="file-type-dot" :class="`file-type-dot--${file.type}`"></span>
          <span class="file-name">{{ file.name }}</span>
          <span class="file-ext">{{ getFileExt(file.name) }}</span>
        </div>
      </div>
    </section>

    <div v-if="isAnalyzingFiles" class="status-hint">
      Analyzing file groups...
    </div>

    <div v-else class="status-hint">
      Use Folder to load a whole Spine asset directory without Ctrl multi-select.
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
      v-if="selectedFiles.length > 0 && !canLoad"
      class="btn btn-outline btn-supplemental"
      type="button"
      :disabled="isAnalyzingFiles"
      @click="triggerSupplementalInput"
    >
      Add Missing Files
    </button>

    <button
      v-if="selectedFiles.length > 0"
      class="btn btn-accent"
      :disabled="isAnalyzingFiles || !canLoad"
      @click="loadFiles"
    >
      Load Animation
    </button>

  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { analyzeSpineFiles, type SpineFileGroupCandidate } from '../lib/spine/versionDetection'
import { useGoogleDrivePicker } from '../composables/useGoogleDrivePicker'

interface FilePickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

interface DirectoryEntryHandle {
  kind: 'file' | 'directory'
  getFile?: () => Promise<File>
}

interface FileData {
  name: string
  file: File
  type: 'skeleton' | 'atlas' | 'texture'
}

const emit = defineEmits<{
  'file-selected': [payload: { files: File[] }]
}>()

const { openDrivePicker } = useGoogleDrivePicker()

const fileInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)
const supplementalInputRef = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<FileData[]>([])
const isFileListExpanded = ref(false)
const assetGroups = ref<SpineFileGroupCandidate[]>([])
const analysisIssues = ref<string[]>([])
const selectedGroupId = ref('')
const isAnalyzingFiles = ref(false)
const isDrivePicking = ref(false)
let fileAnalysisRequestId = 0

const selectedGroup = computed(() => {
  return assetGroups.value.find(group => group.id === selectedGroupId.value) || null
})

const canLoad = computed(() => !!selectedGroup.value?.isLoadable)

const fileStats = computed(() => ({
  skeleton: selectedFiles.value.filter(file => file.type === 'skeleton').length,
  atlas: selectedFiles.value.filter(file => file.type === 'atlas').length,
  texture: selectedFiles.value.filter(file => file.type === 'texture').length
}))

const resetFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  if (folderInputRef.value) {
    folderInputRef.value.value = ''
  }
  if (supplementalInputRef.value) {
    supplementalInputRef.value.value = ''
  }
}

const triggerFileInput = () => {
  resetFileInput()
  fileInputRef.value?.click()
}

const triggerSupplementalInput = () => {
  if (supplementalInputRef.value) {
    supplementalInputRef.value.value = ''
  }
  supplementalInputRef.value?.click()
}


const openDriveFiles = async () => {
  if (isDrivePicking.value) return

  resetFileInput()
  isDrivePicking.value = true
  analysisIssues.value = []

  try {
    const files = await openDrivePicker()
    if (files.length > 0) {
      await processFiles(files)
    }
  } catch (error) {
    analysisIssues.value = [error instanceof Error ? error.message : 'Failed to load files from Google Drive']
  } finally {
    isDrivePicking.value = false
  }
}

const supportedExtensions = new Set(['json', 'atlas', 'png'])

const isSupportedSpineFile = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return supportedExtensions.has(ext)
}

const filterSupportedFiles = (files: File[]) => files.filter(isSupportedSpineFile)

const readDirectoryFiles = async (directoryHandle: FileSystemDirectoryHandle): Promise<File[]> => {
  const files: File[] = []
  const values = (directoryHandle as FileSystemDirectoryHandle & {
    values?: () => AsyncIterable<DirectoryEntryHandle>
  }).values

  if (!values) {
    throw new Error('Directory iteration is not supported in this browser')
  }

  for await (const entry of values.call(directoryHandle)) {
    if (entry.kind === 'file') {
      const file = await entry.getFile?.()
      if (!file) continue
      if (isSupportedSpineFile(file)) {
        files.push(file)
      }
      continue
    }

    files.push(...await readDirectoryFiles(entry as FileSystemDirectoryHandle))
  }

  return files
}

const triggerFolderInput = async () => {
  resetFileInput()

  const pickerWindow = window as FilePickerWindow
  if (typeof pickerWindow.showDirectoryPicker === 'function') {
    try {
      const directoryHandle = await pickerWindow.showDirectoryPicker()
      const files = await readDirectoryFiles(directoryHandle)
      if (files.length > 0) {
        processFiles(files)
      } else {
        selectedFiles.value = []
        isFileListExpanded.value = false
        assetGroups.value = []
        selectedGroupId.value = ''
        analysisIssues.value = ['No supported Spine files found in the selected folder']
      }
    } catch (error) {
      const isAbortError = error instanceof DOMException && error.name === 'AbortError'
      if (!isAbortError) {
        analysisIssues.value = ['Failed to read the selected folder']
      }
    }
    return
  }

  folderInputRef.value?.click()
}

const getFileExt = (filename: string): string => {
  return '.' + (filename.split('.').pop()?.toLowerCase() || '')
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    processFiles(Array.from(target.files))
  }
  target.value = ''
}

const handleFolderSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    processFiles(filterSupportedFiles(Array.from(target.files)))
  }
  target.value = ''
}

const handleSupplementalFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const existingFiles = selectedFiles.value.map(file => file.file)
    const incomingFiles = filterSupportedFiles(Array.from(target.files))
    const mergedByName = new Map<string, File>()

    existingFiles.forEach(file => mergedByName.set(file.name, file))
    incomingFiles.forEach(file => mergedByName.set(file.name, file))

    processFiles([...mergedByName.values()])
  }
  target.value = ''
}

const processFiles = async (files: File[]) => {
  const supportedFiles = filterSupportedFiles(files)

  if (supportedFiles.length === 0) {
    selectedFiles.value = []
    isFileListExpanded.value = false
    assetGroups.value = []
    selectedGroupId.value = ''
    analysisIssues.value = ['No supported Spine files were selected']
    isAnalyzingFiles.value = false
    return
  }

  selectedFiles.value = supportedFiles.map(file => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    let type: 'skeleton' | 'atlas' | 'texture' = 'texture'
    if (ext === 'json') type = 'skeleton'
    else if (ext === 'atlas') type = 'atlas'
    return { name: file.name, file, type }
  })
  isFileListExpanded.value = false

  const requestId = ++fileAnalysisRequestId
  isAnalyzingFiles.value = true
  assetGroups.value = []
  analysisIssues.value = []
  selectedGroupId.value = ''

  try {
    const analysis = await analyzeSpineFiles(supportedFiles)
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

</script>

<style scoped>
.load-files-panel {
  padding: 14px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hidden-input { display: none; }

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

.btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.btn-outline:disabled:hover {
  border-color: var(--border);
  color: var(--text-secondary);
  background: transparent;
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
  flex-direction: column;
  gap: 8px;
}

.load-local-group {
  display: flex;
  gap: 8px;
}

.load-local-group .btn,
.btn-drive {
  flex: 1;
}

.file-summary-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-md);
}

.file-summary-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.file-summary-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.file-summary-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.file-summary-total {
  font-size: 11px;
  color: var(--text-muted);
}

.summary-toggle-btn {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  padding: 4px 8px;
  cursor: pointer;
  transition: border-color var(--transition), color var(--transition), background var(--transition);
  flex-shrink: 0;
}

.summary-toggle-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.file-summary-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.file-summary-stat {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-secondary);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 156px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.file-list::-webkit-scrollbar {
  width: 4px;
}

.file-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 999px;
}

.file-list::-webkit-scrollbar-track {
  background: transparent;
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

@media (max-width: 640px), (max-width: 900px) and (max-height: 480px) {
  .load-buttons {
    gap: 10px;
  }

  .btn {
    min-height: 44px;
  }

  .btn-drive {
    order: -1;
  }

  .file-summary-stats {
    grid-template-columns: 1fr;
  }
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
  font-size: 11px;
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
  font-size: 11px;
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
</style>
