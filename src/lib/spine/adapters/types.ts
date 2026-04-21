import type { SpineMajorVersion, SpineSourceFiles } from '../versionDetection'
import type { SpineSelectionState, SpineSkeletonStructure } from '../skeletonStructure'

export interface SpineSessionCreateInput {
  canvas: HTMLCanvasElement
  sourceFiles: SpineSourceFiles
  animationName?: string
  premultipliedAlpha?: boolean
  onLoaded: (data: {
    animations: string[]
    skeletonName: string
    drawCall: number
    duration: number
    structure: SpineSkeletonStructure
  }) => void
  onError: (error: string) => void
  onTimeUpdate: (currentTime: number, duration: number, drawCall: number) => void
  onViewState: (state: {
    bounds: { width: number; height: number }
    panOffset: { x: number; y: number }
    viewScale: number
  }) => void
}

export interface SpineDebugOptions {
  showBones: boolean
  showSlots: boolean
}

export interface SpineRuntimeSession {
  version: SpineMajorVersion
  setAnimation(name: string, loop: boolean): void
  setPlayback(enabled: boolean, playbackRate: number): void
  setDebugOptions(options: SpineDebugOptions): void
  setSelection(selection: SpineSelectionState): void
  setPremultipliedAlpha(value: boolean): void
  seekTo(time: number): void
  resetView(): void
  getViewScale(): number
  adjustViewScale(nextScale: number): void
  panBy(dx: number, dy: number): void
  screenToWorld(x: number, y: number): { x: number; y: number } | null
  resize(): void
  dispose(): void
}

export interface SpineRuntimeAdapter {
  version: SpineMajorVersion
  createSession(input: SpineSessionCreateInput): Promise<SpineRuntimeSession>
}
