import type { FrameLocator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

const openHomePageInLivePreview = async (page: Page, email: string): Promise<FrameLocator> => {
  await page.goto('/admin/login')
  await page.fill('#field-email', email)
  await page.fill('#field-password', 'test')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin')

  await page.goto('/admin/collections/pages')
  await page.getByRole('link', { name: 'Home' }).first().click()
  await page.waitForURL('**/admin/collections/pages/**')

  // Enter Live Preview (stock toggler) unless a saved preference already enabled it
  const toggler = page.locator('#live-preview-toggler')
  await toggler.waitFor()
  await page.waitForLoadState('networkidle')
  const isPreviewing = await toggler.evaluate((el) => el.classList.contains('live-preview-toggler--active'))
  if (!isPreviewing) {
    await toggler.click()
  }
  const frame = page.frameLocator('iframe#live-preview-iframe')
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

    await frame.locator('[data-pve-field="layout.0.heading"]').click()
    await expect(page.locator('#field-layout__0__heading')).not.toBeFocused()
  })
})
