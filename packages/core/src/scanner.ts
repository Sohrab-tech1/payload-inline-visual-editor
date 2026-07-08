import type { PveRegion } from './protocol.js'

import { PVE_ATTR } from './attrs.js'

export type ScannedRegion = PveRegion & { element: Element }

const regionId = (scope: string, kind: PveRegion['kind'], path: string, rowId?: null | string): string =>
  `${scope}|${kind}|${path}|${rowId ?? ''}`

export const scanRegions = (root: ParentNode = document): ScannedRegion[] => {
  const regions: ScannedRegion[] = []
  const elements = root.querySelectorAll(`[${PVE_ATTR.field}], [${PVE_ATTR.container}]`)

  for (const element of elements) {
    const scopeElement = element.closest(`[${PVE_ATTR.scope}]`)
    const scope = scopeElement?.getAttribute(PVE_ATTR.scope)
    if (!scope) {
      continue
    }

    const fieldPath = element.getAttribute(PVE_ATTR.field)
    if (fieldPath) {
      const rowId = element.getAttribute(PVE_ATTR.row)
      const kind = rowId ? 'row' : 'field'
      regions.push({
        blockType: element.getAttribute(PVE_ATTR.blockType) ?? undefined,
        element,
        kind,
        path: fieldPath,
        regionId: regionId(scope, kind, fieldPath, rowId),
        rowId: rowId ?? undefined,
        scope,
      })
    }

    const containerPath = element.getAttribute(PVE_ATTR.container)
    if (containerPath) {
      regions.push({
        element,
        kind: 'container',
        path: containerPath,
        regionId: regionId(scope, 'container', containerPath),
        scope,
      })
    }
  }

  return regions
}

export const toProtocolRegions = (regions: ScannedRegion[]): PveRegion[] =>
  regions.map(({ element: _element, ...region }) => region)
