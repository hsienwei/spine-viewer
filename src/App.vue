<template>
  <div class="spine-viewer">
    <aside class="sidebar">
      <div class="sidebar-panel">
        <button
          type="button"
          class="sidebar-panel-header"
          @click="isControlPanelOpen = !isControlPanelOpen"
        >
          <span>Viewer Controls</span>
          <span class="sidebar-panel-toggle">{{ isControlPanelOpen ? '−' : '+' }}</span>
        </button>
        <div v-show="isControlPanelOpen" class="sidebar-panel-body">
          <ControlPanel
            @file-selected="handleFileSelected"
            @animation-change="handleAnimationChange"
            :animations="animations"
            :current-animation="animationName"
            :current-time="currentTime"
            :duration="duration"
            :draw-call="drawCall"
            :detected-version="detectedVersion"
            :runtime-version="runtimeVersion"
          />
        </div>
      </div>
      <div v-if="hasStructurePanel" class="sidebar-panel sidebar-panel-fill">
        <button
          type="button"
          class="sidebar-panel-header"
          @click="isStructurePanelOpen = !isStructurePanelOpen"
        >
          <span>Slots & Bones</span>
          <span class="sidebar-panel-toggle">{{ isStructurePanelOpen ? '−' : '+' }}</span>
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
import { computed, ref } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import PlaybackOverlay from './components/PlaybackOverlay.vue'
import SpineCanvas from './components/SpineCanvas.vue'
import StructurePanel from './components/StructurePanel.vue'
import type { SpineSelectionState, SpineSkeletonStructure } from './lib/spine/skeletonStructure'
import type { SpineDetectedVersion, SpineMajorVersion } from './lib/spine/versionDetection'

const sourceFiles = ref<File[]>([])
const animationName = ref('')
const isPlaying = ref(true)
const playbackRate = ref(1)
const showBones = ref(false)
const showSlots = ref(false)
const spineCanvasRef = ref<InstanceType<typeof SpineCanvas> | null>(null)
const isControlPanelOpen = ref(true)
const isStructurePanelOpen = ref(true)

const animations = ref<string[]>([])
const structure = ref<SpineSkeletonStructure>({ bones: [], slots: [] })
const selection = ref<SpineSelectionState>({ boneName: null, slotName: null })
const currentTime = ref(0)
const duration = ref(0)
const drawCall = ref(0)
const detectedVersion = ref<SpineDetectedVersion | null>(null)
const runtimeVersion = ref<SpineMajorVersion | null>(null)

const hasStructurePanel = computed(() => structure.value.bones.length > 0)

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
  width: 320px;
  min-width: 320px;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow: hidden;
  background: #1d1d1d;
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #333;
  border-radius: 12px;
  background: #222;
  overflow: hidden;
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
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid #333;
  background: #272727;
  color: #f1f1f1;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.sidebar-panel-toggle {
  color: #8fb7ff;
  font-size: 20px;
  line-height: 1;
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
