<template>
  <div class="structure-panel">
    <section v-if="showControls" class="section">
      <h3 class="section-title">Display</h3>
      <div class="toggle-group">
        <label class="toggle-row">
          <span class="toggle-label-text">Show Slots</span>
          <span class="toggle-switch">
            <input type="checkbox" class="toggle-input" v-model="localShowSlots" @change="emit('show-slots-change', localShowSlots)" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </span>
        </label>
        <label class="toggle-row">
          <span class="toggle-label-text">Show Bones</span>
          <span class="toggle-switch">
            <input type="checkbox" class="toggle-input" v-model="localShowBones" @change="emit('show-bones-change', localShowBones)" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </span>
        </label>
      </div>
    </section>

    <section v-if="structure && structure.bones.length > 0" class="section hierarchy-section">
      <h3 class="section-title">
        Hierarchy
        <span class="hierarchy-counts">
          {{ structure.totalBones }} bones · {{ structure.slots.length }} slots
        </span>
      </h3>
      <SkeletonTree
        :bones="structure.bones"
        :depth="0"
        :selected-bone-name="selection?.boneName || null"
        :selected-slot-name="selection?.slotName || null"
        @bone-selected="emit('bone-selected', $event)"
        @slot-selected="(slotName, boneName) => emit('slot-selected', slotName, boneName)"
      />
    </section>

    <section v-if="!showControls && (!structure || structure.bones.length === 0)" class="section empty-state">
      <h3 class="section-title">Skeleton</h3>
      <p>Load a skeleton to inspect its hierarchy.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import SkeletonTree from './SkeletonTree.vue'
import type { SpineSelectionState, SpineSkeletonStructure } from '../lib/spine/skeletonStructure'

const props = defineProps<{
  structure?: SpineSkeletonStructure
  selection?: SpineSelectionState
  showBones?: boolean
  showSlots?: boolean
}>()

const emit = defineEmits<{
  'show-bones-change': [value: boolean]
  'show-slots-change': [value: boolean]
  'bone-selected': [boneName: string]
  'slot-selected': [slotName: string, boneName: string]
}>()

const localShowSlots = ref(false)
const localShowBones = ref(false)

watch(() => props.showBones, (value) => { localShowBones.value = !!value }, { immediate: true })
watch(() => props.showSlots, (value) => { localShowSlots.value = !!value }, { immediate: true })

const showControls = computed(() => !!props.structure && props.structure.bones.length > 0)
</script>

<style scoped>
.structure-panel {
  padding: 14px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.hierarchy-counts {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.hierarchy-section {
  min-height: 0;
}

.toggle-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-label-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 19px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: background var(--transition), border-color var(--transition);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 11px;
  height: 11px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: transform var(--transition), background var(--transition);
}

.toggle-input:checked + .toggle-track {
  background: var(--accent-dim);
  border-color: var(--accent);
}

.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(15px);
  background: var(--accent);
}

.empty-state p {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}
</style>
