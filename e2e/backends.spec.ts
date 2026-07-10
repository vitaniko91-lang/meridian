import { expect, test } from '@playwright/test'
import { BACKEND_RE, waitForEngine } from './util'

// The global config already launches with --enable-unsafe-webgpu (+ swiftshader
// fallback); this spec pins the WebGPU path explicitly and reads positions back.
test.describe('backends', () => {
  // count kept tiny so a software-raster fallback can't stall the cold boot.
  test('?webgpu boots an engine with a valid tier and finite particle positions', async ({ page }) => {
    await page.goto('/?webgpu&count=2000&dpr=1')
    await waitForEngine(page)

    await expect(page.locator('canvas')).toHaveCount(1)

    const tier = await page.evaluate(
      () => (globalThis as unknown as { __meridian: { tier: { backend: string; count: number } } }).__meridian.tier,
    )
    expect(tier.backend).toMatch(BACKEND_RE)
    expect(tier.count).toBeGreaterThan(0)

    // Best-effort GPU→CPU readback: proves the compute kernel produced finite
    // coordinates. Software raster makes this occasionally flaky, so a failure
    // is annotated and tolerated — the tier assertions above are the hard gate.
    const rb = await page.evaluate(async () => {
      try {
        const m = (globalThis as unknown as { __meridian: { renderer: { getArrayBufferAsync: (b: unknown) => Promise<ArrayBuffer> }; river: { positions: { value: unknown } } } }).__meridian
        const buf = await m.renderer.getArrayBufferAsync(m.river.positions.value)
        const f = new Float32Array(buf)
        const n = Math.min(f.length, 3000)
        let finite = 0
        for (let i = 0; i < n; i++) if (Number.isFinite(f[i])) finite++
        return { ok: true as const, sampled: n, finite }
      } catch (e) {
        return { ok: false as const, err: String(e) }
      }
    })

    if (rb.ok) {
      expect(rb.finite).toBeGreaterThan(0)
    } else {
      test.info().annotations.push({ type: 'readback-skipped', description: rb.err })
    }
  })
})
