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
            @click="isLoadFilesPanelOpen = !isLoadFilesPanelOpen"
          >
            <span>Load Files</span>
            <svg class="panel-chevron" :class="{ open: isLoadFilesPanelOpen }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-show="isLoadFilesPanelOpen" class="sidebar-panel-body">
            <LoadFilesPanel
              @file-selected="handleFileSelected"
            />
          </div>
        </div>

        <div v-if="animations.length > 0" class="sidebar-panel">
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
              @tracks-change="handleTracksChange"
              @skin-change="handleSkinChange"
              @debug-option-change="handleDebugOptionChange"
              @premultiply-alpha-change="handlePremultipliedAlphaChange"
              @texture-filtering-change="handleTextureFilteringChange"
              :animations="animations"
              :skins="skins"
              :tracks="animationTracks"
              :is-playing="isPlaying"
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

        <div v-if="shareHistory.length > 0" class="sidebar-panel">
          <button
            type="button"
            class="sidebar-panel-header"
            @click="isShareHistoryOpen = !isShareHistoryOpen"
          >
            <span>Share History</span>
            <svg class="panel-chevron" :class="{ open: isShareHistoryOpen }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-show="isShareHistoryOpen" class="sidebar-panel-body">
            <div class="share-history-list">
              <div 
                v-for="item in shareHistory"  
                :key="item.token"  
                class="share-history-item"  
                :class="`share-history-item--${getShareHistoryStatus(item)}`"  
              >  
                <div class="share-history-meta">  
                  <div class="share-history-title-row">
                    <span class="share-history-title">{{ item.skeletonName }}</span>
                    <span class="share-history-status" :class="`share-history-status--${getShareHistoryStatus(item)}`">
                      {{ getShareHistoryStatusLabel(item) }}
                    </span>
                  </div>
                  <span class="share-history-subtitle">  
                    Expires {{ formatShareDate(item.expiresAt) }}  
                  </span>  
                </div>  
                <div class="share-history-actions"> 
                  <button type="button" class="mini-action-btn" :disabled="!isShareHistoryActionAllowed(item)" @click="openShareLink(item.shareUrl)">Open</button> 
                  <button type="button" class="mini-action-btn" :disabled="!isShareHistoryActionAllowed(item)" @click="copyShareLink(item.shareUrl)">Copy</button> 
                  <button 
                    type="button" 
                    class="mini-action-btn danger" 
                    :disabled="getShareHistoryStatus(item) !== 'active' || !!item.revoking" 
                    @click="handleRevokeShare(item.token)" 
                  > 
                    {{ item.revoking ? 'Revoking...' : getShareHistoryRevokeLabel(item) }} 
                  </button> 
                  <button 
                    type="button" 
                    class="mini-action-btn danger" 
                    @click="deleteShareHistory(item.token)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
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
          v-if="canShare"
          type="button"
          class="sidebar-link sidebar-link-button"
          :disabled="isSharing"
          @click="handleCreateShare"
        >
          {{ isSharing ? 'Sharing...' : 'Share' }}
        </button>
        <p v-if="shareStatusText" class="sidebar-status" :class="{ error: !!shareError }">
          {{ shareStatusText }}
        </p>
        <a
          v-if="shareUrl"
          class="sidebar-link"
          :href="shareUrl"
          target="_blank"
          rel="noreferrer"
        >
          Open Share Link
        </a>
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
        :animation-tracks="animationTracks"
        :skin-name="currentSkin"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        :debug-options="debugOptions"
        :selection="selection"
        :premultiplied-alpha="premultipliedAlpha"
        :texture-filtering="textureFiltering"
        :watermark-label="activeWatermarkLabel"
        @loaded="(data) => handleLoaded(data)"
        @time-update="(state) => handleTimeUpdate(state)"
        @runtime-event="(payload) => handleRuntimeEvent(payload)"
        @error="(err) => handleError(err)"
      />
      <PlaybackOverlay
        :visible="animations.length > 0"
        :track-options="overlayTrackOptions"
        :observed-track-index="overlayTrackIndex"
        :animation-name="observedAnimationName"
        :current-time="currentTime"
        :duration="duration"
        :is-playing="isPlaying"
        :playback-rate="playbackRate"
        :event-markers="currentAnimationMarkers"
        :runtime-notifications="visibleRuntimeNotifications"
        @track-change="handleOverlayTrackChange"
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
import LoadFilesPanel from './components/LoadFilesPanel.vue'
import PlaybackOverlay from './components/PlaybackOverlay.vue'
import SpineCanvas from './components/SpineCanvas.vue'
import StructurePanel from './components/StructurePanel.vue'
import { DEFAULT_SPINE_DEBUG_OPTIONS, DEFAULT_SPINE_TEXTURE_FILTERING } from './lib/spine/adapters'
import type { SpineAnimationEventMarker, SpineAnimationEventPayload, SpineAnimationSummary, SpineDebugOptions, SpineTextureFiltering, SpineTrackEntry, SpineTrackPlaybackState } from './lib/spine/adapters'
import type { SpineSelectionState, SpineSkeletonStructure } from './lib/spine/skeletonStructure'
import { classifySpineFiles, type SpineDetectedVersion, type SpineMajorVersion } from './lib/spine/versionDetection'
import { createShareLink, extractShareTokenFromPath, fetchShareManifest, fetchSharedSourceFiles, revokeShareLink } from './lib/share/api'
import { prepareShareUpload } from './lib/share/prepareShareUpload'
import type { ShareManifest } from './lib/share/types'

