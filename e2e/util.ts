import { type Page } from '@playwright/test'

/** The engine's tier.backend (and the backend label) is always one of these. */
export const BACKEND_RE = /^(webgl2|webgpu)$/

/**
 * Motion app URL for the e2e suite. `?webgpu` selects the hardware Metal-backed
 * WebGPU renderer — headless Chromium's default webgl2 tier falls back to
 * SwiftShader, whose software-raster render loop starves Playwright's own
 * in-page queries (`Received: undefined` → test timeout). A small count + dpr=1
 * keep boot brisk. NONE of this changes behaviour under test: the DOM, scroll
 * narrative, form, and focus order are backend-independent; fps/perf and the
 * default-tier selection are covered elsewhere (bench-*.mjs, tiers.test.ts).
 */
export const APP_URL = '/?webgpu&count=2000&dpr=1'

type MeridianGlobal = { __meridian?: { tier: { backend: string; count: number } } }

/** Boot the motion app and wait for the engine to publish `__meridian`. */
export async function waitForEngine(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(globalThis as unknown as MeridianGlobal).__meridian, null, {
    timeout: 45_000,
  })
}

/**
 * Drive real wheel events (so the whole Lenis → ScrollTrigger → narrative chain
 * runs exactly as a visitor's does — a single `scrollTo` can't move the
 * Lenis-smoothed page), polling `done()` between ticks until it is true.
 */
export async function wheelUntil(
  page: Page,
  done: () => Promise<boolean>,
  { step = 1600, maxTicks = 90, settle = 110 }: { step?: number; maxTicks?: number; settle?: number } = {},
): Promise<void> {
  const vp = page.viewportSize()!
  await page.mouse.move(vp.width / 2, vp.height / 2)
  for (let i = 0; i < maxTicks; i++) {
    if (await done()) return
    await page.mouse.wheel(0, step)
    await page.waitForTimeout(settle)
  }
  if (!(await done())) throw new Error('wheelUntil: condition never met within maxTicks')
}

/** True once the top of `#<id>` has entered the upper half of the viewport. */
export async function sectionEntered(page: Page, id: string): Promise<boolean> {
  const box = await page.locator(`#${id}`).boundingBox()
  if (!box) return false
  return box.y < page.viewportSize()!.height * 0.5
}
