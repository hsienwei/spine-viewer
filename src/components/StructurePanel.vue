<template>
  <div class="structure-panel">
    <section v-if="structure && structure.bones.length > 0" class="section hierarchy-section">
      <div class="hierarchy-heading">
        <h3 class="section-title">
          Skeleton Tree
          <span class="hierarchy-counts">
            {{ structure.totalBones }} bones / {{ structure.slots.length }} slots
          </span>
        </h3>
        <div class="tree-actions" aria-label="Skeleton tree actions">
          <button type="button" class="tree-action-btn" aria-label="Expand all skeleton nodes" title="Expand all" @click="setAllExpanded(true)">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 5.5 8 9.5l4-4M4 2.5 8 6.5l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button type="button" class="tree-action-btn" aria-label="Collapse all skeleton nodes" title="Collapse all" @click="setAllExpanded(false)">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 10.5 4-4 4 4M4 13.5l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <SkeletonTree
        :bones="structure.bones"
        :depth="0"
        :expansion-command="expansionCommand"
        :selected-bone-name="selection?.boneName || null"
        :selected-slot-name="selection?.slotName || null"
        @bone-selected="emit('bone-selected', $event)"
        @slot-selected="(slotName, boneName) => emit('slot-selected', slotName, boneName)"
      />
    </section>

    <section v-if="!structure || structure.bones.length === 0" class="section empty-state">
      <h3 class="section-title">Skeleton Tree</h3>
      <p>Load a skeleton to inspect its hierarchy.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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

const expansionCommand = ref({ id: 0, expanded: true })
const setAllExpanded = (expanded: boolean) => {
  expansionCommand.value = { id: expansionCommand.value.id + 1, expanded }
}
</script>

<style scoped>
.structure-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.hierarchy-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tree-actions {
  display: inline-flex;
  gap: 4px;
  flex-shrink: 0;
}

.tree-action-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-muted);
  cursor: pointer;
}

.tree-action-btn:hover,
.tree-action-btn:focus-visible {
  outline: none;
  border-color: var(--accent);
  background: var(--accent-dim);
  color: var(--accent);
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
