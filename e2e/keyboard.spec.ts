import { expect, test, type Page } from '@playwright/test'
import { APP_URL, waitForEngine } from './util'

/** A stable signature for whatever element currently holds focus. */
async function focusSig(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    if (el.id) return `#${el.id}`
    const tag = el.tagName.toLowerCase()
    if (tag === 'a') return `a:${el.getAttribute('href')}`
    if (tag === 'button') return `button:${(el.textContent ?? '').trim().slice(0, 20)}`
    return tag
  })
}

test.describe('keyboard access', () => {
  test('the skip link is first in the tab order and shows a visible focus ring', async ({ page }) => {
    await page.goto(APP_URL)
    await waitForEngine(page)

    // From a fresh document, the very first Tab must land on the skip link.
    await page.keyboard.press('Tab')
    expect(await focusSig(page)).toBe('a:#main')
    await expect(page.locator('a[href="#main"]')).toBeFocused()

    // Keyboard focus → :focus-visible → a real, non-removed outline.
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element)
      return { style: s.outlineStyle, width: s.outlineWidth }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).not.toBe('0px')
  })

  test('every interactive element is reachable by Tab (no positive-tabindex trap)', async ({ page }) => {
    await page.goto(APP_URL)
    await waitForEngine(page)

    const reached = new Set<string>()
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      const sig = await focusSig(page)
      if (sig) reached.add(sig)
    }
    const list = [...reached]

    // The whole interactive surface: skip link, header CTA, all three form
    // fields, the submit button.
    for (const sig of ['a:#main', 'a:#contact', '#contact-name', '#contact-email', '#contact-message']) {
      expect(list, `Tab never reached ${sig}`).toContain(sig)
    }
    expect(list.some((s) => s.startsWith('button:Talk')), 'submit button never reached').toBe(true)
    // …and at least one external footer link.
    expect(
      list.some((s) => s.startsWith('a:https') || s.startsWith('a:mailto')),
      'no footer link reached',
    ).toBe(true)
  })
})
