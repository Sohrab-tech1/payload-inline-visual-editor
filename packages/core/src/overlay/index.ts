const LAYER_ATTR = 'data-pve-overlay'

const HIGHLIGHT_COLOR = '#2563eb'
const HIGHLIGHT_BG = 'rgba(37, 99, 235, 0.08)'
const LABEL_HEIGHT = 20
const FLASH_MS = 1200

export type OverlayHoverTarget = {
  element: Element
  label: string
}

/**
 * Single fixed, pointer-events:none layer appended to <body>. Site CSS is
 * never mutated; chips re-enable pointer events locally (M3). The layer is
 * position:fixed so getBoundingClientRect viewport coords map 1:1 — no scroll
 * offset math, and Live Preview's iframe zoom scales everything together.
 */
export class OverlayRenderer {
  private box: HTMLDivElement | null = null
  private flashBox: HTMLDivElement | null = null
  private flashTarget: Element | null = null
  private flashTimer: null | ReturnType<typeof setTimeout> = null
  private hoverTarget: OverlayHoverTarget | null = null
  private label: HTMLDivElement | null = null
  private layer: HTMLDivElement | null = null
  private rafId: null | number = null
  private resizeObserver: null | ResizeObserver = null

  private readonly scheduleRefresh = (): void => {
    if (this.rafId !== null) {
      return
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      this.refresh()
    })
  }

  get mounted(): boolean {
    return this.layer !== null
  }

  mount(doc: Document = document): void {
    if (this.layer) {
      return
    }
    const layer = doc.createElement('div')
    layer.setAttribute(LAYER_ATTR, '')
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;'

    const box = doc.createElement('div')
    box.setAttribute('data-pve-hover-box', '')
    box.style.cssText =
      `position:fixed;display:none;box-sizing:border-box;border:2px solid ${HIGHLIGHT_COLOR};` +
      `background:${HIGHLIGHT_BG};border-radius:2px;`
    layer.appendChild(box)

    const label = doc.createElement('div')
    label.setAttribute('data-pve-hover-label', '')
    label.style.cssText =
      `position:fixed;display:none;height:${LABEL_HEIGHT}px;line-height:${LABEL_HEIGHT}px;` +
      `background:${HIGHLIGHT_COLOR};color:#fff;padding:0 6px;border-radius:3px 3px 3px 0;` +
      'font:600 11px/20px system-ui,sans-serif;white-space:nowrap;max-width:60vw;' +
      'overflow:hidden;text-overflow:ellipsis;'
    layer.appendChild(label)

    const flashBox = doc.createElement('div')
    flashBox.setAttribute('data-pve-flash-box', '')
    flashBox.style.cssText =
      `position:fixed;display:none;box-sizing:border-box;border:2px solid ${HIGHLIGHT_COLOR};` +
      `background:${HIGHLIGHT_BG};border-radius:2px;`
    layer.appendChild(flashBox)

    doc.body.appendChild(layer)
    this.layer = layer
    this.box = box
    this.label = label
    this.flashBox = flashBox

    const win = doc.defaultView ?? window
    win.addEventListener('resize', this.scheduleRefresh)
    doc.addEventListener('scroll', this.scheduleRefresh, { capture: true, passive: true })
  }

  /** Draws a temporary highlight (admin-side field focus → page element). */
  flash(element: Element): void {
    if (!this.flashBox) {
      return
    }
    this.flashTarget = element
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer)
    }
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null
      this.flashTarget = null
      this.refresh()
    }, FLASH_MS)

    this.flashBox.style.display = 'block'
    if (typeof this.flashBox.animate === 'function') {
      this.flashBox.animate(
        [{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }],
        { duration: FLASH_MS, easing: 'ease-out' },
      )
    }
    this.refresh()
  }

  refresh(): void {
    if (!this.box || !this.label) {
      return
    }
    if (this.flashBox) {
      if (this.flashTarget?.isConnected) {
        const flashRect = this.flashTarget.getBoundingClientRect()
        this.flashBox.style.display = 'block'
        this.flashBox.style.left = `${flashRect.left}px`
        this.flashBox.style.top = `${flashRect.top}px`
        this.flashBox.style.width = `${flashRect.width}px`
        this.flashBox.style.height = `${flashRect.height}px`
      } else {
        this.flashBox.style.display = 'none'
      }
    }
    if (!this.hoverTarget || !this.hoverTarget.element.isConnected) {
      this.box.style.display = 'none'
      this.label.style.display = 'none'
      return
    }

    const rect = this.hoverTarget.element.getBoundingClientRect()
    this.box.style.display = 'block'
    this.box.style.left = `${rect.left}px`
    this.box.style.top = `${rect.top}px`
    this.box.style.width = `${rect.width}px`
    this.box.style.height = `${rect.height}px`

    this.label.style.display = 'block'
    this.label.textContent = this.hoverTarget.label
    this.label.style.left = `${Math.max(0, rect.left)}px`
    const labelAbove = rect.top - LABEL_HEIGHT
    if (labelAbove >= 0) {
      this.label.style.top = `${labelAbove}px`
      this.label.style.borderRadius = '3px 3px 3px 0'
    } else {
      this.label.style.top = `${Math.max(0, rect.top)}px`
      this.label.style.borderRadius = '0 3px 3px 0'
    }
  }

  setHover(target: null | OverlayHoverTarget): void {
    if (this.hoverTarget?.element === target?.element && this.hoverTarget?.label === target?.label) {
      return
    }
    this.hoverTarget = target
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (target && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.scheduleRefresh)
      this.resizeObserver.observe(target.element)
    }
    this.refresh()
  }

  unmount(): void {
    if (!this.layer) {
      return
    }
    const doc = this.layer.ownerDocument
    const win = doc.defaultView ?? window
    win.removeEventListener('resize', this.scheduleRefresh)
    doc.removeEventListener('scroll', this.scheduleRefresh, { capture: true })
    if (this.rafId !== null) {
      ;(doc.defaultView ?? window).cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.hoverTarget = null
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer)
      this.flashTimer = null
    }
    this.flashTarget = null
    this.layer.remove()
    this.layer = null
    this.box = null
    this.label = null
    this.flashBox = null
  }
}
