<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Google Drive</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="tabs">
        <button :class="['tab', { active: mode === 'mine' }]" @click="switchMode('mine')">My Drive</button>
        <button :class="['tab', { active: mode === 'shared' }]" @click="switchMode('shared')">Shared with me</button>
      </div>

      <div class="breadcrumb">
        <button
          v-for="(f, i) in currentStack"
          :key="f.id"
          :class="['crumb', { last: i === currentStack.length - 1 }]"
          @click="navigateTo(i)"
        >{{ f.name }}</button>
      </div>

      <div class="file-list">
        <div v-if="loading" class="status">Loading...</div>
        <div v-else-if="error" class="status error">{{ error }}</div>
        <div v-else-if="items.length === 0" class="status">No files</div>
        <div
          v-for="item in items"
          :key="item.id"
          :class="['file-row', { 'is-folder': item.isFolder, 'is-selected': selected.has(item.id), 'is-spine': isSpineFile(item.name) }]"
          @click="handleClick(item)"
        >
          <span class="file-icon">{{ item.isFolder ? '📁' : fileIcon(item.name) }}</span>
          <span class="file-name">{{ item.name }}</span>
          <input
            v-if="!item.isFolder && isSpineFile(item.name)"
            type="checkbox"
            class="file-check"
            :checked="selected.has(item.id)"
            @click.stop="toggleSelect(item)"
          />
        </div>
      </div>

      <div class="modal-footer">
        <span class="select-count">{{ selected.size }} selected</span>
        <button class="btn-confirm" :disabled="selected.size === 0 || downloading" @click="confirm">
          {{ downloading ? 'Downloading...' : 'Load Files' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGoogleDrive, type DriveItem } from '../composables/useGoogleDrive'

const emit = defineEmits<{
  close: []
  confirm: [files: File[]]
}>()

const { signIn, listFolder, listSharedWithMe, downloadFile } = useGoogleDrive()

const NAV_KEY = 'gdrive-nav'

type Mode = 'mine' | 'shared'

function loadSavedNav() {
  try {
    const saved = localStorage.getItem(NAV_KEY)
    if (saved) return JSON.parse(saved) as { mode: Mode; myStack: typeof defaultMyStack; sharedStack: typeof defaultSharedStack }
  } catch {}
  return null
}

const defaultMyStack = [{ id: 'root', name: 'My Drive' }]
const defaultSharedStack = [{ id: 'shared', name: 'Shared with me' }]
const saved = loadSavedNav()

const mode = ref<Mode>(saved?.mode ?? 'mine')
const myStack = ref(saved?.myStack ?? defaultMyStack)
const sharedStack = ref(saved?.sharedStack ?? defaultSharedStack)
const items = ref<DriveItem[]>([])
const selected = ref<Map<string, DriveItem>>(new Map())
const loading = ref(false)
const downloading = ref(false)
const error = ref('')

const currentStack = computed(() => mode.value === 'mine' ? myStack.value : sharedStack.value)

function saveNav() {
  localStorage.setItem(NAV_KEY, JSON.stringify({
    mode: mode.value,
    myStack: myStack.value,
    sharedStack: sharedStack.value,
  }))
}

onMounted(async () => {
  await signIn()
  await loadCurrent()
})

async function loadCurrent() {
  loading.value = true
  error.value = ''
  try {
    const stack = currentStack.value
    const top = stack[stack.length - 1]
    items.value = (mode.value === 'shared' && stack.length === 1)
      ? await listSharedWithMe()
      : await listFolder(top.id)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function switchMode(m: Mode) {
  if (mode.value === m) return
  mode.value = m
  saveNav()
  await loadCurrent()
}

async function navigateTo(index: number) {
  const stack = mode.value === 'mine' ? myStack : sharedStack
  stack.value = stack.value.slice(0, index + 1)
  saveNav()
  await loadCurrent()
}

async function handleClick(item: DriveItem) {
  if (!item.isFolder) {
    if (isSpineFile(item.name)) toggleSelect(item)
    return
  }
  const stack = mode.value === 'mine' ? myStack : sharedStack
  stack.value = [...stack.value, { id: item.id, name: item.name }]
  saveNav()
  await loadCurrent()
}

function toggleSelect(item: DriveItem) {
  const map = new Map(selected.value)
  if (map.has(item.id)) map.delete(item.id)
  else map.set(item.id, item)
  selected.value = map
}

async function confirm() {
  downloading.value = true
  try {
    const files: File[] = []
    for (const [, item] of selected.value) {
      files.push(await downloadFile(item.id, item.name))
    }
    emit('confirm', files)
  } finally {
    downloading.value = false
  }
}

const isSpineFile = (name: string) => /\.(json|atlas|png)$/i.test(name)

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'json') return '{ }'
  if (ext === 'png') return '🖼'
  return '📄'
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 10px;
  width: 560px;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #333;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #eee;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.close-btn:hover { color: #eee; background: #2a2a2a; }

.tabs {
  display: flex;
  border-bottom: 1px solid #333;
}

.tab {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.tab.active {
  color: #4a9eff;
  border-bottom-color: #4a9eff;
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 8px 12px;
  min-height: 36px;
  border-bottom: 1px solid #2a2a2a;
}

.crumb {
  background: none;
  border: none;
  color: #4a9eff;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.crumb:not(.last):hover { background: #2a2a2a; }

.crumb:not(.last)::after {
  content: '›';
  color: #555;
  margin-left: 6px;
}

.crumb.last {
  color: #ccc;
  cursor: default;
  pointer-events: none;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.status {
  text-align: center;
  color: #666;
  padding: 40px;
  font-size: 13px;
}

.status.error { color: #f4845f; }

.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

.file-row:hover { background: #2a2a2a; }
.file-row.is-selected { background: rgba(74, 158, 255, 0.12); }

.file-icon {
  font-size: 14px;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: #aaa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-row.is-folder .file-name { color: #eee; }
.file-row.is-spine .file-name { color: #ddd; }

.file-check {
  flex-shrink: 0;
  accent-color: #4a9eff;
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #333;
}

.select-count {
  font-size: 12px;
  color: #888;
}

.btn-confirm {
  padding: 8px 20px;
  background: #4a9eff;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-confirm:hover:not(:disabled) { background: #3a8eef; }

.btn-confirm:disabled {
  background: #2a2a2a;
  color: #555;
  cursor: not-allowed;
}
</style>
