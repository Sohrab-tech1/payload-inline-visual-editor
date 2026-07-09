// @vitest-environment jsdom
import { createPveMessage, initVisualEditing, PROTOCOL_VERSION } from '@payload-inline-visual-editor/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ADMIN_ORIGIN = 'http://admin.example.com'

const sendFromAdmin = (type: string, payload: unknown, sessionId = 'session-1'): void => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { payload, sessionId, type: `payload-visual-editor:${type}`, version: PROTOCOL_VERSION },
      origin: ADMIN_ORIGIN,
    }),
  )
}

const helloPayload = {
  docs: [{ collection: 'pages', id: 'abc' }],
  editMode: true,
  labels: { hero: 'Hero section' },
  permissions: { canPublish: true, canSave: true, fields: {} },
}

const outgoing = (post: ReturnType<typeof vi.spyOn>) =>
  post.mock.calls.map(([message]) => message as ReturnType<typeof createPveMessage>)

describe('initVisualEditing (site SDK end-to-end)', () => {
  let teardown: (() => void) | undefined
  let post: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    document.body.innerHTML = `
      <main data-pve-scope="collection:pages;id:abc">
        <div data-pve-container="layout">
          <section data-pve-field="layout.0" data-pve-row="row1" data-pve-block-type="hero">
            <h1 data-pve-field="layout.0.heading">Hi</h1>
          </section>
        </div>
      </main>
    `
    post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
  })

  afterEach(() => {
    teardown?.()
    teardown = undefined
    post.mockRestore()
  })

  it('stays inert until hello, then mounts the overlay and reports regions', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    expect(document.querySelector('[data-pve-overlay]')).toBeNull()

    sendFromAdmin('hello', helloPayload)

    expect(document.querySelector('[data-pve-overlay]')).not.toBeNull()
    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual([
      'payload-visual-editor:hello-ack',
      'payload-visual-editor:regions',
    ])
    const regions = (messages[1]!.payload as { regions: unknown[] }).regions
    expect(regions).toHaveLength(3)
  })

  it('shows a hover highlight with a label and reports hover + select', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)
    post.mockClear()

    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))

    const box = document.querySelector('[data-pve-hover-box]') as HTMLElement
    const label = document.querySelector('[data-pve-hover-label]') as HTMLElement
    expect(box.style.display).toBe('block')
    expect(label.textContent).toBe('Heading')

    let messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:hover'])
    expect(messages[0]!.payload).toMatchObject({ path: 'layout.0.heading' })

    // Row hover uses the block label from hello
    post.mockClear()
    const row = document.querySelector('[data-pve-row]')!
    row.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(label.textContent).toBe('Hero section')

    // Click-to-select is suppressed and reported
    post.mockClear()
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    heading.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:select'])
    expect(messages[0]!.payload).toMatchObject({ path: 'layout.0.heading', scope: 'collection:pages;id:abc' })
  })

  it('clears the highlight when the pointer moves off marked regions', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))
    post.mockClear()

    document.body.dispatchEvent(new Event('pointermove', { bubbles: true }))

    const box = document.querySelector('[data-pve-hover-box]') as HTMLElement
    expect(box.style.display).toBe('none')
    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:hover'])
    expect(messages[0]!.payload).toBeNull()
  })

  it('re-reports regions after DOM mutations while editing', async () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)
    post.mockClear()

    const extra = document.createElement('p')
    extra.setAttribute('data-pve-field', 'layout.0.subheading')
    document.querySelector('[data-pve-row]')!.appendChild(extra)
    await new Promise((resolve) => setTimeout(resolve, 150))

    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:regions'])
    const regions = (messages[0]!.payload as { regions: { path: string }[] }).regions
    expect(regions.some((region) => region.path === 'layout.0.subheading')).toBe(true)
  })

  it('flashes the page element on an admin focus message', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    sendFromAdmin('focus', { path: 'layout.0.heading' })
    const flashBox = document.querySelector('[data-pve-flash-box]') as HTMLElement
    expect(flashBox.style.display).toBe('block')
  })

  it('hides affordances for non-updatable paths but selects the nearest editable ancestor', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', {
      ...helloPayload,
      permissions: {
        canPublish: true,
        canSave: true,
        fields: { 'layout.hero.heading': { update: false } },
      },
    })
    post.mockClear()

    // The denied leaf itself gets no highlight...
    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const label = document.querySelector('[data-pve-hover-label]') as HTMLElement
    // ...but hover/select walk up to the editable row region
    expect(label.textContent).toBe('Hero section')

    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    heading.dispatchEvent(click)
    const selects = outgoing(post).filter((m) => m.type === 'payload-visual-editor:select')
    expect(selects).toHaveLength(1)
    expect(selects[0]!.payload).toMatchObject({ path: 'layout.0' })
  })

  it('is fully inert without save permission', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', {
      ...helloPayload,
      permissions: { canPublish: false, canSave: false, fields: {} },
    })
    post.mockClear()

    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const box = document.querySelector('[data-pve-hover-box]') as HTMLElement
    expect(box.style.display).toBe('none')

    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    heading.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(outgoing(post)).toHaveLength(0)
  })

  it('treats regions of other documents as read-only', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<header data-pve-scope="global:header"><span data-pve-field="navItems.0.label">Nav</span></header>`,
    )
    sendFromAdmin('hello', helloPayload)
    post.mockClear()

    const nav = document.querySelector('[data-pve-field="navItems.0.label"]')!
    nav.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const box = document.querySelector('[data-pve-hover-box]') as HTMLElement
    expect(box.style.display).toBe('none')

    // Editing the header global instead flips which regions are live
    sendFromAdmin('hello', { ...helloPayload, docs: [{ global: 'header' }] }, 'session-2')
    post.mockClear()
    nav.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(box.style.display).toBe('block')

    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(box.style.display).toBe('none')
  })

  it('tears down the overlay on edit-mode off and full teardown', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)
    expect(document.querySelector('[data-pve-overlay]')).not.toBeNull()

    sendFromAdmin('edit-mode', { enabled: false })
    expect(document.querySelector('[data-pve-overlay]')).toBeNull()

    sendFromAdmin('edit-mode', { enabled: true })
    expect(document.querySelector('[data-pve-overlay]')).not.toBeNull()

    teardown!()
    teardown = undefined
    expect(document.querySelector('[data-pve-overlay]')).toBeNull()
  })
})
