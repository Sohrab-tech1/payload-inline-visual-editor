import { expect, test } from '@playwright/test'

// E2E flows land with M1+ (SPEC §12): toggle edit mode, hover-highlight,
// select → field focus, block ops, permission gating — driving dev/ via
// frameLocator on the Live Preview iframe. Until then: a smoke check only.
test.describe('visual editor', () => {
  test('dev playground serves the seeded page', async ({ page }) => {
    await page.goto('/client-mode/home')
    await expect(page.locator('h1')).toContainText('Visual editing for Payload')
  })
})
