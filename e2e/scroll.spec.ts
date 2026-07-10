import { expect, test } from '@playwright/test'
import { APP_URL, sectionEntered, waitForEngine, wheelUntil } from './util'

test.describe('scroll → narrative', () => {
  test('the clock runs 0.000s → 0.400s and chapters reveal on the way down', async ({ page }) => {
    await page.goto(APP_URL)
    await waitForEngine(page)

    const timer = page.getByTestId('timer')

    // The narrative clock starts parked at the first instant.
    await expect(timer).toHaveText('t = 0.000s')

    // Scroll to a mid-journey chapter and confirm its headline is on screen.
    await wheelUntil(page, () => sectionEntered(page, 'prism'))
    await expect(page.locator('#prism-h')).toBeInViewport()
    await expect(page.locator('#prism-h')).toContainText('wavelength')

    // A second chapter, further along.
    await wheelUntil(page, () => sectionEntered(page, 'settlement'))
    await expect(page.locator('#settlement-h')).toBeInViewport()
    await expect(page.locator('#settlement-h')).toContainText('crystal')

    // At the bottom the whole 0.4s has elapsed — the clock reads its finale.
    await wheelUntil(page, async () => (await timer.textContent()) === 't = 0.400s', { step: 2400 })
    await expect(timer).toHaveText('t = 0.400s')
  })
})
