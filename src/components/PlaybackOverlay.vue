<template>
  <section v-if="visible" class="playback-overlay">
    <div class="time-row">
      <span class="time-current">{{ formatTime(currentTime || 0) }}</span>
      <span class="time-sep">/</span>
      <span class="time-total">{{ formatTime(duration || 0) }}</span>
    </div>

    <div class="progress-row">
      <input
        type="range"
        :min="0"
        :max="duration || 10"
        step="0.01"
        :value="currentTime || 0"
        class="range-track"
        @input="seekTo($event)"
      />
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
        <span class="speed-label">{{ (playbackRate || 1).toFixed(1) }}×</span>
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
const props = defineProps<{
  visible?: boolean
  currentTime?: number
  duration?: number
  isPlaying?: boolean
  playbackRate?: number
}>()

const emit = defineEmits<{
  'playback-change': [playing: boolean]
  'seek': [time: number]
  'speed-change': [speed: number]
}>()

const togglePlay = () => emit('playback-change', !props.isPlaying)

const stop = () => {
  emit('playback-change', false)
  emit('seek', 0)
}

const seekTo = (event: Event) => {
  emit('seek', parseFloat((event.target as HTMLInputElement).value))
}

const setSpeed = (event: Event) => {
  emit('speed-change', parseFloat((event.target as HTMLInputElement).value))
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.playback-overlay {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: min(320px, calc(100% - 24px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border-glow);
  border-radius: var(--radius-lg);
  background: var(--bg-overlay);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(201, 141, 42, 0.08);
  backdrop-filter: blur(16px);
  z-index: 2;
}

/* Time display */
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

/* Progress Range */
.progress-row {
  display: flex;
  align-items: center;
}

/* Controls row */
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

/* Speed group */
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
  width: 30px;
  text-align: right;
}

/* Range inputs */
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
}
</style>
