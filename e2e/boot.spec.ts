import { expect, test } from '@playwright/test'
import { APP_URL, BACKEND_RE, waitForEngine } from './util'

test.describe('boot', () => {
  test('the motion app boots: canvas, engine, landmarks, single h1', async ({ page }) => {
    await page.goto(APP_URL)
    await waitForEngine(page)

    // Exactly one canvas, and the engine's global handle is published.
    await expect(page.locator('canvas')).toHaveCount(1)
    const tier = await page.evaluate(
      () => (globalThis as unknown as { __meridian: { tier: { backend: string; count: number } } }).__meridian.tier,
    )
    expect(tier.backend).toMatch(BACKEND_RE)
    expect(tier.count).toBeGreaterThan(0)

    // Backend label lives in the DOM (hidden decoration unless ?debug) and
    // reflects the resolved backend once the engine settles.
    await expect
      .poll(async () => (await page.getByTestId('backend').textContent())?.trim())
      .toMatch(BACKEND_RE)

    // Landmarks + a single, unambiguous document heading.
    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.locator('main#main')).toHaveCount(1)
    await expect(page.locator('footer')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toContainText('0.4 seconds')
  })

  test('the dev HUD is not shown in the default view', async ({ page }) => {
    await page.goto(APP_URL)
    await waitForEngine(page)
    // Present in the DOM (engine writes to it) but hidden from layout + AT.
    await expect(page.getByTestId('backend')).toBeHidden()
  })
})
