<template>
  <div class="control-panel">
    <section v-if="mode === 'animate' && animations && animations.length > 0" class="section">
      <div class="section-heading">
        <h3 class="section-title">Animation Tracks</h3>
        <button type="button" class="mini-action-btn" @click="addTrack">Add</button>
      </div>
      <div class="track-list">
        <div v-for="track in localTracks" :key="track.trackIndex" class="track-card">
          <div class="track-card-header">
            <span class="track-chip">Track {{ track.trackIndex }}</span>
            <div class="track-card-actions">
              <button
                type="button"
                class="mini-icon-btn"
                @click="clearTrack(track.trackIndex)"
              >
                Clear
              </button>
              <button
                v-if="localTracks.length > 1"
                type="button"
                class="mini-icon-btn"
                @click="removeTrack(track.trackIndex)"
              >
                Remove
              </button>
            </div>
          </div>
          <div class="select-wrapper">
            <select
              :value="track.animationName"
              class="select-input"
              @change="updateTrackAnimation(track.trackIndex, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">None</option>
              <option v-for="anim in animations" :key="anim" :value="anim">{{ anim }}</option>
            </select>
            <svg class="select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="track-settings-row">
            <label class="track-loop-toggle">
              <input
                type="checkbox"
                class="debug-option-input"
                :checked="track.loop"
                @change="updateTrackLoop(track.trackIndex, ($event.target as HTMLInputElement).checked)"
              />
              <span class="track-loop-label">Loop</span>
            </label>
            <label class="track-mix-field">
              <span class="track-mix-label">Mix</span>
              <input
                type="number"
                min="0"
                step="0.05"
                class="track-mix-input"
                :value="track.mixDuration"
                :disabled="props.isPlaying"
                @change="updateTrackMixDuration(track.trackIndex, ($event.target as HTMLInputElement).value)"
              />
              <span class="track-mix-unit">s</span>
            </label>
          </div>
        </div>
      </div>
    </section>

    <template v-if="mode === 'inspect'">
      <section v-if="showOverviewSection" class="section">
        <h3 class="section-title">Overview</h3>
        <div v-if="skins && skins.length > 0" class="select-wrapper">
          <select v-model="localSkin" class="select-input" @change="emitSkinChange">
            <option v-for="skin in skins" :key="skin" :value="skin">{{ skin }}</option>
          </select>
          <svg class="select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Skin</span>
            <span class="info-value">{{ localSkin || 'Default' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Draw Calls</span>
            <span class="info-value mono">{{ drawCall || 0 }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Event Markers</span>
            <span class="info-value mono">{{ eventMarkerCount || 0 }}</span>
          </div>
        </div>
      </section>

      <section v-if="runtimeVersion !== null" class="section">
        <h3 class="section-title">Display</h3>
        <label class="toggle-row">
          <span class="toggle-label-text">XY Axes</span>
          <span class="toggle-switch">
            <input
              type="checkbox"
              class="toggle-input"
              :checked="resolvedDebugOptions.showAxes"
              @change="emitDebugOptionChange('showAxes', $event)"
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
        <label class="toggle-row">
          <span class="toggle-label-text">Filtering</span>
          <span class="toggle-switch">
            <input
              type="checkbox"
              class="toggle-input"
              :checked="resolvedTextureFiltering !== 'nearest'"
              @change="emit('texture-filtering-change', ($event.target as HTMLInputElement).checked ? 'linear' : 'nearest')"
            />
            <span class="toggle-track">
              <span class="toggle-thumb"></span>
            </span>
          </span>
        </label>
      </section>

      <section v-if="runtimeVersion !== null" class="section">
        <h3 class="section-title">Debug</h3>
        <div class="debug-option-grid">
          <label
            v-for="option in debugOptionsList"
            :key="option.key"
            class="toggle-row debug-toggle-row"
          >
            <span class="toggle-label-text">{{ option.label }}</span>
            <span class="toggle-switch">
              <input
                type="checkbox"
                class="toggle-input"
                :checked="resolvedDebugOptions[option.key]"
                @change="emitDebugOptionChange(option.key, $event)"
              />
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
            </span>
          </label>
        </div>
      </section>

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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEFAULT_SPINE_DEBUG_OPTIONS, DEFAULT_SPINE_TEXTURE_FILTERING } from '../lib/spine/adapters'
import { type SpineDetectedVersion, type SpineMajorVersion } from '../lib/spine/versionDetection'
import type { SpineDebugOptions, SpineTextureFiltering, SpineTrackEntry } from '../lib/spine/adapters'

const props = defineProps<{
  mode?: 'animate' | 'inspect'
  animations?: string[]
  skins?: string[]
  tracks?: SpineTrackEntry[]
  isPlaying?: boolean
  currentSkin?: string
  drawCall?: number
  eventMarkerCount?: number
  detectedVersion?: SpineDetectedVersion | null
  runtimeVersion?: SpineMajorVersion | null
  initialRuntimeVersion?: SpineMajorVersion | null
  fallbackUsed?: boolean
  debugOptions?: Partial<SpineDebugOptions>
  premultipliedAlpha?: boolean
  textureFiltering?: SpineTextureFiltering
}>()

const emit = defineEmits<{
  'tracks-change': [tracks: SpineTrackEntry[]]
  'skin-change': [name: string]
  'debug-option-change': [key: keyof SpineDebugOptions, value: boolean]
  'premultiply-alpha-change': [value: boolean]
  'texture-filtering-change': [value: SpineTextureFiltering]
}>()

const mode = computed(() => props.mode ?? 'animate')

const debugOptionsList: Array<{ key: Exclude<keyof SpineDebugOptions, 'showAxes'>, label: string }> = [
  { key: 'showBones', label: 'Bones' },
  { key: 'showRegions', label: 'Regions' },
  { key: 'showBounds', label: 'Bounds' },
  { key: 'showPaths', label: 'Paths' },
  { key: 'showPoints', label: 'Points' },
  { key: 'showClipping', label: 'Clipping' },
  { key: 'showMeshHull', label: 'Mesh hull' },
  { key: 'showMeshTriangles', label: 'Triangles' }
]

const localSkin = ref('')
const localTracks = ref<SpineTrackEntry[]>([])

const resolveSelectedValue = (options: string[] | undefined, value: string | undefined) => {
  if (!options?.length) return ''
  if (value && options.includes(value)) return value
  return options[0]
}

const normalizeTracks = (tracks: SpineTrackEntry[] | undefined, animations: string[] | undefined) => {
  const animationOptions = animations || []
  const sanitized = (tracks || [])
    .filter(track => track.trackIndex >= 0)
    .map(track => ({
      trackIndex: track.trackIndex,
      animationName: track.animationName && animationOptions.includes(track.animationName)
        ? track.animationName
        : (track.animationName ? resolveSelectedValue(animationOptions, track.animationName) : ''),
      loop: track.loop !== false,
      mixDuration: Math.max(0, track.mixDuration || 0)
    }))
    .sort((a, b) => a.trackIndex - b.trackIndex)

  if (sanitized.length > 0) {
    return sanitized.map((track, index) => ({
      ...track,
      trackIndex: index
    }))
  }

  const firstAnimation = resolveSelectedValue(animationOptions, undefined)
  return firstAnimation
    ? [{ trackIndex: 0, animationName: firstAnimation, loop: true, mixDuration: 0 }]
    : []
}

const resolvedDebugOptions = computed<SpineDebugOptions>(() => ({
  ...DEFAULT_SPINE_DEBUG_OPTIONS,
  ...props.debugOptions
}))

const resolvedTextureFiltering = computed<SpineTextureFiltering>(() => {
  return props.textureFiltering ?? DEFAULT_SPINE_TEXTURE_FILTERING
})

const showOverviewSection = computed(() => {
  return (props.skins?.length || 0) > 0
    || (props.animations?.length || 0) > 0
    || (props.drawCall || 0) > 0
    || (props.eventMarkerCount || 0) > 0
})

watch(
  [() => props.animations, () => props.tracks],
  ([animations, tracks]) => {
    localTracks.value = normalizeTracks(tracks, animations)
  },
  { immediate: true, deep: true }
)

watch(
  [() => props.skins, () => props.currentSkin],
  ([skins, currentSkin]) => {
    localSkin.value = resolveSelectedValue(skins, currentSkin)
  },
  { immediate: true }
)

const emitTracksChange = (tracks: SpineTrackEntry[]) => {
  emit('tracks-change', tracks.map(track => ({ ...track })))
}

const updateTrackAnimation = (trackIndex: number, animationName: string) => {
  localTracks.value = localTracks.value.map(track => (
    track.trackIndex === trackIndex
      ? { ...track, animationName }
      : track
  ))
  emitTracksChange(localTracks.value)
}

const updateTrackLoop = (trackIndex: number, loop: boolean) => {
  localTracks.value = localTracks.value.map(track => (
    track.trackIndex === trackIndex
      ? { ...track, loop }
      : track
  ))
  emitTracksChange(localTracks.value)
}

const updateTrackMixDuration = (trackIndex: number, rawValue: string) => {
  const mixDuration = Math.max(0, Number.parseFloat(rawValue) || 0)
  localTracks.value = localTracks.value.map(track => (
    track.trackIndex === trackIndex
      ? { ...track, mixDuration }
      : track
  ))
  emitTracksChange(localTracks.value)
}

const addTrack = () => {
  const nextAnimation = resolveSelectedValue(props.animations, undefined)
  if (!nextAnimation) return

  localTracks.value = [
    ...localTracks.value,
    { trackIndex: localTracks.value.length, animationName: nextAnimation, loop: true, mixDuration: 0 }
  ]
  emitTracksChange(localTracks.value)
}

const removeTrack = (trackIndex: number) => {
  localTracks.value = localTracks.value
    .filter(track => track.trackIndex !== trackIndex)
    .map((track, index) => ({
      ...track,
      trackIndex: index
    }))
  emitTracksChange(localTracks.value)
}

const clearTrack = (trackIndex: number) => {
  localTracks.value = localTracks.value.map(track => (
    track.trackIndex === trackIndex
      ? { ...track, animationName: '' }
      : track
  ))
  emitTracksChange(localTracks.value)
}

const emitSkinChange = () => {
  if (localSkin.value) {
    emit('skin-change', localSkin.value)
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

const emitDebugOptionChange = (key: keyof SpineDebugOptions, event: Event) => {
  emit('debug-option-change', key, (event.target as HTMLInputElement).checked)
}
</script>

<style scoped>
.control-panel {
  padding: 14px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.mini-action-btn,
.mini-icon-btn {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: border-color var(--transition), color var(--transition), background var(--transition);
}

.mini-action-btn {
  padding: 5px 8px;
}

.mini-icon-btn {
  padding: 4px 7px;
}

.mini-action-btn:hover,
.mini-icon-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.track-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.track-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

.track-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.track-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.track-chip {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.track-loop-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.track-loop-label {
  line-height: 1.2;
}

.track-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.track-mix-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.track-mix-label,
.track-mix-unit {
  font-size: 11px;
  color: var(--text-muted);
}

.track-mix-input {
  width: 78px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
}

.track-mix-input:focus {
  outline: none;
  border-color: var(--accent);
}

.track-mix-input:disabled {
  cursor: not-allowed;
  color: var(--text-muted);
  border-color: var(--border-muted);
  background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
  opacity: 0.6;
}

.track-mix-input:disabled::-webkit-inner-spin-button,
.track-mix-input:disabled::-webkit-outer-spin-button {
  opacity: 0.35;
}

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
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toggle-label-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-track {
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  padding: 2px;
  transition: background var(--transition), border-color var(--transition);
}

.toggle-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform var(--transition), background var(--transition);
}

.toggle-input:checked + .toggle-track {
  background: var(--accent-dim);
  border-color: var(--accent);
}

.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(14px);
  background: var(--accent);
}

.debug-option-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.debug-toggle-row {
  min-height: 20px;
}

.version-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}

.version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.version-label {
  font-size: 11px;
  color: var(--text-muted);
}

.version-value {
  font-size: 12px;
  color: var(--text-secondary);
}

.version-badge {
  padding: 3px 8px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  border: 1px solid var(--border);
  background: var(--bg-surface);
}

.version-badge--3 {
  color: var(--info);
  border-color: rgba(113, 160, 255, 0.35);
}

.version-badge--4 {
  color: var(--success);
  border-color: rgba(108, 174, 124, 0.35);
}
</style>
