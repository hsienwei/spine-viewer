<template>
  <div class="structure-panel">
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

    <section v-if="!structure || structure.bones.length === 0" class="section empty-state">
      <h3 class="section-title">Skeleton</h3>
      <p>Load a skeleton to inspect its hierarchy.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import SkeletonTree from './SkeletonTree.vue'
import type { SpineSelectionState, SpineSkeletonStructure } from '../lib/spine/skeletonStructure'

const props = defineProps<{
  structure?: SpineSkeletonStructure
  selection?: SpineSelectionState
}>()

const emit = defineEmits<{
  'bone-selected': [boneName: string]
  'slot-selected': [slotName: string, boneName: string]
}>()
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

.empty-state p {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}
</style>
