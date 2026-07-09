export * from './attrs.js'
export * from './bridge.js'
export * from './overlay/index.js'
export * from './permissions.js'
export * from './protocol.js'
export * from './scanner.js'

import type { PveDocRef, PvePermissionSummary } from './protocol.js'
import type { ScannedRegion } from './scanner.js'

import { parseScope, PVE_ATTR } from './attrs.js'
import { SiteBridge } from './bridge.js'
import { OverlayRenderer } from './overlay/index.js'
import { canUpdatePath } from './permissions.js'
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

const scopeMatchesDoc = (scope: string, docs: PveDocRef[]): boolean => {
  const parsed = parseScope(scope)
  if (!parsed) {
    return false
  }
  return docs.some((doc) => {
    if ('global' in parsed) {
      return doc.global === parsed.global
    }
    return (
      doc.collection === parsed.collection &&
      (parsed.id === undefined || doc.id === undefined || doc.id === parsed.id)
    )
  })
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
  let docs: PveDocRef[] = []
  let permissions: null | PvePermissionSummary = null
  let rowBlockTypes = new Map<string, string>()

  const regionLabel = (region: ScannedRegion): string => {
    if (region.kind === 'row' && region.blockType) {
      return labels[region.blockType] ?? region.blockType
    }
    return humanizePathTail(region.path)
  }

  const indexRowBlockTypes = (regions: ScannedRegion[]): void => {
    rowBlockTypes = new Map()
    for (const region of regions) {
      if (region.kind === 'row' && region.blockType) {
        rowBlockTypes.set(region.path, region.blockType)
      }
    }
  }

  const getBlockType = (rowPath: string): string | undefined => rowBlockTypes.get(rowPath)

  // Affordance-level gating only (SPEC §10) — the admin form and server access
  // control remain authoritative for anything the iframe requests.
  const isEditable = (region: ScannedRegion): boolean => {
    if (!scopeMatchesDoc(region.scope, docs)) {
      return false
    }
    return permissions ? canUpdatePath(region.path, permissions, getBlockType) : true
  }

  const registry = new RegionRegistry({
    onChange: (regions) => {
      indexRowBlockTypes(regions)
      bridge.send('regions', { regions: toProtocolRegions(regions) })
    },
    onRescan: (regions) => {
      indexRowBlockTypes(regions)
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
    // Nearest editable marked ancestor: a denied leaf inside an allowed row
    // still selects the row.
    for (
      let element = target.closest(`[${PVE_ATTR.field}]`);
      element;
      element = element.parentElement?.closest(`[${PVE_ATTR.field}]`) ?? null
    ) {
      const region = registry.regionForElement(element)
      if (region && isEditable(region)) {
        return region
      }
    }
    return null
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

  const flashPath = (path: string): void => {
    if (!editMode) {
      return
    }
    const kindOrder = { container: 2, field: 0, row: 1 } as const
    const candidates = registry.regions
      .filter((region) => region.path === path && region.element.isConnected)
      .sort(
        (a, b) =>
          Number(scopeMatchesDoc(b.scope, docs)) - Number(scopeMatchesDoc(a.scope, docs)) ||
          kindOrder[a.kind] - kindOrder[b.kind],
      )
    const target = candidates[0]
    if (!target) {
      return
    }
    const rect = target.element.getBoundingClientRect()
    const outOfView = rect.bottom < 0 || rect.top > window.innerHeight
    if (outOfView && typeof target.element.scrollIntoView === 'function') {
      target.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    overlay.flash(target.element)
  }

  const offMessage = bridge.onMessage((message) => {
    if (options.debug) {
      console.debug('[payload-inline-visual-editor]', message.type, message.payload)
    }
    switch (message.type) {
      case 'payload-visual-editor:edit-mode':
        setEditMode(message.payload.enabled)
        break
      case 'payload-visual-editor:focus':
        flashPath(message.payload.path)
        break
      case 'payload-visual-editor:hello':
        labels = message.payload.labels ?? {}
        docs = message.payload.docs ?? []
        permissions = message.payload.permissions ?? null
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
