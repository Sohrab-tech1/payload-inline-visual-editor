export type PopoverPoint = { x: number; y: number }

export type PopoverSize = { height: number; width: number }

export type IframeRectLike = { left: number; top: number; width: number }

/**
 * Map a point in iframe-viewport CSS pixels to admin-viewport coordinates.
 * Live Preview scales the iframe with a CSS transform: its bounding rect is the
 * visual (scaled) box while the layout width is the device width — their ratio
 * is the effective scale for any zoom/breakpoint combination.
 */
export const translateIframePoint = (args: {
  /** The iframe's layout size (offsetWidth/offsetHeight) — unaffected by the transform. */
  contentSize: PopoverSize
  iframeRect: IframeRectLike
  point: PopoverPoint
}): PopoverPoint => {
  const { contentSize, iframeRect, point } = args
  const scale = contentSize.width > 0 ? iframeRect.width / contentSize.width : 1
  // The point comes from the untrusted iframe — confine it to the visible page
  const x = Math.min(Math.max(Number.isFinite(point.x) ? point.x : 0, 0), contentSize.width)
  const y = Math.min(Math.max(Number.isFinite(point.y) ? point.y : 0, 0), contentSize.height)
  return { x: iframeRect.left + x * scale, y: iframeRect.top + y * scale }
}

/** Place a popover of `size` near `anchor`: below-right by default, flipped then clamped to fit. */
export const placePopover = (args: {
  anchor: PopoverPoint
  margin?: number
  offset?: number
  size: PopoverSize
  viewport: PopoverSize
}): { left: number; top: number } => {
  const { anchor, margin = 8, offset = 12, size, viewport } = args

  let left = anchor.x + offset
  if (left + size.width > viewport.width - margin) {
    left = anchor.x - offset - size.width
  }
  left = Math.max(margin, Math.min(left, viewport.width - size.width - margin))

  let top = anchor.y + offset
  if (top + size.height > viewport.height - margin) {
    top = anchor.y - offset - size.height
  }
  top = Math.max(margin, Math.min(top, viewport.height - size.height - margin))

  return { left, top }
}
