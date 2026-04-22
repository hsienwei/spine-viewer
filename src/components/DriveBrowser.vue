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
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 560px;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(201, 141, 42, 0.06);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 3px 7px;
  border-radius: var(--radius-sm);
  transition: color var(--transition), background var(--transition), border-color var(--transition);
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-raised);
  border-color: var(--border);
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}

.tab {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition);
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab:not(.active):hover {
  color: var(--text-secondary);
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 7px 12px;
  min-height: 34px;
  border-bottom: 1px solid var(--border-muted);
}

.crumb {
  background: none;
  border: none;
  color: var(--accent);
  font-family: var(--font-ui);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: background var(--transition);
}

.crumb:not(.last):hover { background: var(--bg-raised); }

.crumb:not(.last)::after {
  content: '›';
  color: var(--text-muted);
  margin-left: 6px;
}

.crumb.last {
  color: var(--text-secondary);
  cursor: default;
  pointer-events: none;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.file-list::-webkit-scrollbar { width: 4px; }
.file-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.status {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
  font-family: var(--font-ui);
  font-size: 12px;
}

.status.error { color: var(--danger); }

.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition);
  user-select: none;
}

.file-row:hover { background: var(--bg-raised); }

.file-row.is-selected {
  background: var(--accent-dim);
  border-left: 2px solid var(--accent);
  padding-left: 8px;
}

.file-icon {
  font-size: 13px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-row.is-folder .file-name { color: var(--text-primary); }
.file-row.is-spine .file-name { color: var(--text-primary); }

.file-check {
  flex-shrink: 0;
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}

.select-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.btn-confirm {
  padding: 8px 20px;
  background: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  color: #0c0b0a;
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background var(--transition), box-shadow var(--transition);
}

.btn-confirm:hover:not(:disabled) {
  background: #dba040;
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.btn-confirm:disabled {
  background: var(--bg-raised);
  border-color: var(--border);
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>
