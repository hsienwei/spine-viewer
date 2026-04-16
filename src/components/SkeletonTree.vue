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
  gap: 6px;
}

.tree-node {
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  background: #2a2a2a;
  overflow: hidden;
}

.tree-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  list-style: none;
}

.tree-summary.is-selected {
  background: rgba(143, 183, 255, 0.16);
}

.tree-summary::-webkit-details-marker {
  display: none;
}

.tree-summary::before {
  content: '>';
  color: #8fb7ff;
  margin-right: 6px;
}

.tree-node[open] > .tree-summary::before {
  content: 'v';
}

.bone-name {
  color: #f1f1f1;
  font-size: 13px;
  font-weight: 600;
}

.bone-meta {
  color: #8b8b8b;
  font-size: 11px;
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 0 8px;
}

.slot-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  color: #d6d6d6;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
}

.slot-item.is-selected {
  background: rgba(84, 222, 198, 0.18);
  outline: 1px solid rgba(84, 222, 198, 0.5);
}

.slot-name {
  color: #dfe8ff;
}

.slot-attachment {
  color: #8b8b8b;
  text-align: right;
}
</style>
