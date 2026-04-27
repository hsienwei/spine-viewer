<template>
  <div class="spine-viewer">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-copy">
          <div class="brand-title">
            <span class="brand-spine">SPINE</span>
            <span class="brand-viewer">VIEWER</span>
          </div>
          <span class="brand-version">v{{ appVersion }}</span>
        </div>
        <button class="theme-toggle" @click="toggleTheme" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
          <svg v-if="isDark" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.4"/>
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M10.01 3.99l1.06-1.06M2.93 11.07l1.06-1.06" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 8.5A5 5 0 1 1 5.5 2.5a3.5 3.5 0 0 0 6 6z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="sidebar-content">
        <div class="sidebar-panel">
          <button
            type="button"
            class="sidebar-panel-header"
            @click="isControlPanelOpen = !isControlPanelOpen"
          >
            <span>Controls</span>
            <svg class="panel-chevron" :class="{ open: isControlPanelOpen }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-show="isControlPanelOpen" class="sidebar-panel-body">
            <ControlPanel
              @file-selected="handleFileSelected"
              @animation-change="handleAnimationChange"
              @skin-change="handleSkinChange"
              @debug-option-change="handleDebugOptionChange"
              @premultiply-alpha-change="handlePremultipliedAlphaChange"
              @texture-filtering-change="handleTextureFilteringChange"
              :animations="animations"
              :skins="skins"
              :current-animation="animationName"
              :current-skin="currentSkin"
              :current-time="currentTime"
              :duration="duration"
              :draw-call="drawCall"
              :event-marker-count="currentAnimationMarkers.length"
              :detected-version="detectedVersion"
              :runtime-version="runtimeVersion"
              :initial-runtime-version="initialRuntimeVersion"
              :fallback-used="fallbackUsed"
              :debug-options="debugOptions"
              :premultiplied-alpha="premultipliedAlpha"
              :texture-filtering="textureFiltering"
            />
          </div>
        </div>

        <div v-if="hasStructurePanel" class="sidebar-panel">
          <button
            type="button"
            class="sidebar-panel-header"
            @click="isStructurePanelOpen = !isStructurePanelOpen"
          >
            <span>Skeleton</span>
            <svg class="panel-chevron" :class="{ open: isStructurePanelOpen }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-show="isStructurePanelOpen" class="sidebar-panel-body">
            <StructurePanel
              @bone-selected="handleBoneSelected"
              @slot-selected="handleSlotSelected"
              :structure="structure"
              :selection="selection"
            />
          </div>
        </div>

      </div>

      <div class="sidebar-footer">
        <button
          type="button"
          class="sidebar-link sidebar-link-button"
          @click="isInfoOpen = true"
        >
          Info
        </button>
        <a
          class="sidebar-link"
          :href="privacyPolicyUrl"
          target="_blank"
          rel="noreferrer"
        >
          Privacy Policy
        </a>
        <a
          class="sidebar-link"
          :href="termsOfServiceUrl"
          target="_blank"
          rel="noreferrer"
        >
          Terms of Service
        </a>
      </div>
    </aside>

    <main class="main-content">
      <SpineCanvas
        ref="spineCanvasRef"
        :files="sourceFiles"
        :animation-name="animationName"
        :skin-name="currentSkin"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        :debug-options="debugOptions"
        :selection="selection"
        :premultiplied-alpha="premultipliedAlpha"
        :texture-filtering="textureFiltering"
        @loaded="(data) => handleLoaded(data)"
        @time-update="(time, animDuration, frameDrawCall) => handleTimeUpdate(time, animDuration, frameDrawCall)"
        @runtime-event="(payload) => handleRuntimeEvent(payload)"
        @error="(err) => handleError(err)"
      />
      <PlaybackOverlay
        :visible="animations.length > 0"
        :animation-name="animationName"
        :current-time="currentTime"
        :duration="duration"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        :event-markers="currentAnimationMarkers"
        :runtime-notifications="visibleRuntimeNotifications"
        @playback-change="handlePlaybackChange"
        @seek="handleSeek"
        @speed-change="handleSpeedChange"
      />
    </main>

    <div
      v-if="isInfoOpen"
      class="info-modal-backdrop"
      @click.self="isInfoOpen = false"
    >
      <section
        class="info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
      >
        <div class="info-modal-header">
          <div>
            <p class="info-modal-kicker">About</p>
            <h2 id="info-modal-title" class="info-modal-title">Spine Viewer</h2>
          </div>
          <button
            type="button"
            class="info-modal-close"
            aria-label="Close info dialog"
            @click="isInfoOpen = false"
          >
            ×
          </button>
        </div>
        <div class="info-modal-body">
          <p class="info-modal-copy">
            Spine Viewer 是用來載入、檢視與播放 Spine 動畫資產的網頁工具，支援本機檔案與 Google Drive 檔案挑選。
          </p>
          <p class="info-modal-copy">
            Google Drive 權限只用於列出與下載你明確選取的檔案，供瀏覽器內預覽使用；詳細資料處理方式請參考 Privacy Policy。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import packageJson from '../package.json'
