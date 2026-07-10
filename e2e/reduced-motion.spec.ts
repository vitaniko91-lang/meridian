import { expect, test } from '@playwright/test'

// The reduced-motion decision happens in main.tsx at boot via
// `matchMedia('(prefers-reduced-motion: reduce)').matches` — read SYNCHRONOUSLY
// at module eval, so the emulation MUST be in effect before the first navigation
// commits. `await page.emulateMedia({ reducedMotion: 'reduce' })` awaits the CDP
// `Emulation.setEmulatedMedia` round-trip, then goto → the first matchMedia read
// already returns `reduce` and main.tsx dynamic-imports AppStatic (zero
// three/gsap/lenis bytes). Verified: mm=true, only AppStatic-*.js fetched.
//
// NOT `test.use({ reducedMotion: 'reduce' })`: in @playwright/test 1.61.1 that
// context option is created lazily and RACES the first document's synchronous
// matchMedia read — empirically the motion App still booted (mm=false), then
// its software-raster render loop starved the page into a 90s timeout. The
// explicit, awaited emulateMedia call is the deterministic mechanism. If it
// ever regresses the App chunk assertion below fails loudly.
const CHAPTER_IDS = ['instant', 'stream', 'routing', 'gate', 'prism', 'settlement', 'paid']

test.describe('reduced motion → zero-3D poster', () => {
  test('serves the static shell: no motion chunk, no canvas, full story + form', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForSelector('#paid') // AppStatic has rendered the whole story

    const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name))

    // The motion chunk (App-*.js — bundles three/gsap/lenis) must never load;
    // the static shell chunk (AppStatic-*.js) must.
    expect(loaded.some((u) => /\/App-[^/]*\.js(\?|$)/.test(u))).toBe(false)
    expect(loaded.some((u) => /\/AppStatic-[^/]*\.js(\?|$)/.test(u))).toBe(true)

    // No engine was created, no canvas exists.
    expect(await page.evaluate(() => '__meridian' in globalThis)).toBe(false)
    await expect(page.locator('canvas')).toHaveCount(0)

    // The complete narrative: every one of the seven chapters is in the DOM.
    for (const id of CHAPTER_IDS) {
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }

    // The contact form is present and immediately usable (no reveal gating here).
    await expect(page.locator('#contact form')).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
  })
})
