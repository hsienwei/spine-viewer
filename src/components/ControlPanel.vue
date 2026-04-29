<template>
  <div class="control-panel">
    <section v-if="animations && animations.length > 0" class="section">
      <h3 class="section-title">Load Animations</h3>
      <div class="select-wrapper">
        <select v-model="localAnimation" class="select-input" @change="emitAnimationChange">
          <option v-for="anim in animations" :key="anim" :value="anim">{{ anim }}</option>
        </select>
        <svg class="select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </section>

    <section v-if="skins && skins.length > 0" class="section">
      <h3 class="section-title">Skin</h3>
      <div class="select-wrapper">
        <select v-model="localSkin" class="select-input" @change="emitSkinChange">
          <option v-for="skin in skins" :key="skin" :value="skin">{{ skin }}</option>
        </select>
        <svg class="select-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </section>

    <section v-if="animations && animations.length > 0" class="section">
      <h3 class="section-title">Info</h3>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Draw Calls</span>
          <span class="info-value mono">{{ drawCall || 0 }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Event Markers</span>
          <span class="info-value mono">{{ eventMarkerCount }}</span>
        </div>
      </div>
    </section>

    <section v-if="runtimeVersion !== null" class="section">
      <h3 class="section-title">Render</h3>
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
          class="debug-option"
        >
          <input
            type="checkbox"
            class="debug-option-input"
            :checked="resolvedDebugOptions[option.key]"
            @change="emitDebugOptionChange(option.key, $event)"
          />
          <span class="debug-option-text">{{ option.label }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEFAULT_SPINE_DEBUG_OPTIONS, DEFAULT_SPINE_TEXTURE_FILTERING } from '../lib/spine/adapters'
import { type SpineDetectedVersion, type SpineMajorVersion } from '../lib/spine/versionDetection'
import type { SpineDebugOptions, SpineTextureFiltering } from '../lib/spine/adapters'

const props = defineProps<{
  animations?: string[]
  skins?: string[]
  currentAnimation?: string
  currentSkin?: string
  currentTime?: number
  duration?: number
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
  'animation-change': [name: string]
  'skin-change': [name: string]
  'debug-option-change': [key: keyof SpineDebugOptions, value: boolean]
  'premultiply-alpha-change': [value: boolean]
  'texture-filtering-change': [value: SpineTextureFiltering]
}>()

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

const localAnimation = ref('')
const localSkin = ref('')

const resolveSelectedValue = (options: string[] | undefined, value: string | undefined) => {
  if (!options?.length) return ''
  if (value && options.includes(value)) return value
  return options[0]
}

const resolvedDebugOptions = computed<SpineDebugOptions>(() => ({
  ...DEFAULT_SPINE_DEBUG_OPTIONS,
  ...props.debugOptions
}))

const resolvedTextureFiltering = computed<SpineTextureFiltering>(() => {
  return props.textureFiltering ?? DEFAULT_SPINE_TEXTURE_FILTERING
})

watch(
  [() => props.animations, () => props.currentAnimation],
  ([animations, currentAnimation]) => {
    localAnimation.value = resolveSelectedValue(animations, currentAnimation)
  },
  { immediate: true }
)

watch(
  [() => props.skins, () => props.currentSkin],
  ([skins, currentSkin]) => {
    localSkin.value = resolveSelectedValue(skins, currentSkin)
  },
  { immediate: true }
)

const emitAnimationChange = () => {
  if (localAnimation.value) {
    emit('animation-change', localAnimation.value)
  }
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

.section-title {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.14em;
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
}

.debug-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.debug-option-input {
  accent-color: var(--accent);
}

.debug-option-text {
  line-height: 1.2;
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
