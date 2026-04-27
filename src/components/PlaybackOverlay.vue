<template>
  <section v-if="visible" class="playback-overlay">
    <div class="time-row">
      <span class="time-current">{{ formatTime(displayedCurrentTime) }}</span>
      <span class="time-sep">/</span>
      <span class="time-total">{{ formatTime(duration || 0) }}</span>
    </div>

    <div class="progress-row">
      <div class="timeline-shell">
        <div
          ref="timelineRef"
          class="timeline-track"
          :class="{ 'is-scrubbing': isScrubbing }"
          @pointerdown="handleTrackPointerDown"
        >
          <div class="timeline-progress" :style="{ width: `${progressPercent}%` }"></div>
          <button
            v-for="marker in markerViewModels"
            :key="marker.id"
            type="button"
            class="timeline-marker"
            :class="{ 'is-notified': notifiedMarkerIds.has(marker.id) }"
            :style="{ left: `${marker.positionPercent}%` }"
            :aria-label="formatMarkerAriaLabel(marker)"
            @pointerdown.stop
            @click.stop="handleMarkerClick(marker)"
            @mouseenter="hoveredMarkerId = marker.id"
            @mouseleave="clearHoveredMarker(marker.id)"
            @focus="hoveredMarkerId = marker.id"
            @blur="clearHoveredMarker(marker.id)"
          >
            <span class="timeline-marker-wave"></span>
            <span class="timeline-marker-dot"></span>
          </button>
          <div class="timeline-thumb" :style="{ left: `${progressPercent}%` }"></div>
        </div>

        <div
          v-if="activeMarker"
          class="timeline-tooltip"
          :class="tooltipAlignClass"
          :style="{ left: `${activeMarker.positionPercent}%` }"
        >
          <div class="timeline-tooltip-time">{{ formatTime(activeMarker.time) }}</div>
          <div class="timeline-tooltip-copy">{{ formatMarkerTooltip(activeMarker) }}</div>
        </div>
      </div>
    </div>

    <div class="controls-row">
      <button type="button" class="ctrl-btn" @click="stop" title="Stop">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="1.5" y="1.5" width="9" height="9" rx="1.5"/>
        </svg>
      </button>
      <button type="button" class="ctrl-btn ctrl-btn--primary" @click="togglePlay" :title="isPlaying ? 'Pause' : 'Play'">
        <svg v-if="isPlaying" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="2" width="3.5" height="10" rx="1"/>
          <rect x="8.5" y="2" width="3.5" height="10" rx="1"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M3.5 2.5l9 4.5-9 4.5z"/>
        </svg>
      </button>

      <div class="speed-group">
        <span class="speed-label">{{ (playbackRate || 1).toFixed(1) }}x</span>
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.1"
          :value="playbackRate || 1"
          class="range-track range-track--speed"
          @input="setSpeed($event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { SpineAnimationEventMarker } from '../lib/spine/adapters'

interface TimelineMarkerViewModel extends SpineAnimationEventMarker {
  id: string
  positionPercent: number
}

interface RuntimeNotificationInput {
  id: number
  eventName: string
  animationName: string | null
  trackIndex: number
  trackTime: number | null
  receivedAt: string
  visible: boolean
  count: number
}

const props = defineProps<{
  visible?: boolean
  animationName?: string
  currentTime?: number
  duration?: number
  isPlaying?: boolean
  playbackRate?: number
  eventMarkers?: SpineAnimationEventMarker[]
  runtimeNotifications?: RuntimeNotificationInput[]
}>()

const emit = defineEmits<{
  'playback-change': [playing: boolean]
  'seek': [time: number]
  'speed-change': [speed: number]
}>()

const timelineRef = ref<HTMLDivElement | null>(null)
const hoveredMarkerId = ref<string | null>(null)
const pinnedMarkerId = ref<string | null>(null)
const scrubTime = ref<number | null>(null)

let activePointerId: number | null = null

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

const safeDuration = computed(() => {
  return typeof props.duration === 'number' && props.duration > 0 ? props.duration : 0
})

const displayedCurrentTime = computed(() => {
  return scrubTime.value ?? props.currentTime ?? 0
})

const progressPercent = computed(() => {
  if (!safeDuration.value) return 0
  return clamp((displayedCurrentTime.value / safeDuration.value) * 100, 0, 100)
})

const runtimeNotificationItems = computed(() => {
  const activeAnimationName = props.animationName || null

  return (props.runtimeNotifications || []).filter(notification => {
    if (!activeAnimationName) return notification.animationName === null
    return notification.animationName === activeAnimationName
  })
})

