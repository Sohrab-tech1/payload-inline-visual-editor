import { expect, test } from '@playwright/test'

test.describe('visual editor', () => {
  test('dev playground serves the seeded page', async ({ page }) => {
    await page.goto('/client-mode/home')
    await expect(page.locator('h1')).toContainText('Visual editing for Payload')
  })

  // M1 exit criterion (SPEC §13): hover-highlight works inside admin Live Preview
  test('hover-highlight inside admin Live Preview', async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('#field-email', 'dev@payloadcms.com')
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

    const editToggle = page.getByRole('button', { name: 'Edit on page' })
    await expect(editToggle).toBeEnabled({ timeout: 15_000 })
    await editToggle.click()

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
})
