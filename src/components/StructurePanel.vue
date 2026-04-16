<template>
  <div class="structure-panel">
    <section v-if="showControls" class="section">
      <h3 class="section-title">Slots & Bones</h3>
      <div class="toggle-group">
        <label class="toggle-label">
          <input type="checkbox" v-model="localShowSlots" @change="emit('show-slots-change', localShowSlots)" />
          Show Slots
        </label>
        <label class="toggle-label">
          <input type="checkbox" v-model="localShowBones" @change="emit('show-bones-change', localShowBones)" />
          Show Bones
        </label>
      </div>
    </section>

    <section v-if="structure && structure.bones.length > 0" class="section hierarchy-section">
      <h3 class="section-title">Hierarchy</h3>
      <div class="hierarchy-summary">
        <span>{{ structure.bones.length }} root bone{{ structure.bones.length === 1 ? '' : 's' }}</span>
        <span>{{ structure.slots.length }} slot{{ structure.slots.length === 1 ? '' : 's' }}</span>
      </div>
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
      <h3 class="section-title">Slots & Bones</h3>
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

watch(() => props.showBones, (value) => {
  localShowBones.value = !!value
}, { immediate: true })

watch(() => props.showSlots, (value) => {
  localShowSlots.value = !!value
}, { immediate: true })

const showControls = computed(() => {
  return !!props.structure && props.structure.bones.length > 0
})
</script>

<style scoped>
.structure-panel {
  height: 100%;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toggle-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.toggle-label input {
  cursor: pointer;
}

.hierarchy-section {
  min-height: 0;
}

.hierarchy-summary {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #9a9a9a;
  font-size: 12px;
}

.empty-state p {
  color: #8b8b8b;
  font-size: 13px;
}
</style>
