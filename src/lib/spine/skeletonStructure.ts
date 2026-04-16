export interface SpineSlotNode {
  name: string
  boneName: string
  attachmentName: string | null
}

export interface SpineBoneNode {
  name: string
  parentName: string | null
  slots: SpineSlotNode[]
  children: SpineBoneNode[]
}

export interface SpineSkeletonStructure {
  bones: SpineBoneNode[]
  slots: SpineSlotNode[]
}

export interface SpineSelectionState {
  boneName: string | null
  slotName: string | null
}

interface RawBone {
  name: string
  parent?: RawBone | null
}

interface RawSlot {
  name: string
  boneData?: {
    name?: string
  }
  attachmentName?: string | null
}

export const buildSkeletonStructure = (
  rawBones: RawBone[],
  rawSlots: RawSlot[]
): SpineSkeletonStructure => {
  const boneMap = new Map<string, SpineBoneNode>()
  const rootBones: SpineBoneNode[] = []

  rawBones.forEach((bone) => {
    boneMap.set(bone.name, {
      name: bone.name,
      parentName: bone.parent?.name || null,
      slots: [],
      children: []
    })
  })

  boneMap.forEach((boneNode) => {
    if (boneNode.parentName) {
      const parentNode = boneMap.get(boneNode.parentName)
      if (parentNode) {
        parentNode.children.push(boneNode)
        return
      }
    }

    rootBones.push(boneNode)
  })

  const slots: SpineSlotNode[] = rawSlots.map((slot) => ({
    name: slot.name,
    boneName: slot.boneData?.name || 'unknown',
    attachmentName: slot.attachmentName || null
  }))

  slots.forEach((slot) => {
    const targetBone = boneMap.get(slot.boneName)
    if (targetBone) {
      targetBone.slots.push(slot)
    }
  })

  return {
    bones: rootBones,
    slots
  }
}
