const LAYER_ATTR = 'data-pve-overlay'

/**
 * Single fixed, pointer-events:none layer appended to <body>. Site CSS is
 * never mutated; chips re-enable pointer events locally (M3).
 */
export class OverlayRenderer {
  private layer: HTMLDivElement | null = null

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
    doc.body.appendChild(layer)
    this.layer = layer
  }

  unmount(): void {
    this.layer?.remove()
    this.layer = null
  }
}
