// @vitest-environment jsdom
import { scanRegions, toProtocolRegions } from '@payload-inline-visual-editor/core'
import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(() => {
  document.body.innerHTML = `
    <main data-pve-scope="collection:pages;id:abc">
      <div data-pve-container="layout">
        <section data-pve-field="layout.0" data-pve-row="row1" data-pve-block-type="hero">
          <h1 data-pve-field="layout.0.heading">Hi</h1>
        </section>
      </div>
    </main>
    <header data-pve-scope="global:header">
      <span data-pve-field="navItems.0.label">Home</span>
    </header>
    <div data-pve-field="orphan.path">no scope ancestor</div>
  `
})

describe('scanRegions', () => {
  it('builds the region registry with nearest-ancestor scopes', () => {
    const regions = scanRegions()

    expect(regions).toHaveLength(4)

    const container = regions.find((r) => r.kind === 'container')
    expect(container).toMatchObject({ path: 'layout', scope: 'collection:pages;id:abc' })

    const row = regions.find((r) => r.kind === 'row')
    expect(row).toMatchObject({
      blockType: 'hero',
      path: 'layout.0',
      rowId: 'row1',
      scope: 'collection:pages;id:abc',
    })

    const heading = regions.find((r) => r.path === 'layout.0.heading')
    expect(heading).toMatchObject({ kind: 'field', scope: 'collection:pages;id:abc' })

    const navLabel = regions.find((r) => r.path === 'navItems.0.label')
    expect(navLabel).toMatchObject({ kind: 'field', scope: 'global:header' })
  })

  it('skips elements without a scope ancestor', () => {
    expect(scanRegions().some((r) => r.path === 'orphan.path')).toBe(false)
  })

  it('produces stable region ids and serializable protocol regions', () => {
    const first = scanRegions()
    const second = scanRegions()
    expect(first.map((r) => r.regionId)).toEqual(second.map((r) => r.regionId))

    for (const region of toProtocolRegions(first)) {
      expect(region).not.toHaveProperty('element')
    }
  })
})
