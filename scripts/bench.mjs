// Unattended fps benchmark: drives real Chrome with background throttling
// disabled, so measurements don't depend on window focus.
// Usage: run against a PRODUCTION preview on :5199 — `npm run build && npm run
// bench:serve`, then `node scripts/bench.mjs`. NEVER bench the dev server: its
// StrictMode double-mount path is what contaminated the original numbers.
import { chromium } from 'playwright-core'

const BASE = 'http://localhost:5199/'
// The honest matrix behind the webgl2-first verdict in src/engine/tiers.ts
// (re-bench 2026-07-07 on the production preview build; run against a
// production `vite preview` — the dev-server StrictMode path was the source
// of the original contaminated numbers).
const CONFIGS = [
  '', // default tier: webgl2 300k @ dpr2
  '?count=500000', // webgl2 500k
  '?webgpu', // webgpu default tier: 1M
  '?webgpu&count=500000', // webgpu 500k
  '?webgpu&count=300000', // webgpu 300k
]

const WARMUP_MS = 3000
const MEASURE_MS = 6000

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--window-size=900,650',
    '--window-position=40,40',
  ],
})

const page = await browser.newPage({ viewport: { width: 880, height: 600 } })
const results = []

for (const cfg of CONFIGS) {
  await page.goto(BASE + cfg, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!globalThis.__meridian, null, { timeout: 20000 })
  await page.waitForTimeout(WARMUP_MS)
  const r = await page.evaluate(
    (ms) =>
      new Promise((res) => {
        let frames = 0
        const t0 = performance.now()
        const buckets = []
        let bStart = t0
        let bFrames = 0
        const tick = (t) => {
          frames++
          bFrames++
          if (t - bStart >= 1000) {
            buckets.push(bFrames)
            bFrames = 0
            bStart = t
          }
          if (t - t0 < ms) requestAnimationFrame(tick)
          else
            res({
              avg: Math.round((frames * 1000) / (t - t0)),
              min1s: buckets.length ? Math.min(...buckets) : 0,
            })
        }
        requestAnimationFrame(tick)
      }),
    MEASURE_MS,
  )
  const backend = await page.evaluate(() => globalThis.__meridian.tier.backend)
  const count = await page.evaluate(() => globalThis.__meridian.tier.count)
  results.push({ cfg, backend, count, ...r })
  console.log(JSON.stringify(results.at(-1)))
}

await browser.close()
console.log('\n=== BENCH RESULTS ===')
console.table(results)
