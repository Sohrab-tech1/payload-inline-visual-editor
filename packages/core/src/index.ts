export * from './attrs.js'
export * from './bridge.js'
export * from './overlay/index.js'
export * from './protocol.js'
export * from './scanner.js'

import type { ScannedRegion } from './scanner.js'

import { PVE_ATTR } from './attrs.js'
import { SiteBridge } from './bridge.js'
import { OverlayRenderer } from './overlay/index.js'
import { RegionRegistry, toProtocolRegions } from './scanner.js'

export type VisualEditingOptions = {
  debug?: boolean
  serverURL: string
}

const humanizePathTail = (path: string): string => {
  const segments = path.split('.')
  let tail = segments.pop()
  while (tail !== undefined && /^\d+$/.test(tail)) {
    tail = segments.pop()
  }
  if (!tail) {
    return path
  }
  const spaced = tail.replace(/[_-]+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Entry point for the site SDK. Wires bridge + scanner + overlay; stays fully
 * inert until the admin sends a valid `hello`. Returns a teardown function.
 */
export const initVisualEditing = (options: VisualEditingOptions): (() => void) => {
  const bridge = new SiteBridge({ serverURL: options.serverURL })
  const overlay = new OverlayRenderer()

  let editMode = false
  let hovered: null | ScannedRegion = null
  let labels: Record<string, string> = {}

  const regionLabel = (region: ScannedRegion): string => {
    if (region.kind === 'row' && region.blockType) {
      return labels[region.blockType] ?? region.blockType
    }
    return humanizePathTail(region.path)
  }

  const registry = new RegionRegistry({
    onChange: (regions) => {
      bridge.send('regions', { regions: toProtocolRegions(regions) })
    },
    onRescan: (regions) => {
      if (!hovered) {
        return
      }
      if (hovered.element.isConnected) {
        overlay.refresh()
        return
      }
      // The hovered node was replaced (e.g. live-preview re-render); re-resolve by identity
      const replacement = regions.find((region) => region.regionId === hovered?.regionId)
      setHovered(replacement ?? null)
    },
  })

  const setHovered = (region: null | ScannedRegion): void => {
    if (hovered?.regionId === region?.regionId && hovered?.element === region?.element) {
      return
    }
    const changedIdentity = hovered?.regionId !== region?.regionId
    hovered = region
    overlay.setHover(region ? { element: region.element, label: regionLabel(region) } : null)
    if (changedIdentity) {
      bridge.send(
        'hover',
        region ? { path: region.path, regionId: region.regionId, scope: region.scope } : null,
      )
    }
  }

  const regionFromEventTarget = (target: EventTarget | null): null | ScannedRegion => {
    if (!(target instanceof Element)) {
      return null
    }
    const element = target.closest(`[${PVE_ATTR.field}]`)
    return element ? (registry.regionForElement(element) ?? null) : null
  }

  const onPointerMove = (event: PointerEvent): void => {
    setHovered(regionFromEventTarget(event.target))
  }

  const onPointerLeave = (): void => {
    setHovered(null)
  }

  const onClick = (event: MouseEvent): void => {
    const region = regionFromEventTarget(event.target)
    if (!region) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    bridge.send('select', { path: region.path, regionId: region.regionId, scope: region.scope })
  }

  const setEditMode = (enabled: boolean): void => {
    if (enabled === editMode) {
      return
    }
    editMode = enabled
    if (enabled) {
      overlay.mount()
      registry.start()
      document.addEventListener('pointermove', onPointerMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPointerLeave)
      document.addEventListener('click', onClick, { capture: true })
    } else {
      document.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('click', onClick, { capture: true })
      setHovered(null)
      registry.stop()
      overlay.unmount()
    }
  }

  const offMessage = bridge.onMessage((message) => {
    if (options.debug) {
      console.debug('[payload-inline-visual-editor]', message.type, message.payload)
    }
    switch (message.type) {
      case 'payload-visual-editor:edit-mode':
        setEditMode(message.payload.enabled)
        break
      case 'payload-visual-editor:hello':
        labels = message.payload.labels ?? {}
        if (message.payload.editMode && editMode) {
          // New admin session while already editing: re-report to the new session
          bridge.send('regions', { regions: toProtocolRegions(registry.regions) })
        } else {
          setEditMode(message.payload.editMode)
        }
        break
    }
  })
  const disconnect = bridge.connect()

  return () => {
    offMessage()
    setEditMode(false)
    disconnect()
  }
}
