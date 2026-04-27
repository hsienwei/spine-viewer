import type { SpineAnimationEventMarker, SpineAnimationMarkerEvent, SpineAnimationSummary } from './types'

const MARKER_TIME_PRECISION = 4

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value)
}

const isIndexedCollection = (value: unknown): value is ArrayLike<unknown> => {
  if (!value || typeof value !== 'object') return false
  return 'length' in value && typeof (value as { length?: unknown }).length === 'number'
}

const normalizeLabel = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  return fallback
}

const normalizeMarkerEvent = (timelineEvent: any): SpineAnimationMarkerEvent => ({
  eventName: normalizeLabel(timelineEvent?.data?.name ?? timelineEvent?.name, 'Unnamed event'),
  intValue: isNumber(timelineEvent?.intValue) ? timelineEvent.intValue : null,
  floatValue: isNumber(timelineEvent?.floatValue) ? timelineEvent.floatValue : null,
  stringValue: typeof timelineEvent?.stringValue === 'string' ? timelineEvent.stringValue : null,
  volume: isNumber(timelineEvent?.volume) ? timelineEvent.volume : null,
  balance: isNumber(timelineEvent?.balance) ? timelineEvent.balance : null
})

const isEventTimeline = (timeline: any, spine: any) => {
  if (!timeline) return false
  if (typeof spine?.EventTimeline === 'function' && timeline instanceof spine.EventTimeline) {
    return true
  }

  return isIndexedCollection(timeline?.frames) && isIndexedCollection(timeline?.events)
}

const roundMarkerTime = (time: number) => {
  return Number(time.toFixed(MARKER_TIME_PRECISION))
}

const extractEventMarkers = (animation: any, spine: any): SpineAnimationEventMarker[] => {
  const markerMap = new Map<string, SpineAnimationEventMarker>()
  const timelines = Array.isArray(animation?.timelines) ? animation.timelines : []

  timelines.forEach((timeline: any) => {
    if (!isEventTimeline(timeline, spine)) return

    const frames = isIndexedCollection(timeline.frames) ? timeline.frames : []
    const events = isIndexedCollection(timeline.events) ? timeline.events : []
    const frameCount = Math.min(frames.length, events.length)

    for (let index = 0; index < frameCount; index += 1) {
      const timelineEvent = events[index]
      const fallbackTime = isNumber(timelineEvent?.time) ? timelineEvent.time : null
      const rawTime = isNumber(frames[index]) ? frames[index] : fallbackTime
      if (!isNumber(rawTime)) continue

      const time = roundMarkerTime(rawTime)
      const markerKey = `${time}|0`
      const markerEvent = normalizeMarkerEvent(timelineEvent)
      const existingMarker = markerMap.get(markerKey)

      if (existingMarker) {
        existingMarker.events.push(markerEvent)
        continue
      }

      markerMap.set(markerKey, {
        time,
        trackIndex: 0,
        events: [markerEvent]
      })
    }
  })

  return [...markerMap.values()].sort((left, right) => left.time - right.time)
}

export const extractAnimationSummaries = (animations: any[], spine: any): SpineAnimationSummary[] => {
  return animations.map((animation: any) => ({
    name: normalizeLabel(animation?.name, 'Unnamed animation'),
    duration: isNumber(animation?.duration) ? animation.duration : 0,
    eventMarkers: extractEventMarkers(animation, spine)
  }))
}
