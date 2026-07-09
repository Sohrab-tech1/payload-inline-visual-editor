export type RectLike = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export type DropOrientation = 'horizontal' | 'vertical'

/**
 * Containers usually stack rows vertically; a row of nav items stacks
 * horizontally. Whichever axis spreads the row centers further apart wins.
 */
export const detectOrientation = (rects: RectLike[]): DropOrientation => {
  if (rects.length < 2) {
    return 'vertical'
  }
  const centersX = rects.map((rect) => rect.left + rect.width / 2)
  const centersY = rects.map((rect) => rect.top + rect.height / 2)
  const spreadX = Math.max(...centersX) - Math.min(...centersX)
  const spreadY = Math.max(...centersY) - Math.min(...centersY)
  return spreadX > spreadY ? 'horizontal' : 'vertical'
}

/**
 * Gap index (0..n insertion position) for a pointer among sibling row rects:
 * the number of rows whose midpoint precedes the pointer along the stacking
 * axis (SPEC §8).
 */
export const computeDropGap = (
  rects: RectLike[],
  point: { x: number; y: number },
  orientation: DropOrientation = detectOrientation(rects),
): number => {
  let gap = 0
  for (const rect of rects) {
    const midpoint = orientation === 'horizontal' ? rect.left + rect.width / 2 : rect.top + rect.height / 2
    const pointer = orientation === 'horizontal' ? point.x : point.y
    if (pointer > midpoint) {
      gap += 1
    }
  }
  return gap
}

/**
 * Maps an insertion gap (computed against the unmodified sibling list) to
 * moveFieldRow's toIndex (remove-then-insert semantics). Returns null for
 * no-op moves.
 */
export const gapToMoveToIndex = (gapIndex: number, fromIndex: number): null | number => {
  const toIndex = gapIndex > fromIndex ? gapIndex - 1 : gapIndex
  return toIndex === fromIndex ? null : toIndex
}

/** Drop-indicator line coordinates for a gap, spanning the rows' union extent. */
export const dropIndicatorLine = (
  rects: RectLike[],
  gapIndex: number,
  orientation: DropOrientation = detectOrientation(rects),
): null | { length: number; orientation: DropOrientation; x: number; y: number } => {
  if (rects.length === 0) {
    return null
  }
  if (orientation === 'horizontal') {
    const top = Math.min(...rects.map((rect) => rect.top))
    const bottom = Math.max(...rects.map((rect) => rect.bottom))
    const x = gapIndex < rects.length ? rects[gapIndex]!.left : rects[rects.length - 1]!.right
    return { length: bottom - top, orientation, x, y: top }
  }
  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const y = gapIndex < rects.length ? rects[gapIndex]!.top : rects[rects.length - 1]!.bottom
  return { length: right - left, orientation, x: left, y }
}

export type DragSessionOptions = {
  /** Movement threshold (px) before the drag activates; a plain click stays a click. */
  activationDistance?: number
  onCancel?: () => void
  onDrag: (point: { x: number; y: number }) => void
  onDrop: (point: { x: number; y: number }) => void
  startEvent: PointerEvent
  window?: Window
}

/**
 * Tracks one pointer-drag from a chip drag handle. HTML5 DnD cannot cross
 * frames, so this is plain pointer tracking; Escape cancels.
 */
export const startDragSession = (options: DragSessionOptions): (() => void) => {
  const win = options.window ?? window
  const threshold = options.activationDistance ?? 3
  const startX = options.startEvent.clientX
  const startY = options.startEvent.clientY
  let active = false
  let done = false

  const finish = (): void => {
    if (done) {
      return
    }
    done = true
    win.removeEventListener('pointermove', onPointerMove, { capture: true })
    win.removeEventListener('pointerup', onPointerUp, { capture: true })
    win.removeEventListener('pointercancel', onCancel, { capture: true })
    win.removeEventListener('keydown', onKeyDown, { capture: true })
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!active && Math.hypot(event.clientX - startX, event.clientY - startY) < threshold) {
      return
    }
    active = true
    event.preventDefault()
    options.onDrag({ x: event.clientX, y: event.clientY })
  }

  const onPointerUp = (event: PointerEvent): void => {
    const wasActive = active
    finish()
    if (wasActive) {
      options.onDrop({ x: event.clientX, y: event.clientY })
    } else {
      options.onCancel?.()
    }
  }

  const onCancel = (): void => {
    finish()
    options.onCancel?.()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      onCancel()
    }
  }

  win.addEventListener('pointermove', onPointerMove, { capture: true })
  win.addEventListener('pointerup', onPointerUp, { capture: true })
  win.addEventListener('pointercancel', onCancel, { capture: true })
  win.addEventListener('keydown', onKeyDown, { capture: true })

  return () => {
    finish()
  }
}
