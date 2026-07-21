<template>
  <div class="skeleton-tree">
    <div v-for="bone in bones" :key="bone.name" class="tree-node">
      <div class="tree-row" :style="{ paddingLeft: `${depth * 14}px` }">
        <button
          v-if="hasChildren(bone)"
          type="button"
          class="tree-toggle"
          :aria-label="`${isOpen(bone) ? 'Collapse' : 'Expand'} ${bone.name}`"
          :aria-expanded="isOpen(bone)"
          @click="toggle(bone)"
        >
          <svg :class="{ open: isOpen(bone) }" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 3.5L9 7l-4 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span v-else class="tree-toggle tree-toggle--empty" aria-hidden="true"></span>
        <button
          type="button"
          class="tree-select"
          :class="{ 'is-selected': selectedBoneName === bone.name && !selectedSlotName }"
          :title="bone.name"
          @click="emit('bone-selected', bone.name)"
        >
          <span class="bone-name">{{ bone.name }}</span><span class="bone-meta">{{ bone.slots.length }} slot{{ bone.slots.length === 1 ? '' : 's' }}</span>
        </button>
      </div>

      <div v-show="isOpen(bone)" class="tree-children">
        <div v-for="slot in bone.slots" :key="slot.name" class="slot-row" :style="{ paddingLeft: `${(depth + 1) * 14 + 24}px` }">
          <button type="button" class="slot-item" :class="{ 'is-selected': selectedSlotName === slot.name }" :title="slot.attachmentName ? `${slot.name} - ${slot.attachmentName}` : slot.name" @click="emit('slot-selected', slot.name, slot.boneName)">
            <span class="slot-name">{{ slot.name }}</span><span class="slot-attachment">{{ slot.attachmentName || 'no attachment' }}</span>
          </button>
        </div>
        <SkeletonTree v-if="bone.children.length" :bones="bone.children" :depth="depth + 1" :expansion-command="expansionCommand" :selected-bone-name="selectedBoneName" :selected-slot-name="selectedSlotName" @bone-selected="emit('bone-selected', $event)" @slot-selected="(slotName, boneName) => emit('slot-selected', slotName, boneName)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SpineBoneNode } from '../lib/spine/skeletonStructure'

defineOptions({ name: 'SkeletonTree' })
const props = withDefaults(defineProps<{ bones: SpineBoneNode[]; depth?: number; expansionCommand?: { id: number; expanded: boolean }; selectedBoneName?: string | null; selectedSlotName?: string | null }>(), { depth: 0, expansionCommand: undefined, selectedBoneName: null, selectedSlotName: null })
const emit = defineEmits<{ 'bone-selected': [boneName: string]; 'slot-selected': [slotName: string, boneName: string] }>()
const expandedNames = ref(new Set(props.depth < 1 ? props.bones.map(bone => bone.name) : []))
const hasChildren = (bone: SpineBoneNode) => bone.children.length > 0 || bone.slots.length > 0
const isOpen = (bone: SpineBoneNode) => expandedNames.value.has(bone.name)
const toggle = (bone: SpineBoneNode) => {
  const next = new Set(expandedNames.value)
  next.has(bone.name) ? next.delete(bone.name) : next.add(bone.name)
  expandedNames.value = next
}

watch(() => props.expansionCommand?.id, () => {
  if (!props.expansionCommand) return
  expandedNames.value = props.expansionCommand.expanded
    ? new Set(props.bones.filter(hasChildren).map(bone => bone.name))
    : new Set()
})
</script>

<style scoped>
.skeleton-tree { display: flex; flex-direction: column; gap: 3px; }
.tree-node { border: 1px solid var(--border-muted); border-radius: var(--radius-md); background: var(--bg-surface); overflow: hidden; }
.tree-row { display: flex; align-items: center; gap: 4px; min-height: 36px; padding-right: 6px; }
.tree-toggle { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; flex-shrink: 0; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; }
.tree-toggle:hover, .tree-toggle:focus-visible { outline: none; background: var(--bg-raised); color: var(--accent); }
.tree-toggle svg { transition: transform var(--transition); }.tree-toggle svg.open { transform: rotate(90deg); }.tree-toggle--empty { pointer-events: none; }
.tree-select, .slot-item { min-width: 0; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 0; border-radius: var(--radius-sm); background: transparent; text-align: left; cursor: pointer; }
.tree-select { min-height: 28px; padding: 5px 8px; }.tree-select:hover, .tree-select:focus-visible { outline: none; background: var(--bg-raised); }.tree-select.is-selected { background: var(--accent-dim); box-shadow: inset 2px 0 var(--accent); }
.bone-name, .slot-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.bone-name { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-primary); }.bone-meta, .slot-attachment { flex-shrink: 0; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
.tree-children { border-top: 1px solid var(--border-muted); }.slot-row { padding-right: 6px; }.slot-item { min-height: 32px; padding: 5px 8px; font-size: 12px; }.slot-item:hover, .slot-item:focus-visible { outline: none; background: var(--bg-raised); }.slot-item.is-selected { background: rgba(95, 173, 130, 0.12); box-shadow: inset 2px 0 var(--success); }.slot-name { color: var(--text-secondary); }.slot-attachment { text-align: right; }
</style>