const markerViewModels = computed<TimelineMarkerViewModel[]>(() => {
  if (!safeDuration.value) return []

  return (props.eventMarkers || []).map((marker, index) => ({
    ...marker,
    id: `${marker.time}-${index}`,
    positionPercent: clamp((marker.time / safeDuration.value) * 100, 0, 100)
  }))
})

const activeMarker = computed(() => {
  const activeId = hoveredMarkerId.value || pinnedMarkerId.value
  if (!activeId) return null

  return markerViewModels.value.find(marker => marker.id === activeId) || null
})

const isScrubbing = computed(() => activePointerId !== null)
const tooltipAlignClass = computed(() => {
  if (!activeMarker.value) return 'is-center'
  if (activeMarker.value.positionPercent <= 15) return 'is-left'
  if (activeMarker.value.positionPercent >= 85) return 'is-right'
  return 'is-center'
})

const findNotificationMarker = (notification: RuntimeNotificationInput) => {
  if (notification.trackTime === null) return null

  const matchingByTime = markerViewModels.value.find(marker => {
    return Math.abs(marker.time - notification.trackTime!) < 0.02
      && marker.events.some(event => event.eventName === notification.eventName)
  })

  if (matchingByTime) return matchingByTime

  return markerViewModels.value.find(marker => (
    Math.abs(marker.time - notification.trackTime!) < 0.02
  )) || null
}

const notifiedMarkerIds = computed(() => {
  const ids = new Set<string>()

  runtimeNotificationItems.value.forEach(notification => {
    const marker = findNotificationMarker(notification)
    if (marker) ids.add(marker.id)
  })

  return ids
})

watch(() => props.eventMarkers, () => {
  hoveredMarkerId.value = null
  pinnedMarkerId.value = null
}, { deep: false })

const clearPointerListeners = () => {
  window.removeEventListener('pointermove', handleWindowPointerMove)
  window.removeEventListener('pointerup', handleWindowPointerUp)
  window.removeEventListener('pointercancel', handleWindowPointerUp)
}

const clearActivePointer = () => {
  if (activePointerId !== null && timelineRef.value?.hasPointerCapture(activePointerId)) {
    timelineRef.value.releasePointerCapture(activePointerId)
  }

  activePointerId = null
  scrubTime.value = null
  clearPointerListeners()
}

const emitSeek = (time: number) => {
  const nextTime = safeDuration.value > 0
    ? clamp(time, 0, safeDuration.value)
    : Math.max(0, time)

  emit('seek', nextTime)
}

const updateScrubFromClientX = (clientX: number) => {
  if (!timelineRef.value || !safeDuration.value) return

  const rect = timelineRef.value.getBoundingClientRect()
  if (!rect.width) return

  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
  const nextTime = ratio * safeDuration.value

  scrubTime.value = nextTime
  emitSeek(nextTime)
}

function handleWindowPointerMove(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return
  updateScrubFromClientX(event.clientX)
}

function handleWindowPointerUp(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return
  updateScrubFromClientX(event.clientX)
  clearActivePointer()
}

const handleTrackPointerDown = (event: PointerEvent) => {
  if (!safeDuration.value) return

  pinnedMarkerId.value = null
  activePointerId = event.pointerId
  timelineRef.value?.setPointerCapture(event.pointerId)
  updateScrubFromClientX(event.clientX)

  window.addEventListener('pointermove', handleWindowPointerMove)
  window.addEventListener('pointerup', handleWindowPointerUp)
  window.addEventListener('pointercancel', handleWindowPointerUp)
}

const togglePlay = () => emit('playback-change', !props.isPlaying)

const stop = () => {
  emit('playback-change', false)
  emit('seek', 0)
}

const setSpeed = (event: Event) => {
  emit('speed-change', parseFloat((event.target as HTMLInputElement).value))
}

const handleMarkerClick = (marker: TimelineMarkerViewModel) => {
  pinnedMarkerId.value = marker.id
  emitSeek(marker.time)
}

const clearHoveredMarker = (markerId: string) => {
  if (hoveredMarkerId.value === markerId) {
    hoveredMarkerId.value = null
  }
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

const normalizeMarkerEventName = (eventName: string | null | undefined) => {
  const trimmed = eventName?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : 'Unnamed event'
}

const formatMarkerTooltip = (marker: TimelineMarkerViewModel) => {
  return marker.events.map(event => normalizeMarkerEventName(event.eventName)).join(' | ')
}

const formatMarkerAriaLabel = (marker: TimelineMarkerViewModel) => {
  return `${formatTime(marker.time)} ${formatMarkerTooltip(marker)}`
}

onUnmounted(() => {
  clearActivePointer()
})
</script>

<style scoped>
.playback-overlay {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: min(380px, calc(100% - 24px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border-glow);
  border-radius: var(--radius-lg);
  background: var(--bg-overlay);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(201, 141, 42, 0.08);
  backdrop-filter: blur(16px);
  z-index: 2;
}

.time-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.time-current {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.time-sep {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 2px;
}

.time-total {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.progress-row {
  display: flex;
  align-items: center;
}

.timeline-shell {
  position: relative;
  width: 100%;
  padding-top: 24px;
}

.timeline-track {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.14));
  cursor: pointer;
}

.timeline-track.is-scrubbing {
  cursor: grabbing;
}

.timeline-progress {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(201, 141, 42, 0.3), rgba(201, 141, 42, 0.88));
}

.timeline-thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid rgba(12, 11, 10, 0.84);
  box-shadow: 0 0 0 1px var(--accent-glow);
  transform: translate(-50%, -50%);
}