const appVersion = packageJson.version

const sourceFiles = ref<File[]>([])
const animationName = ref('')
const animationTracks = ref<SpineTrackEntry[]>([])
const overlayTrackIndex = ref(0)
const currentSkin = ref('')
const isPlaying = ref(true)
const playbackRate = ref(1)
const debugOptions = ref<SpineDebugOptions>({ ...DEFAULT_SPINE_DEBUG_OPTIONS })
const premultipliedAlpha = ref(true)
const textureFiltering = ref<SpineTextureFiltering>(DEFAULT_SPINE_TEXTURE_FILTERING)
const spineCanvasRef = ref<InstanceType<typeof SpineCanvas> | null>(null)
const isLoadFilesPanelOpen = ref(true)
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
const trackPlaybackStates = ref<SpineTrackPlaybackState[]>([])
const detectedVersion = ref<SpineDetectedVersion | null>(null)
const runtimeVersion = ref<SpineMajorVersion | null>(null)
const initialRuntimeVersion = ref<SpineMajorVersion | null>(null)
const fallbackUsed = ref(false)
const isSharing = ref(false)
const shareUrl = ref('')
const shareExpiresAt = ref('')
const shareError = ref('')
const shareToken = ref('')
const shareManifest = ref<ShareManifest | null>(null)
const isShareHistoryOpen = ref(true)

interface ShareHistoryEntry {
  token: string
  shareUrl: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  skeletonName: string
  atlasName: string
  watermarkLabel: string
  revoking?: boolean
}

const SHARE_HISTORY_KEY = 'spine-viewer-share-history'
const shareHistory = ref<ShareHistoryEntry[]>([])

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
const canShare = computed(() => sourceFiles.value.length > 0 && animations.value.length > 0) 
const activeWatermarkLabel = computed(() => shareManifest.value?.watermark.label || '') 
const shareStatusText = computed(() => { 
  if (shareError.value) return shareError.value
  if (shareUrl.value && shareExpiresAt.value) {
    return `Share link ready. Expires ${new Date(shareExpiresAt.value).toLocaleString()}.`
  }
  if (shareToken.value && shareManifest.value) {
    return `Shared preview. Expires ${new Date(shareManifest.value.expiresAt).toLocaleString()}.`
  } 
  return '' 
}) 
const sortShareHistory = (entries: ShareHistoryEntry[]) => { 
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) 
} 

const getShareHistoryStatus = (item: ShareHistoryEntry) => {
  if (item.revokedAt) return 'revoked'
  if (Date.parse(item.expiresAt) <= Date.now()) return 'expired'
  return 'active'
}