import ControlPanel from './components/ControlPanel.vue'
import PlaybackOverlay from './components/PlaybackOverlay.vue'
import SpineCanvas from './components/SpineCanvas.vue'
import StructurePanel from './components/StructurePanel.vue'
import { DEFAULT_SPINE_DEBUG_OPTIONS, DEFAULT_SPINE_TEXTURE_FILTERING } from './lib/spine/adapters'
import type { SpineAnimationEventMarker, SpineAnimationEventPayload, SpineAnimationSummary, SpineDebugOptions, SpineTextureFiltering } from './lib/spine/adapters'
import type { SpineSelectionState, SpineSkeletonStructure } from './lib/spine/skeletonStructure'
import type { SpineDetectedVersion, SpineMajorVersion } from './lib/spine/versionDetection'

const appVersion = packageJson.version

const sourceFiles = ref<File[]>([])
const animationName = ref('')
const currentSkin = ref('')
const isPlaying = ref(true)
const playbackRate = ref(1)
const debugOptions = ref<SpineDebugOptions>({ ...DEFAULT_SPINE_DEBUG_OPTIONS })
const premultipliedAlpha = ref(true)
const textureFiltering = ref<SpineTextureFiltering>(DEFAULT_SPINE_TEXTURE_FILTERING)
const spineCanvasRef = ref<InstanceType<typeof SpineCanvas> | null>(null)
const isControlPanelOpen = ref(true)
const isStructurePanelOpen = ref(true)
const isInfoOpen = ref(false)

const animations = ref<string[]>([])
const skins = ref<string[]>([])
const animationSummaries = ref<SpineAnimationSummary[]>([])
const structure = ref<SpineSkeletonStructure>({ bones: [], slots: [], totalBones: 0 })
const selection = ref<SpineSelectionState>({ boneName: null, slotName: null })
const currentTime = ref(0)
const duration = ref(0)
const drawCall = ref(0)
const detectedVersion = ref<SpineDetectedVersion | null>(null)
const runtimeVersion = ref<SpineMajorVersion | null>(null)
const initialRuntimeVersion = ref<SpineMajorVersion | null>(null)
const fallbackUsed = ref(false)

interface RuntimeNotificationRecord {
  id: number
  eventName: string
  animationName: string | null
  trackIndex: number
  trackTime: number | null
  receivedAt: string
  visible: boolean
  count: number
}

const runtimeNotifications = ref<RuntimeNotificationRecord[]>([])

const hasStructurePanel = computed(() => structure.value.bones.length > 0)
const currentAnimationSummary = computed(() => {
  return animationSummaries.value.find(animation => animation.name === animationName.value) || null
})
const currentAnimationMarkers = computed<SpineAnimationEventMarker[]>(() => {
  return currentAnimationSummary.value?.eventMarkers || []
})
const visibleRuntimeNotifications = computed(() => {
  return runtimeNotifications.value.filter(item => item.visible).slice(0, 3)
})
const privacyPolicyUrl = `${import.meta.env.BASE_URL}privacy-policy.html`
const termsOfServiceUrl = `${import.meta.env.BASE_URL}terms-of-service.html`

const THEME_KEY = 'spine-viewer-theme'
const RUNTIME_NOTIFICATION_LIMIT = 12
const RUNTIME_NOTIFICATION_DURATION_MS = 500
const RUNTIME_NOTIFICATION_DEDUPE_WINDOW_MS = 600
const EVENT_MARKER_TIME_TOLERANCE = 0.02
const isDark = ref(true)
let runtimeNotificationId = 0
const runtimeNotificationTimers = new Map<number, number>()

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    isInfoOpen.value = false
  }
}

