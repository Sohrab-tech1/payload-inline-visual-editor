import { parseScope, pveAttr, serializeScope } from '@payload-inline-visual-editor/core'
import { describe, expect, it, vi } from 'vitest'

describe('scope serialization', () => {
  it('round-trips collection scopes', () => {
    const scope = { collection: 'pages', id: '665f1b2a3c4d5e6f70819202' }
    expect(parseScope(serializeScope(scope))).toEqual(scope)
  })

  it('round-trips global scopes', () => {
    const scope = { global: 'header' }
    expect(parseScope(serializeScope(scope))).toEqual(scope)
  })

  it('returns null for garbage', () => {
    expect(parseScope('')).toBeNull()
    expect(parseScope('nonsense')).toBeNull()
  })
})

describe('pveAttr', () => {
  it('emits field attributes', () => {
    expect(pveAttr.field('layout.0.heading')).toEqual({ 'data-pve-field': 'layout.0.heading' })
  })

  it('emits row attributes with block type', () => {
    expect(pveAttr.row('layout.0', { blockType: 'hero', id: 'abc123' })).toEqual({
      'data-pve-block-type': 'hero',
      'data-pve-field': 'layout.0',
      'data-pve-row': 'abc123',
    })
  })

  it('degrades to a plain field and warns when the row id is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(pveAttr.row('layout.0', { id: '' })).toEqual({ 'data-pve-field': 'layout.0' })
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('emits container and scope attributes', () => {
    expect(pveAttr.container('layout')).toEqual({ 'data-pve-container': 'layout' })
    expect(pveAttr.scope({ global: 'header' })).toEqual({ 'data-pve-scope': 'global:header' })
  })
})