const getShareHistoryStatusLabel = (item: ShareHistoryEntry) => {
  const status = getShareHistoryStatus(item)
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Active'
}

const getShareHistoryRevokeLabel = (item: ShareHistoryEntry) => {
  const status = getShareHistoryStatus(item)
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Revoke'
}

const isShareHistoryActionAllowed = (item: ShareHistoryEntry) => {
  return getShareHistoryStatus(item) === 'active'
}

const loadShareHistory = () => { 
  try {
    const saved = localStorage.getItem(SHARE_HISTORY_KEY)
    if (!saved) return

    const parsed = JSON.parse(saved) as ShareHistoryEntry[]
    shareHistory.value = sortShareHistory(
      parsed.filter(item => item && typeof item.token === 'string' && typeof item.shareUrl === 'string')
    )
  } catch {
    shareHistory.value = []
  }
}

const persistShareHistory = () => {
  localStorage.setItem(SHARE_HISTORY_KEY, JSON.stringify(shareHistory.value))
}

const upsertShareHistory = (entry: ShareHistoryEntry) => {
  const nextEntries = shareHistory.value.filter(item => item.token !== entry.token)
  shareHistory.value = sortShareHistory([entry, ...nextEntries])
  persistShareHistory()
}

const markShareHistoryRevoked = (token: string, revokedAt: string) => { 
  shareHistory.value = shareHistory.value.map(item => ( 
    item.token === token 
      ? { ...item, revokedAt, revoking: false } 
      : item 
  )) 
  persistShareHistory() 
} 

const deleteShareHistory = (token: string) => {
  shareHistory.value = shareHistory.value.filter(item => item.token !== token)
  persistShareHistory()
}

const formatShareDate = (value: string) => { 
  return new Date(value).toLocaleString() 
} 

const copyShareLink = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    window.prompt('Copy share link', url)
  }
}