const applyTheme = (dark: boolean) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
}

onMounted(() => {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = !window.matchMedia('(prefers-color-scheme: light)').matches
  }
  applyTheme(isDark.value)
  window.addEventListener('keydown', handleWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  runtimeNotificationTimers.forEach(timeoutId => window.clearTimeout(timeoutId))
  runtimeNotificationTimers.clear()
})

const handleFileSelected = (payload: { files: File[] }) => {
  sourceFiles.value = payload.files
  animations.value = []
  animationName.value = ''
  skins.value = []
  currentSkin.value = ''
  animationSummaries.value = []
  structure.value = { bones: [], slots: [], totalBones: 0 }
  selection.value = { boneName: null, slotName: null }
  currentTime.value = 0
  duration.value = 0
  drawCall.value = 0
  detectedVersion.value = null
  runtimeVersion.value = null
  initialRuntimeVersion.value = null
  fallbackUsed.value = false
  clearRuntimeNotifications()
}

const clearRuntimeNotifications = () => {
  runtimeNotificationTimers.forEach(timeoutId => window.clearTimeout(timeoutId))
  runtimeNotificationTimers.clear()
  runtimeNotifications.value = []
}

const handleAnimationChange = (name: string) => {
  animationName.value = name
  currentTime.value = 0
  duration.value = animationSummaries.value.find(animation => animation.name === name)?.duration || duration.value
  clearRuntimeNotifications()
}

const handleSkinChange = (name: string) => {
  currentSkin.value = name
}

const handlePlaybackChange = (playing: boolean) => {
  isPlaying.value = playing
}

const handleSpeedChange = (speed: number) => {
  playbackRate.value = speed
}

const handleSeek = (time: number) => {
  currentTime.value = time
  spineCanvasRef.value?.seekTo(time)
}

const handleDebugOptionChange = (key: keyof SpineDebugOptions, value: boolean) => {
  debugOptions.value = {
    ...debugOptions.value,
    [key]: value
  }
}

const handlePremultipliedAlphaChange = (value: boolean) => {
  premultipliedAlpha.value = value
}

const handleTextureFilteringChange = (value: SpineTextureFiltering) => {
  textureFiltering.value = value
}

const handleBoneSelected = (boneName: string) => {
  selection.value = {
    boneName,
    slotName: null
  }
}

const handleSlotSelected = (slotName: string, boneName: string) => {
  selection.value = {
    boneName,
    slotName
  }
}

const handleLoaded = (data: {
  animations: string[]
  animationSummaries: SpineAnimationSummary[]
  skins: string[]
  currentSkin: string
  skeletonName: string
  drawCall: number
  duration: number
  structure: SpineSkeletonStructure
  detectedVersion: SpineDetectedVersion
  initialRuntimeVersion: SpineMajorVersion
  runtimeVersion: SpineMajorVersion
  fallbackUsed: boolean
}) => {
  animations.value = data.animations
  skins.value = data.skins
  currentSkin.value = data.currentSkin
  animationSummaries.value = data.animationSummaries
  structure.value = data.structure
  selection.value = { boneName: null, slotName: null }
  clearRuntimeNotifications()
  if (data.animations.length > 0) {
    animationName.value = data.animations[0]
  }
  duration.value = data.duration || data.animationSummaries[0]?.duration || 2.5
  drawCall.value = data.drawCall
  currentTime.value = 0
  detectedVersion.value = data.detectedVersion
  initialRuntimeVersion.value = data.initialRuntimeVersion
  runtimeVersion.value = data.runtimeVersion
  fallbackUsed.value = data.fallbackUsed
}

const handleTimeUpdate = (time: number, animDuration: number, frameDrawCall: number) => {
  currentTime.value = time
  duration.value = animDuration || duration.value
  drawCall.value = frameDrawCall
}

const hideRuntimeNotification = (notificationId: number) => {
  runtimeNotificationTimers.delete(notificationId)
  runtimeNotifications.value = runtimeNotifications.value.map(item => (
    item.id === notificationId
      ? { ...item, visible: false }
      : item
  ))
}

