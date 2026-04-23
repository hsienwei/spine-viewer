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
            @premultiply-alpha-change="handlePremultipliedAlphaChange"
            :animations="animations"
            :current-animation="animationName"
            :current-time="currentTime"
            :duration="duration"
            :draw-call="drawCall"
            :detected-version="detectedVersion"
            :runtime-version="runtimeVersion"
            :premultiplied-alpha="premultipliedAlpha"
          />
        </div>
      </div>

      <div v-if="hasStructurePanel" class="sidebar-panel sidebar-panel-fill">
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
            @show-bones-change="handleShowBonesChange"
            @show-slots-change="handleShowSlotsChange"
            @bone-selected="handleBoneSelected"
            @slot-selected="handleSlotSelected"
            :structure="structure"
            :selection="selection"
            :show-bones="showBones"
            :show-slots="showSlots"
          />
        </div>
      </div>
    </aside>

    <main class="main-content">
      <SpineCanvas
        ref="spineCanvasRef"
        :files="sourceFiles"
        :animation-name="animationName"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        :show-bones="showBones"
        :show-slots="showSlots"
        :selection="selection"
        :premultiplied-alpha="premultipliedAlpha"
        @loaded="(data) => handleLoaded(data)"
        @time-update="(time, animDuration, frameDrawCall) => handleTimeUpdate(time, animDuration, frameDrawCall)"
        @error="(err) => handleError(err)"
      />
      <PlaybackOverlay
        :visible="animations.length > 0"
        :current-time="currentTime"
        :duration="duration"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        @playback-change="handlePlaybackChange"
        @seek="handleSeek"
        @speed-change="handleSpeedChange"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import packageJson from '../package.json'
import ControlPanel from './components/ControlPanel.vue'
import PlaybackOverlay from './components/PlaybackOverlay.vue'
import SpineCanvas from './components/SpineCanvas.vue'
import StructurePanel from './components/StructurePanel.vue'
import type { SpineSelectionState, SpineSkeletonStructure } from './lib/spine/skeletonStructure'
import type { SpineDetectedVersion, SpineMajorVersion } from './lib/spine/versionDetection'

const appVersion = packageJson.version

const sourceFiles = ref<File[]>([])
const animationName = ref('')
const isPlaying = ref(true)
const playbackRate = ref(1)
const showBones = ref(false)
const showSlots = ref(false)
const premultipliedAlpha = ref(true)
const spineCanvasRef = ref<InstanceType<typeof SpineCanvas> | null>(null)
const isControlPanelOpen = ref(true)
const isStructurePanelOpen = ref(true)

const animations = ref<string[]>([])
const structure = ref<SpineSkeletonStructure>({ bones: [], slots: [], totalBones: 0 })
const selection = ref<SpineSelectionState>({ boneName: null, slotName: null })
const currentTime = ref(0)
const duration = ref(0)
const drawCall = ref(0)
const detectedVersion = ref<SpineDetectedVersion | null>(null)
const runtimeVersion = ref<SpineMajorVersion | null>(null)

const hasStructurePanel = computed(() => structure.value.bones.length > 0)

const THEME_KEY = 'spine-viewer-theme'
const isDark = ref(true)

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
})

const handleFileSelected = (payload: { files: File[] }) => {
  sourceFiles.value = payload.files
  detectedVersion.value = null
  runtimeVersion.value = null
}

const handleAnimationChange = (name: string) => {
  animationName.value = name
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

const handleShowBonesChange = (value: boolean) => {
  showBones.value = value
}

const handleShowSlotsChange = (value: boolean) => {
  showSlots.value = value
}

const handlePremultipliedAlphaChange = (value: boolean) => {
  premultipliedAlpha.value = value
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
  skeletonName: string
  drawCall: number
  duration: number
  structure: SpineSkeletonStructure
  detectedVersion: SpineDetectedVersion
  runtimeVersion: SpineMajorVersion
}) => {
  animations.value = data.animations
  structure.value = data.structure
  selection.value = { boneName: null, slotName: null }
  if (data.animations.length > 0) {
    animationName.value = data.animations[0]
    duration.value = data.duration || 2.5
  }
  drawCall.value = data.drawCall
  currentTime.value = 0
  detectedVersion.value = data.detectedVersion
  runtimeVersion.value = data.runtimeVersion
}

const handleTimeUpdate = (time: number, animDuration: number, frameDrawCall: number) => {
  currentTime.value = time
  duration.value = animDuration || duration.value
  drawCall.value = frameDrawCall
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
  min-height: 0;
  border-bottom: 1px solid var(--border);
}

.sidebar-panel-fill {
  flex: 1;
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
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.main-content {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}
</style>