.timeline-marker {
  position: absolute;
  top: 50%;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 2;
}

.timeline-marker-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--info);
  border: 2px solid rgba(12, 11, 10, 0.9);
  box-shadow: 0 0 0 1px rgba(91, 150, 212, 0.35);
  transform: translate(-50%, -50%);
  transition: transform var(--transition), box-shadow var(--transition), background var(--transition), border-color var(--transition);
}

.timeline-marker-wave {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid transparent;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
  pointer-events: none;
}

.timeline-marker.is-notified .timeline-marker-dot {
  background: var(--event-highlight-fill);
  border-color: var(--event-highlight-border);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--event-highlight-ring) 70%, transparent),
    0 0 12px var(--event-highlight-glow),
    0 0 20px var(--event-highlight-glow-wide);
}

.timeline-marker.is-notified .timeline-marker-wave {
  border-color: var(--event-highlight-fill);
  box-shadow:
    0 0 10px var(--event-highlight-glow),
    0 0 18px var(--event-highlight-glow-wide);
  animation: timeline-marker-wave 0.5s ease-out forwards;
}

.timeline-marker:hover .timeline-marker-dot,
.timeline-marker:focus-visible .timeline-marker-dot {
  transform: translate(-50%, -50%) scale(1.15);
  box-shadow: 0 0 0 4px rgba(91, 150, 212, 0.16);
  background: #7db0e6;
}

@keyframes timeline-marker-wave {
  0% {
    transform: translate(-50%, -50%) scale(0.65);
    opacity: 0.92;
    box-shadow:
      0 0 8px var(--event-highlight-glow),
      0 0 14px var(--event-highlight-glow-wide);
  }

  100% {
    transform: translate(-50%, -50%) scale(3.1);
    opacity: 0;
    box-shadow:
      0 0 26px transparent,
      0 0 42px transparent;
  }
}

.timeline-tooltip {
  position: absolute;
  top: 0;
  max-width: min(240px, calc(100vw - 48px));
  padding: 9px 11px;
  border: 1px solid var(--tooltip-border);
  border-radius: var(--radius-md);
  background: var(--tooltip-bg);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  z-index: 4;
  transform: translateX(-50%);
}

.timeline-tooltip.is-left {
  transform: translateX(0);
}

.timeline-tooltip.is-right {
  transform: translateX(-100%);
}

.timeline-tooltip-time {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--tooltip-muted);
}

.timeline-tooltip-copy {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
  color: var(--tooltip-text);
  word-break: break-word;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition), border-color var(--transition), color var(--transition), box-shadow var(--transition);
}

.ctrl-btn:hover {
  background: var(--bg-raised);
  border-color: var(--text-muted);
  color: var(--text-primary);
}

.ctrl-btn--primary {
  width: 40px;
  height: 40px;
  background: var(--accent-dim);
  border-color: var(--border-glow);
  color: var(--accent);
}

.ctrl-btn--primary:hover {
  background: var(--accent-glow);
  box-shadow: 0 0 0 3px rgba(201, 141, 42, 0.15);
  color: var(--accent);
}

.speed-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.speed-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  width: 34px;
  text-align: right;
}

.range-track {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: var(--bg-raised);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  position: relative;
}

.range-track::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: 2px solid rgba(12, 11, 10, 0.8);
  box-shadow: 0 0 0 1px var(--accent-glow);
  transition: box-shadow var(--transition);
}

.range-track::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: 2px solid rgba(12, 11, 10, 0.8);
}

.range-track:hover::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px var(--accent-glow);
}

.range-track--speed {
  height: 2px;
}

.range-track--speed::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
}

@media (max-width: 900px) {
  .playback-overlay {
    right: 14px;
    bottom: 14px;
  }
}

@media (max-width: 640px) {
  .playback-overlay {
    left: 10px;
    right: 10px;
    bottom: 10px;
    width: auto;
  }

  .timeline-tooltip {
    max-width: min(200px, calc(100vw - 32px));
  }

}
</style>