const patchMarkerEventNameFromRuntime = (payload: SpineAnimationEventPayload) => {
  const eventName = payload.eventName?.trim()
  const eventTime = payload.trackTime
  const targetAnimationName = payload.animationName || animationName.value

  if (!eventName || typeof eventTime !== 'number' || !targetAnimationName) return

  animationSummaries.value = animationSummaries.value.map(summary => {
    if (summary.name !== targetAnimationName) return summary

    let changed = false
    const nextMarkers = summary.eventMarkers.map(marker => {
      if (Math.abs(marker.time - eventTime) >= EVENT_MARKER_TIME_TOLERANCE) {
        return marker
      }

      const unnamedEventIndex = marker.events.findIndex(event => {
        const currentName = event.eventName?.trim() || ''
        return !currentName || currentName === 'Unnamed event'
      })

      if (unnamedEventIndex === -1) return marker

      const nextEvents = marker.events.map((event, index) => {
        if (index !== unnamedEventIndex) return event

        return {
          ...event,
          eventName
        }
      })

      changed = true
      return {
        ...marker,
        events: nextEvents
      }
    })

    if (!changed) return summary

    return {
      ...summary,
      eventMarkers: nextMarkers
    }
  })
}

const handleRuntimeEvent = (payload: SpineAnimationEventPayload) => {
  if (payload.type !== 'event') return

  patchMarkerEventNameFromRuntime(payload)

  const now = new Date()
  const previousItem = runtimeNotifications.value[0]
  const sameAsPrevious = previousItem
    && previousItem.eventName === (payload.eventName || 'Unnamed event')
    && previousItem.animationName === payload.animationName
    && previousItem.trackIndex === payload.trackIndex
    && previousItem.trackTime !== null
    && payload.trackTime !== null
    && Math.abs(previousItem.trackTime - payload.trackTime) < 0.001
    && (now.getTime() - new Date(previousItem.receivedAt).getTime()) <= RUNTIME_NOTIFICATION_DEDUPE_WINDOW_MS

  if (sameAsPrevious) {
    const timerId = runtimeNotificationTimers.get(previousItem.id)
    if (timerId !== undefined) {
      window.clearTimeout(timerId)
    }

    runtimeNotifications.value = runtimeNotifications.value.map(item => (
      item.id === previousItem.id
        ? {
            ...item,
            count: item.count + 1,
            receivedAt: now.toISOString(),
            visible: true
          }
        : item
    ))

    const timeoutId = window.setTimeout(() => hideRuntimeNotification(previousItem.id), RUNTIME_NOTIFICATION_DURATION_MS)
    runtimeNotificationTimers.set(previousItem.id, timeoutId)
    return
  }

  const id = ++runtimeNotificationId
  const nextItem: RuntimeNotificationRecord = {
    id,
    eventName: payload.eventName || 'Unnamed event',
    animationName: payload.animationName,
    trackIndex: payload.trackIndex,
    trackTime: payload.trackTime,
    receivedAt: now.toISOString(),
    visible: true,
    count: 1
  }

  runtimeNotifications.value = [nextItem, ...runtimeNotifications.value]
    .slice(0, RUNTIME_NOTIFICATION_LIMIT)

  const timeoutId = window.setTimeout(() => hideRuntimeNotification(id), RUNTIME_NOTIFICATION_DURATION_MS)
  runtimeNotificationTimers.set(id, timeoutId)

  const removedIds = [...runtimeNotificationTimers.keys()].filter(activeId => !runtimeNotifications.value.some(item => item.id === activeId))
  removedIds.forEach(removedId => {
    const timerId = runtimeNotificationTimers.get(removedId)
    if (timerId !== undefined) {
      window.clearTimeout(timerId)
      runtimeNotificationTimers.delete(removedId)
    }
  })
}

const handleError = (error: string) => {
  console.error('Spine Canvas Error:', error)
}
</script>

