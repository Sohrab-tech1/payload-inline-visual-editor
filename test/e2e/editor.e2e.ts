import type { FrameLocator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

const login = async (page: Page, email: string): Promise<void> => {
  await page.goto('/admin/login')
  await page.fill('#field-email', email)
  await page.fill('#field-password', 'test')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin')
}

// Enter Live Preview (stock toggler) unless a saved preference already enabled it
const enterLivePreview = async (page: Page): Promise<FrameLocator> => {
  const toggler = page.locator('#live-preview-toggler')
  await toggler.waitFor()
  await page.waitForLoadState('networkidle')
  const isPreviewing = await toggler.evaluate((el) => el.classList.contains('live-preview-toggler--active'))
  if (!isPreviewing) {
    await toggler.click()
  }
  return page.frameLocator('iframe#live-preview-iframe')
}

// Navigate by id (list-view order shifts as e2e fixture pages accumulate)
const openHomePageInLivePreview = async (page: Page, email: string): Promise<FrameLocator> => {
  await login(page, email)
  const response = await page.request.get('/api/pages?where[slug][equals]=home&limit=1&depth=0')
  expect(response.ok()).toBe(true)
  const { docs } = (await response.json()) as { docs: { id: number | string }[] }
  expect(docs).toHaveLength(1)
  await page.goto(`/admin/collections/pages/${docs[0]!.id}`)
  const frame = await enterLivePreview(page)
  await expect(frame.locator('h1')).toContainText('Visual editing for Payload')
  return frame
}

const enableEditMode = async (page: Page): Promise<void> => {
  const editToggle = page.getByRole('button', { name: 'Edit on page' })
  await expect(editToggle).toBeEnabled({ timeout: 15_000 })
  await editToggle.click()
}

// Row collapse state persists in per-user preferences across tests — normalize it
const ensureHeroRowExpanded = async (page: Page): Promise<void> => {
  await page.locator('#field-layout').waitFor()
  const heading = page.locator('#field-layout__0__heading')
  if (!(await heading.isVisible())) {
    await page.locator('#field-layout .collapsible__toggle').first().click()
    await expect(heading).toBeVisible()
  }
}

// Block ops mutate document state (autosaved drafts) — each mutating test gets
// its own page so tests stay independent and re-runnable.
const createdPageIds: string[] = []

const createTestPage = async (page: Page, slugPrefix: string): Promise<string> => {
  const slug = `${slugPrefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const response = await page.request.post('/api/pages', {
    data: {
      _status: 'published',
      layout: [
        { blockType: 'hero', heading: 'E2E hero', subheading: 'Block ops fixture' },
        { blockType: 'cta', label: 'E2E button', url: '/admin' },
      ],
      slug,
      title: `E2E ${slug}`,
    },
  })
  expect(response.ok()).toBe(true)
  const { doc } = (await response.json()) as { doc: { id: number | string } }
  createdPageIds.push(String(doc.id))
  return String(doc.id)
}

// Fixture pages would otherwise accumulate in the dev DB across runs
test.afterEach(async ({ page }) => {
  while (createdPageIds.length > 0) {
    const id = createdPageIds.pop()
    await page.request.delete(`/api/pages/${id}`).catch(() => undefined)
  }
})

const openTestPage = async (
  page: Page,
  slugPrefix = 'e2e',
): Promise<{ frame: FrameLocator; id: string }> => {
  const id = await createTestPage(page, slugPrefix)
  await page.goto(`/admin/collections/pages/${id}`)
  const frame = await enterLivePreview(page)
  await expect(frame.locator('h1')).toContainText('E2E hero')
  await enableEditMode(page)
  return { frame, id }
}

const publishedLayout = async (page: Page, id: string): Promise<string[]> => {
  const response = await page.request.get(`/api/pages/${id}?draft=false&depth=0`)
  expect(response.ok()).toBe(true)
  const { layout } = (await response.json()) as { layout: { blockType: string }[] }
  return layout.map((block) => block.blockType)
}

const hoverRowChip = async (frame: FrameLocator, rowSelector: string) => {
  await frame.locator(rowSelector).hover({ position: { x: 8, y: 8 } })
  const chip = frame.locator('[data-pve-chip]')
  await expect(chip).toBeVisible()
  return chip
}

test.describe('visual editor', () => {
  test('dev playground serves the seeded page', async ({ page }) => {
    await page.goto('/client-mode/home')
    await expect(page.locator('h1')).toContainText('Visual editing for Payload')
  })

  // M1 exit criterion (SPEC §13): hover-highlight works inside admin Live Preview
  test('hover-highlight inside admin Live Preview', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'dev@payloadcms.com')
    await enableEditMode(page)

    // Overlay mounts inside the iframe once edit mode is on
    const overlay = frame.locator('[data-pve-overlay]')
    await expect(overlay).toHaveCount(1)

    // Hovering a marked field shows the highlight box + label
    await frame.locator('[data-pve-field="layout.0.heading"]').hover()
    const hoverBox = frame.locator('[data-pve-hover-box]')
    const hoverLabel = frame.locator('[data-pve-hover-label]')
    await expect(hoverBox).toBeVisible()
    await expect(hoverLabel).toHaveText('Heading')

    // Hovering a block row (its padding, outside child fields) shows the block label
    await frame.locator('[data-pve-block-type="hero"]').hover({ position: { x: 8, y: 8 } })
    await expect(hoverLabel).toHaveText('Hero')

    // Toggling edit mode off removes the overlay
    await page.getByRole('button', { name: 'Editing on page' }).click()
    await expect(overlay).toHaveCount(0)
  })

  // M2 exit criteria (SPEC §13): select → expand/scroll/focus; reverse focus flash
  test('click-to-edit focuses the admin form field', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'dev@payloadcms.com')
    await enableEditMode(page)

    await frame.locator('[data-pve-field="layout.0.heading"]').click()
    const heading = page.locator('#field-layout__0__heading')
    await expect(heading).toBeFocused()

    // A field nested in blocks-in-arrays-in-blocks resolves too
    await frame.locator('[data-pve-field="layout.2.columns.1.content.0.label"]').click()
    await expect(page.locator('#field-layout__2__columns__1__content__0__label')).toBeFocused()
  })

  test('click-to-edit expands a collapsed block row first', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'dev@payloadcms.com')
    await enableEditMode(page)
    await ensureHeroRowExpanded(page)

    const heading = page.locator('#field-layout__0__heading')
    const heroToggle = page.locator('#field-layout .collapsible__toggle').first()
    await heroToggle.click()
    await expect(heading).toBeHidden()

    await frame.locator('[data-pve-field="layout.0.heading"]').click()
    await expect(heading).toBeVisible()
    await expect(heading).toBeFocused()
  })

  test('focusing an admin field flashes the element on the page', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'dev@payloadcms.com')
    await enableEditMode(page)
    await ensureHeroRowExpanded(page)

    await page.locator('#field-layout__0__heading').click()
    await expect(frame.locator('[data-pve-flash-box]')).toBeVisible()
  })

  // M2 exit criteria: permission gating end-to-end — read-only users get no affordances
  test('read-only user sees no edit affordances', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'viewer@payloadcms.com')
    await enableEditMode(page)

    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1)
    await frame.locator('[data-pve-field="layout.0.heading"]').hover()
    await expect(frame.locator('[data-pve-hover-box]')).toBeHidden()

    // M3: no row chips either
    await frame.locator('[data-pve-block-type="hero"]').hover({ position: { x: 8, y: 8 } })
    await expect(frame.locator('[data-pve-chip]')).toBeHidden()

    await frame.locator('[data-pve-field="layout.0.heading"]').click()
    await expect(page.locator('#field-layout__0__heading')).not.toBeFocused()
  })

  // M3 exit criteria (SPEC §13): row chips, BlocksDrawer add flow,
  // duplicate/remove, drag-reorder + drop indicators, SSR pending states
  test('chip add opens the native BlocksDrawer and inserts the picked block', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="add-below"]').click()

    // The native block picker opens in the admin panel
    const contentCard = page.locator('button.thumbnail-card', { hasText: 'Content' })
    await expect(contentCard).toBeVisible()
    await contentCard.click()

    const layoutRows = frame.locator('[data-pve-container="layout"] [data-pve-row]')
    await expect(layoutRows).toHaveCount(3)
    await expect(layoutRows.nth(1)).toHaveAttribute('data-pve-block-type', 'content')
  })

  test('chip duplicate clones the row', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="duplicate"]').click()

    const heroes = frame.locator('[data-pve-block-type="hero"]')
    await expect(heroes).toHaveCount(2)
    await expect(heroes.nth(1).locator('h1')).toHaveText('E2E hero')
  })

  test('chip remove confirms first; an emptied container gets an add affordance', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    let chip = await hoverRowChip(frame, '[data-pve-block-type="cta"]')
    await chip.locator('[data-pve-chip-action="remove"]').click()
    const confirm = page.locator('.confirmation-modal')
    await expect(confirm).toContainText('Are you sure you want to remove this Cta?')
    await confirm.getByRole('button', { name: 'Remove' }).click()
    await expect(frame.locator('[data-pve-block-type="cta"]')).toHaveCount(0)

    const layoutRows = frame.locator('[data-pve-container="layout"] [data-pve-row]')
    chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="remove"]').click()
    await page.locator('.confirmation-modal').getByRole('button', { name: 'Remove' }).click()
    await expect(layoutRows).toHaveCount(0)

    // Empty container → persistent add affordance → native picker → new row
    const addButton = frame.locator('[data-pve-empty-add]')
    await expect(addButton).toBeVisible()
    await addButton.click()
    const heroCard = page.locator('button.thumbnail-card', { hasText: 'Hero' })
    await expect(heroCard).toBeVisible()
    await heroCard.click()
    await expect(layoutRows).toHaveCount(1)
  })

  test('cancelling the remove confirmation keeps the row', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    const chip = await hoverRowChip(frame, '[data-pve-block-type="cta"]')
    await chip.locator('[data-pve-chip-action="remove"]').click()
    await page.locator('.confirmation-modal').getByRole('button', { name: 'Cancel' }).click()
    await expect(frame.locator('[data-pve-block-type="cta"]')).toHaveCount(1)
  })

  test('drag handle reorders rows with a drop indicator', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    const handle = chip.locator('[data-pve-chip-action="drag"]')
    const handleBox = (await handle.boundingBox())!
    const ctaBox = (await frame.locator('[data-pve-block-type="cta"]').boundingBox())!

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(ctaBox.x + 20, ctaBox.y + ctaBox.height - 2, { steps: 8 })
    await expect(frame.locator('[data-pve-drop-indicator]')).toBeVisible()
    await page.mouse.up()

    await expect(frame.locator('[data-pve-drop-indicator]')).toBeHidden()
    await expect(
      frame.locator('[data-pve-container="layout"] [data-pve-row]').first(),
    ).toHaveAttribute('data-pve-block-type', 'cta')
  })

  test('SSR mode shows a pending shimmer until the refreshed page lands', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    // The ssr- slug prefix routes Live Preview through /ssr-mode (RefreshRouteOnSave)
    const { frame } = await openTestPage(page, 'ssr-e2e')

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="duplicate"]').click()

    // No instant data stream in SSR mode: the shimmer bridges autosave + refresh
    await expect(frame.locator('[data-pve-pending]')).toBeVisible({ timeout: 5_000 })
    await expect(frame.locator('[data-pve-block-type="hero"]')).toHaveCount(2, { timeout: 15_000 })
    await expect(frame.locator('[data-pve-pending]')).toHaveCount(0)
  })

  // SPEC §12: save → published document correct — ops only touch the working
  // draft until the editor publishes, and publishing lands them verbatim.
  test('publishing after block ops lands them in the published document', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame, id } = await openTestPage(page, 'e2e-publish')

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="duplicate"]').click()
    await expect(frame.locator('[data-pve-block-type="hero"]')).toHaveCount(2)

    // The op autosaves to the draft; the published version is untouched
    expect(await publishedLayout(page, id)).toEqual(['hero', 'cta'])

    await page.getByRole('button', { name: 'Publish changes' }).click()
    await expect(page.locator('.payload-toast-container')).toContainText(/updated successfully/i)

    expect(await publishedLayout(page, id)).toEqual(['hero', 'hero', 'cta'])
  })
})