const openShareLink = (url: string) => {
  window.open(url, '_blank', 'noreferrer')
}
const observedTrackState = computed(() => { 
  return trackPlaybackStates.value.find(track => track.trackIndex === overlayTrackIndex.value) || null
})
const observedAnimationName = computed(() => {
  if (observedTrackState.value?.animationName) return observedTrackState.value.animationName
  return animationTracks.value.find(track => track.trackIndex === overlayTrackIndex.value)?.animationName || ''
})
const currentAnimationSummary = computed(() => {
  if (!observedAnimationName.value) return null
  return animationSummaries.value.find(animation => animation.name === observedAnimationName.value) || null
})
const currentAnimationMarkers = computed<SpineAnimationEventMarker[]>(() => {
  return currentAnimationSummary.value?.eventMarkers || []
})
const visibleRuntimeNotifications = computed(() => {
  return runtimeNotifications.value
    .filter(item => item.visible && item.trackIndex === overlayTrackIndex.value)
    .slice(0, 3)
})
const overlayTrackOptions = computed(() => {
  const indices = new Set<number>()
  animationTracks.value.forEach(track => indices.add(track.trackIndex))
  trackPlaybackStates.value.forEach(track => indices.add(track.trackIndex))

  return [...indices]
    .sort((a, b) => a - b)
    .map(trackIndex => {
      const configuredTrack = animationTracks.value.find(track => track.trackIndex === trackIndex)
      const activeTrack = trackPlaybackStates.value.find(track => track.trackIndex === trackIndex)
      return {
        trackIndex,
        animationName: activeTrack?.animationName || configuredTrack?.animationName || ''
      }
    })
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

const resetViewerState = () => {
  animations.value = []
  animationName.value = ''
  animationTracks.value = []
  overlayTrackIndex.value = 0
  skins.value = []
  currentSkin.value = ''
  animationSummaries.value = []
  structure.value = { bones: [], slots: [], totalBones: 0 }
  selection.value = { boneName: null, slotName: null }
  currentTime.value = 0
  duration.value = 0
  drawCall.value = 0
  trackPlaybackStates.value = []
  detectedVersion.value = null
  runtimeVersion.value = null
  initialRuntimeVersion.value = null
  fallbackUsed.value = false
  clearRuntimeNotifications()
}

const loadSharedSession = async (token: string) => {
  shareError.value = ''
  shareUrl.value = ''
  shareExpiresAt.value = ''
  shareToken.value = token
  resetViewerState()

  try {
    const manifest = await fetchShareManifest(token)
    const sharedFiles = await fetchSharedSourceFiles(token, manifest)
    shareManifest.value = manifest
    sourceFiles.value = [
      sharedFiles.skeletonFile,
      sharedFiles.atlasFile,
      ...sharedFiles.textureFiles
    ]
    isLoadFilesPanelOpen.value = false
  } catch (error) {
    shareManifest.value = null
    shareError.value = error instanceof Error ? error.message : 'Failed to load shared assets'
  }
}

onMounted(() => { 
  loadShareHistory()
  const saved = localStorage.getItem(THEME_KEY) 
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = !window.matchMedia('(prefers-color-scheme: light)').matches
  }
  applyTheme(isDark.value)
  window.addEventListener('keydown', handleWindowKeydown)

  const initialShareToken = extractShareTokenFromPath(window.location.pathname)
  if (initialShareToken) {
    void loadSharedSession(initialShareToken)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  runtimeNotificationTimers.forEach(timeoutId => window.clearTimeout(timeoutId))
  runtimeNotificationTimers.clear()
})

const handleFileSelected = (payload: { files: File[] }) => {
  sourceFiles.value = payload.files
  shareManifest.value = null
  shareToken.value = ''
  shareUrl.value = ''
  shareExpiresAt.value = ''
  shareError.value = ''
  resetViewerState()
}

const clearRuntimeNotifications = () => {
  runtimeNotificationTimers.forEach(timeoutId => window.clearTimeout(timeoutId))
  runtimeNotificationTimers.clear()
  runtimeNotifications.value = []
}

const normalizeTracks = (tracks: SpineTrackEntry[]) => {
  return tracks
    .filter(track => Number.isInteger(track.trackIndex) && track.trackIndex >= 0)
    .map(track => ({
      trackIndex: track.trackIndex,
      animationName: track.animationName || '',
      loop: track.loop !== false,
      mixDuration: Math.max(0, track.mixDuration || 0)
    }))
    .sort((a, b) => a.trackIndex - b.trackIndex)
    .map((track, index) => ({
      ...track,
      trackIndex: index
    }))
}

const syncPrimaryTrackState = (tracks: SpineTrackEntry[]) => {
  const primaryTrack = tracks.find(track => !!track.animationName)
  animationName.value = primaryTrack?.animationName || ''
  currentTime.value = 0
  duration.value = primaryTrack?.animationName
    ? (animationSummaries.value.find(animation => animation.name === primaryTrack.animationName)?.duration || duration.value)
    : 0
  clearRuntimeNotifications()
}

const handleTracksChange = (tracks: SpineTrackEntry[]) => {
  const normalizedTracks = normalizeTracks(tracks)
  animationTracks.value = normalizedTracks
  if (!normalizedTracks.some(track => track.trackIndex === overlayTrackIndex.value)) {
    overlayTrackIndex.value = normalizedTracks[0]?.trackIndex || 0
  }
  syncPrimaryTrackState(normalizedTracks)
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
  spineCanvasRef.value?.seekTo(time, overlayTrackIndex.value)
}

const handleOverlayTrackChange = (trackIndex: number) => {
  overlayTrackIndex.value = trackIndex
  const trackState = trackPlaybackStates.value.find(track => track.trackIndex === trackIndex)
  currentTime.value = trackState?.currentTime || 0
  duration.value = trackState?.duration || 0
  clearRuntimeNotifications()
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
    const initialTrack = {
      trackIndex: 0,
      animationName: data.animations[0],
      loop: true,
      mixDuration: 0
    }
    animationTracks.value = [initialTrack]
    overlayTrackIndex.value = 0
    animationName.value = initialTrack.animationName
  } else {
    animationTracks.value = []
    overlayTrackIndex.value = 0
    animationName.value = ''
  }
  duration.value = data.duration || data.animationSummaries[0]?.duration || 2.5
  drawCall.value = data.drawCall
  currentTime.value = 0
  trackPlaybackStates.value = []
  detectedVersion.value = data.detectedVersion
  initialRuntimeVersion.value = data.initialRuntimeVersion
  runtimeVersion.value = data.runtimeVersion
  fallbackUsed.value = data.fallbackUsed
}

const handleTimeUpdate = (state: {
  currentTime: number
  duration: number
  drawCall: number
  tracks: SpineTrackPlaybackState[]
}) => {
  trackPlaybackStates.value = state.tracks
  const observedState = state.tracks.find(track => track.trackIndex === overlayTrackIndex.value)
  currentTime.value = observedState?.currentTime ?? state.currentTime
  duration.value = observedState?.duration ?? state.duration ?? duration.value
  drawCall.value = state.drawCall
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

const handleCreateShare = async () => {
  if (!canShare.value || isSharing.value) return

  shareError.value = ''
  shareUrl.value = ''
  shareExpiresAt.value = ''
  isSharing.value = true

  try { 
    const prepared = await prepareShareUpload(classifySpineFiles(sourceFiles.value)) 
    const result = await createShareLink(prepared) 
    upsertShareHistory({
      token: result.token,
      shareUrl: result.shareUrl,
      createdAt: prepared.manifest.createdAt,
      expiresAt: result.expiresAt,
      revokedAt: null,
      skeletonName: prepared.manifest.files.skeleton.name,
      atlasName: prepared.manifest.files.atlas.name,
      watermarkLabel: prepared.manifest.watermark.label
    })
    shareUrl.value = result.shareUrl 
    shareExpiresAt.value = result.expiresAt 
    await navigator.clipboard?.writeText(result.shareUrl) 
  } catch (error) { 
    shareError.value = error instanceof Error ? error.message : 'Failed to create share link' 
  } finally { 
    isSharing.value = false 
  } 
} 

const handleRevokeShare = async (token: string) => { 
  const currentItem = shareHistory.value.find(item => item.token === token) 
  if (!currentItem || getShareHistoryStatus(currentItem) !== 'active') return

  shareHistory.value = shareHistory.value.map(item => (
    item.token === token
      ? { ...item, revoking: true }
      : item
  ))

  try {
    const result = await revokeShareLink(token)
    markShareHistoryRevoked(token, result.revokedAt)
    if (shareToken.value === token) {
      shareError.value = 'Share link revoked'
    }
  } catch (error) {
    shareHistory.value = shareHistory.value.map(item => (
      item.token === token
        ? { ...item, revoking: false }
        : item
    ))
    shareError.value = error instanceof Error ? error.message : 'Failed to revoke share link'
  }
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

.sidebar-link-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.sidebar-status {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}

.sidebar-status.error {
  color: var(--danger);
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

.share-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px 14px;
}

.share-history-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.share-history-item--revoked,
.share-history-item--expired {
  opacity: 0.65;
}

.share-history-item--expired {
  border-color: rgba(91, 150, 212, 0.28);
}

.share-history-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-history-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.share-history-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-history-subtitle {
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-muted);
}

.share-history-status {
  flex-shrink: 0;
  padding: 3px 7px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid var(--border);
  background: var(--bg-raised);
}

.share-history-status--active {
  color: var(--success);
  border-color: rgba(95, 173, 130, 0.35);
}

.share-history-status--revoked {
  color: var(--danger);
  border-color: rgba(180, 64, 48, 0.35);
}

.share-history-status--expired {
  color: var(--info);
  border-color: rgba(46, 108, 184, 0.35);
}

.share-history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-action-btn {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: border-color var(--transition), color var(--transition), background var(--transition), opacity var(--transition);
}

.mini-action-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.mini-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mini-action-btn.danger:hover:not(:disabled) {
  border-color: var(--danger);
  color: var(--danger);
  background: rgba(196, 107, 90, 0.08);
}

.mini-action-btn.danger {
  color: var(--danger);
}

.mini-action-btn:disabled {
  color: var(--text-muted);
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