<style>
:root {
  /* Dark theme (default) */
  --bg-base:      #0c0b0a;
  --bg-panel:     #131110;
  --bg-surface:   #1c1917;
  --bg-raised:    #242018;
  --border:       #2e2720;
  --border-muted: #1f1c17;
  --border-glow:  rgba(201, 141, 42, 0.35);
  --bg-overlay:   rgba(13, 11, 10, 0.92);

  --text-primary:   #f5ede0;
  --text-secondary: #c2ae98;
  --text-muted:     #8a7e72;

  --accent:       #c98d2a;
  --accent-dim:   rgba(201, 141, 42, 0.12);
  --accent-glow:  rgba(201, 141, 42, 0.25);
  --success:      #5fad82;
  --info:         #5b96d4;
  --danger:       #c46b5a;
  --event-highlight-fill:       #ffe27a;
  --event-highlight-border:     rgba(55, 39, 6, 0.95);
  --event-highlight-ring:       rgba(255, 226, 122, 0.24);
  --event-highlight-glow:       rgba(255, 226, 122, 0.78);
  --event-highlight-glow-wide:  rgba(255, 226, 122, 0.4);
  --tooltip-bg: rgba(11, 14, 18, 0.94);
  --tooltip-border: rgba(91, 150, 212, 0.36);
  --tooltip-text: #f5ede0;
  --tooltip-muted: #8fc0f1;

  --font-ui:   'Syne', 'Noto Sans TC', sans-serif;
  --font-mono: 'DM Mono', 'Noto Sans TC', monospace;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 14px;
  --transition: 0.15s ease;
}

:root[data-theme="light"] {
  --bg-base:      #f5f0e8;
  --bg-panel:     #ede7db;
  --bg-surface:   #e4ddd1;
  --bg-raised:    #d8d0c3;
  --border:       #c5bdb0;
  --border-muted: #d4ccbf;
  --border-glow:  rgba(160, 100, 14, 0.45);
  --bg-overlay:   rgba(232, 225, 212, 0.95);

  --text-primary:   #1c1610;
  --text-secondary: #4a4038;
  --text-muted:     #7a7060;

  --accent:       #a06c10;
  --accent-dim:   rgba(160, 108, 16, 0.1);
  --accent-glow:  rgba(160, 108, 16, 0.22);
  --success:      #2e8a56;
  --info:         #2e6cb8;
  --danger:       #b04030;
  --event-highlight-fill:       #c97700;
  --event-highlight-border:     rgba(255, 248, 235, 0.95);
  --event-highlight-ring:       rgba(201, 119, 0, 0.28);
  --event-highlight-glow:       rgba(173, 95, 0, 0.88);
  --event-highlight-glow-wide:  rgba(173, 95, 0, 0.45);
  --tooltip-bg: rgba(248, 242, 233, 0.98);
  --tooltip-border: rgba(46, 108, 184, 0.3);
  --tooltip-text: #1c1610;
  --tooltip-muted: #2e6cb8;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--font-ui);
}

.spine-viewer {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--bg-base);
  color: var(--text-primary);
}

.sidebar {
  width: 272px;
  min-width: 272px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-panel);
}

.sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.sidebar-content::-webkit-scrollbar { width: 4px; }
.sidebar-content::-webkit-scrollbar-track { background: transparent; }
.sidebar-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.sidebar-footer {
  margin-top: auto;
  padding: 14px 16px 18px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 1;
  background: var(--bg-panel);
  box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.16);
}

.sidebar-link {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--transition);
}

.sidebar-link:hover {
  color: var(--accent);
}

.sidebar-link-button {
  justify-content: flex-start;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-brand-copy {
  flex: 1;
  min-width: 0;
}

.brand-title {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.brand-spine {
  font-family: var(--font-ui);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.brand-viewer {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.28em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.brand-version {
  display: inline-block;
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--transition), border-color var(--transition), background var(--transition);
}

.theme-toggle:hover {
  color: var(--accent);
  border-color: var(--border-glow);
  background: var(--accent-dim);
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border);
}

.sidebar-panel-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 16px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--transition), background var(--transition);
  flex-shrink: 0;
}

.sidebar-panel-header:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.02);
}

.panel-chevron {
  color: var(--text-muted);
  transition: transform var(--transition), color var(--transition);
  flex-shrink: 0;
}

.panel-chevron.open {
  transform: rotate(180deg);
  color: var(--accent);
}

.sidebar-panel-body {
  overflow: visible;
}

.main-content {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.info-modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(7, 6, 5, 0.68);
  backdrop-filter: blur(4px);
  z-index: 1200;
}

.info-modal {
  width: min(100%, 460px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.info-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--border);
}

.info-modal-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.info-modal-title {
  margin-top: 6px;
  font-size: 20px;
  color: var(--text-primary);
}

.info-modal-close {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition), background var(--transition);
}

.info-modal-close:hover {
  color: var(--accent);
  border-color: var(--border-glow);
  background: var(--accent-dim);
}

.info-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
}

.info-modal-copy {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-secondary);
}
</style>
