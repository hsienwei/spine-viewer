<template>
  <section v-if="visible" class="playback-overlay">
    <div class="overlay-header">
      <span class="overlay-title">Playback</span>
      <span class="time-display">
        {{ formatTime(currentTime || 0) }} / {{ formatTime(duration || 0) }}
      </span>
    </div>

    <div class="playback-controls">
      <button type="button" class="control-button control-button-primary" @click="togglePlay">
        {{ isPlaying ? 'Pause' : 'Play' }}
      </button>
      <button type="button" class="control-button" @click="stop">
        Stop
      </button>
    </div>

    <div class="timeline">
      <input
        type="range"
        :min="0"
        :max="duration || 10"
        step="0.01"
        :value="currentTime || 0"
        class="slider"
        @input="seekTo($event)"
      />
    </div>

    <div class="speed-control">
      <div class="speed-meta">
        <label class="speed-label" for="playback-speed">Speed</label>
        <span class="speed-value">{{ (playbackRate || 1).toFixed(1) }}x</span>
      </div>
      <input
        id="playback-speed"
        type="range"
        min="0.1"
        max="3"
        step="0.1"
        :value="playbackRate || 1"
        class="slider"
        @input="setSpeed($event)"
      />
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

const togglePlay = () => {
  emit('playback-change', !props.isPlaying)
}

const stop = () => {
  emit('playback-change', false)
  emit('seek', 0)
}

const seekTo = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('seek', parseFloat(target.value))
}

const setSpeed = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('speed-change', parseFloat(target.value))
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
  right: 24px;
  bottom: 24px;
  width: min(360px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(143, 183, 255, 0.22);
  border-radius: 16px;
  background: rgba(18, 22, 30, 0.82);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(14px);
  z-index: 2;
}

.overlay-header,
.speed-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.overlay-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8fb7ff;
}

.time-display {
  font-size: 12px;
  color: #d7e2ff;
  font-variant-numeric: tabular-nums;
}

.playback-controls {
  display: flex;
  gap: 10px;
}

.control-button {
  min-width: 88px;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}

.control-button:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.control-button-primary {
  background: linear-gradient(135deg, rgba(74, 158, 255, 0.9), rgba(91, 205, 255, 0.78));
  border-color: rgba(143, 183, 255, 0.4);
}

.timeline,
.speed-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.speed-label,
.speed-value {
  font-size: 12px;
  color: #c0cbdf;
}

.slider {
  width: 100%;
  cursor: pointer;
}

@media (max-width: 900px) {
  .playback-overlay {
    right: 16px;
    bottom: 16px;
    width: min(340px, calc(100% - 24px));
  }
}

@media (max-width: 640px) {
  .playback-overlay {
    left: 12px;
    right: 12px;
    bottom: 12px;
    width: auto;
  }
}
</style>
