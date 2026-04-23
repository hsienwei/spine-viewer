export interface WorldPoint {
  x: number
  y: number
}

export interface AxisOverlayLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface AxisOverlay {
  xAxis: AxisOverlayLine
  yAxis: AxisOverlayLine
}

interface AxisOverlayInput {
  canvasWidth: number
  canvasHeight: number
  screenToWorld: (x: number, y: number) => WorldPoint | null
}

const AXIS_MARGIN = 64

export const createAxisOverlay = ({
  canvasWidth,
  canvasHeight,
  screenToWorld
}: AxisOverlayInput): AxisOverlay | null => {
  if (canvasWidth <= 0 || canvasHeight <= 0) return null

  const corners = [
    screenToWorld(0, 0),
    screenToWorld(canvasWidth, 0),
    screenToWorld(0, canvasHeight),
    screenToWorld(canvasWidth, canvasHeight)
  ]

  if (corners.some(corner => !corner)) return null

  const resolvedCorners = corners as WorldPoint[]
  const xs = resolvedCorners.map(point => point.x)
  const ys = resolvedCorners.map(point => point.y)
  const left = Math.min(...xs) - AXIS_MARGIN
  const right = Math.max(...xs) + AXIS_MARGIN
  const bottom = Math.min(...ys) - AXIS_MARGIN
  const top = Math.max(...ys) + AXIS_MARGIN

  return {
    xAxis: {
      x1: left,
      y1: 0,
      x2: right,
      y2: 0
    },
    yAxis: {
      x1: 0,
      y1: bottom,
      x2: 0,
      y2: top
    }
  }
}
