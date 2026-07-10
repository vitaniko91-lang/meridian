import { expect, test, type Page } from '@playwright/test'
import { APP_URL, sectionEntered, waitForEngine, wheelUntil } from './util'

const VALID = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'We settle in milliseconds — let us build on Meridian.',
}

/** Scroll the contact section into view, let the masked reveal finish, and
 *  bring the submit button fully on-screen (post-reveal geometry is accurate). */
async function revealForm(page: Page) {
  await waitForEngine(page)
  await wheelUntil(page, () => sectionEntered(page, 'contact'))
  await page.waitForTimeout(1000) // 600ms masked reveal + line stagger
  const submit = page.getByRole('button', { name: /talk to us|sending/i })
  await wheelUntil(
    page,
    async () => {
      const box = await submit.boundingBox()
      if (!box) return false
      const vh = page.viewportSize()!.height
      return box.y >= 0 && box.y + box.height <= vh
    },
    { step: 300, settle: 120, maxTicks: 40 },
  )
  return submit
}

async function fillValid(page: Page) {
  await page.locator('#contact-name').fill(VALID.name)
  await page.locator('#contact-email').fill(VALID.email)
  await page.locator('#contact-message').fill(VALID.message)
}

test.describe('contact form', () => {
  test('empty submit shows three inline errors and focuses the first invalid field', async ({ page }) => {
    await page.goto(APP_URL)
    const submit = await revealForm(page)

    await submit.click()

    await expect(page.locator('#contact-name-err')).toBeVisible()
    await expect(page.locator('#contact-email-err')).toBeVisible()
    await expect(page.locator('#contact-message-err')).toBeVisible()
    await expect(page.locator('[id$="-err"]')).toHaveCount(3) // exactly three, no more

    // Focus jumps to the first invalid field.
    await expect(page.locator('#contact-name')).toBeFocused()
  })

  test('success is shown only after a real 2xx, and focus moves to the confirmation', async ({ page }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    )
    await page.goto(APP_URL)
    const submit = await revealForm(page)

    await fillValid(page)
    await submit.click()

    await expect(page.getByText('Message sent — we read everything.')).toBeVisible()
    // The form itself is gone; focus is parked on the aria-live confirmation.
    await expect(page.locator('#contact form')).toHaveCount(0)
    await expect(page.locator('[aria-live="polite"]')).toBeFocused()
  })

  test('a 5xx shows the honest failure message and never a success', async ({ page }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }),
    )
    await page.goto(APP_URL)
    const submit = await revealForm(page)

    await fillValid(page)
    await submit.click()

    await expect(page.getByText('Something went wrong on our side — email us instead.')).toBeVisible()
    await expect(page.getByText('Message sent — we read everything.')).toHaveCount(0)
    // The form stays mounted so the user can retry.
    await expect(page.locator('#contact form')).toBeVisible()
  })
})
