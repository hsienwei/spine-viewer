import type { SpineMajorVersion, SpineSourceFiles } from '../versionDetection'
import type { SpineSelectionState, SpineSkeletonStructure } from '../skeletonStructure'

export type SpineAnimationEventType = 'start' | 'interrupt' | 'end' | 'dispose' | 'complete' | 'event'

export interface SpineAnimationEventPayload {
  type: SpineAnimationEventType
  trackIndex: number
  animationName: string | null
  trackTime: number | null
  loopCount?: number | null
  eventName?: string | null
  intValue?: number | null
  floatValue?: number | null
  stringValue?: string | null
  volume?: number | null
  balance?: number | null
}

export interface SpineAnimationMarkerEvent {
  eventName: string
  intValue?: number | null
  floatValue?: number | null
  stringValue?: string | null
  volume?: number | null
  balance?: number | null
}

export interface SpineAnimationEventMarker {
  time: number
  trackIndex: number
  events: SpineAnimationMarkerEvent[]
}

export interface SpineAnimationSummary {
  name: string
  duration: number
  eventMarkers: SpineAnimationEventMarker[]
}

export interface SpineSessionCreateInput {
  canvas: HTMLCanvasElement
  sourceFiles: SpineSourceFiles
  animationName?: string
  premultipliedAlpha?: boolean
  onLoaded: (data: {
    animations: string[]
    animationSummaries: SpineAnimationSummary[]
    skeletonName: string
    drawCall: number
    duration: number
    structure: SpineSkeletonStructure
  }) => void
  onError: (error: string) => void
  onAnimationEvent: (payload: SpineAnimationEventPayload) => void
  onTimeUpdate: (currentTime: number, duration: number, drawCall: number) => void
  onViewState: (state: {
    bounds: { width: number; height: number }
    panOffset: { x: number; y: number }
    viewScale: number
  }) => void
}

export interface SpineDebugOptions {
  showAxes: boolean
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
