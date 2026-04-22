<template>
  <div class="skeleton-tree">
    <details
      v-for="bone in bones"
      :key="bone.name"
      class="tree-node"
      :open="depth < 1"
    >
      <summary
        class="tree-summary"
        :class="{ 'is-selected': selectedBoneName === bone.name }"
        :style="{ paddingLeft: `${depth * 14}px` }"
        @click="emit('bone-selected', bone.name)"
      >
        <span class="bone-name">{{ bone.name }}</span>
        <span class="bone-meta">
          {{ bone.slots.length }} slot{{ bone.slots.length === 1 ? '' : 's' }}
        </span>
      </summary>

      <div v-if="bone.slots.length > 0" class="slot-list">
        <div
          v-for="slot in bone.slots"
          :key="slot.name"
          class="slot-item"
          :class="{ 'is-selected': selectedSlotName === slot.name }"
          :style="{ paddingLeft: `${(depth + 1) * 14}px` }"
          @click.stop="emit('slot-selected', slot.name, slot.boneName)"
        >
          <span class="slot-name">{{ slot.name }}</span>
          <span class="slot-attachment">{{ slot.attachmentName || 'no attachment' }}</span>
        </div>
      </div>

      <SkeletonTree
        v-if="bone.children.length > 0"
        :bones="bone.children"
        :depth="depth + 1"
        :selected-bone-name="selectedBoneName"
        :selected-slot-name="selectedSlotName"
        @bone-selected="emit('bone-selected', $event)"
        @slot-selected="(slotName, boneName) => emit('slot-selected', slotName, boneName)"
      />
    </details>
  </div>
</template>

<script setup lang="ts">
import type { SpineBoneNode } from '../lib/spine/skeletonStructure'

defineOptions({
  name: 'SkeletonTree'
})

withDefaults(defineProps<{
  bones: SpineBoneNode[]
  depth?: number
  selectedBoneName?: string | null
  selectedSlotName?: string | null
}>(), {
  depth: 0,
  selectedBoneName: null,
  selectedSlotName: null
})

const emit = defineEmits<{
  'bone-selected': [boneName: string]
  'slot-selected': [slotName: string, boneName: string]
}>()
</script>

<style scoped>
.skeleton-tree {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tree-node {
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  overflow: hidden;
}

.tree-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  list-style: none;
  transition: background var(--transition);
}

.tree-summary:hover {
  background: var(--bg-raised);
}

.tree-summary.is-selected {
  background: var(--accent-dim);
  border-left: 2px solid var(--accent);
  padding-left: 8px;
}

.tree-summary::-webkit-details-marker {
  display: none;
}

.tree-summary::before {
  content: '›';
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1;
  margin-right: 4px;
  transition: transform var(--transition), color var(--transition);
  flex-shrink: 0;
}

.tree-node[open] > .tree-summary::before {
  transform: rotate(90deg);
  color: var(--accent);
}

.bone-name {
  flex: 1;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bone-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.slot-list {
  display: flex;
  flex-direction: column;
  padding: 2px 0 6px;
  border-top: 1px solid var(--border-muted);
}

.slot-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 24px;
  font-size: 11px;
  cursor: pointer;
  transition: background var(--transition);
}

.slot-item:hover {
  background: var(--bg-raised);
}

.slot-item.is-selected {
  background: rgba(95, 173, 130, 0.1);
  border-left: 2px solid var(--success);
  padding-left: 22px;
}

.slot-name {
  font-family: var(--font-ui);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-attachment {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  text-align: right;
  flex-shrink: 0;
}
</style>
