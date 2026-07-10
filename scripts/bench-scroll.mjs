// Scroll-motion fps benchmark — the moving-camera complement to bench.mjs.
//
// bench.mjs measures STEADY-STATE fps (camera parked, river advecting). This
// script measures fps WHILE the narrative is scrubbed top→bottom, so the
// compute kernel + camera rail + crystallization ramp + prism/gate windows are
// all in flight — the true worst case a visitor feels.
//
// ── COLD PROTOCOL (read before trusting a number) ──────────────────────────
// The river is GPU-bound; on a fanless MacBook Air the number is dominated by
// die temperature and host CPU load, NOT by code. A trustworthy scroll-fps
// reading requires:
//   1. Machine idle ≥10 min beforehand (no build/bench/CI churn — the SoC must
//      cool; a heat-soaked Air reads 30-45fps on the SAME code that does 60
//      cold).
//   2. NO other Chrome/browser/preview/bench running first. Quit them. `top`
//      should show the machine near-idle (load avg < ~3) before you start.
//   3. A SINGLE run. Back-to-back runs heat-soak and each reads lower than the
//      last — that decay is thermal, not a regression.
//   4. Production preview build only (`npm run build && vite preview`), never
//      the dev server (its StrictMode double-mount contaminated Plan-1 numbers).
//
// If you cannot satisfy 1-2 (e.g. this dev box is mid-session, load avg high),
// the number is THERMALLY/LOAD LIMITED — report it, label it clearly, and note
// that the real cold-hardware number must be captured on a fresh machine before
// any Awwwards submission. A low number here is NOT evidence of a perf bug
// unless the idle (bench.mjs) number is ALSO low on the same cold box.
//
// Usage:
//   npm run build
//   vite preview --port 5202 --strictPort   (or reuse an existing preview)
//   node scripts/bench-scroll.mjs            (defaults to :5202)
//   BENCH_URL=http://localhost:5199/ node scripts/bench-scroll.mjs   (override)
import { chromium } from 'playwright-core'

const BASE = process.env.BENCH_URL ?? 'http://localhost:5202/'
const WARMUP_MS = 3000
const SCROLL_MS = 30_000 // sweep top→bottom over ~30s
const WHEEL_INTERVAL_MS = 32 // ~31 wheel ticks/s — a brisk-but-real read scroll

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => !!globalThis.__meridian, null, { timeout: 20000 })
const tier = await page.evaluate(() => globalThis.__meridian.tier)
await page.waitForTimeout(WARMUP_MS)

// Total scrollable distance. Lenis eases the wheel and, at low fps, integrates
// fewer ticks — so a fixed wheel rate under-scrolls (empirically ~50% at 25fps).
// The drive loop below is therefore CLOSED-LOOP: it polls scrollY a few times a
// second and re-aims the per-tick delta at "reach the bottom exactly as the
// window closes", self-correcting for however slow the box is. Polling is kept
// sparse (~2/s) so the extra main-thread round-trips don't perturb the sample.
const maxScroll = await page.evaluate(
  () => document.documentElement.scrollHeight - innerHeight,
)

// In-page rAF sampler → 1s buckets, running concurrently with the wheel drive.
const sampler = page.evaluate(
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
        else {
          const sorted = [...buckets].sort((a, b) => a - b)
          res({
            avg: Math.round((frames * 1000) / (t - t0)),
            p5: sorted.length ? sorted[Math.floor(sorted.length * 0.05)] : 0,
            min1s: sorted.length ? sorted[0] : 0,
            buckets,
          })
        }
      }
      requestAnimationFrame(tick)
    }),
  SCROLL_MS,
)

// Drive real (trusted) wheel events so the whole Lenis→ScrollTrigger→narrative
// chain runs exactly as it does for a visitor — dispatching from Node while the
// in-page sampler above is pending. Closed-loop: re-aim the delta at the bottom
// on a sparse scrollY poll so the sweep completes regardless of frame rate.
const driveStart = Date.now()
await page.mouse.move(440, 300)
let y = 0
let lastPoll = 0
while (Date.now() - driveStart < SCROLL_MS) {
  const now = Date.now()
  if (now - lastPoll > 450) {
    y = await page.evaluate(() => scrollY) // sparse: ~2 polls/s
    lastPoll = now
  }
  const remainingMs = Math.max(SCROLL_MS - (now - driveStart), 500)
  const remainingPx = Math.max(maxScroll - y, 0)
  // px to cover per WHEEL_INTERVAL tick, 1.3× over-driven so Lenis (which lags
  // and clamps at the bottom) actually arrives; floored so motion never stalls.
  const step = Math.max(Math.ceil((remainingPx / (remainingMs / WHEEL_INTERVAL_MS)) * 1.3), 6)
  await page.mouse.wheel(0, step)
  y += step // dead-reckon between polls
  await sleep(WHEEL_INTERVAL_MS)
}

const r = await sampler
const scrolled = await page.evaluate(() => ({
  y: Math.round(scrollY),
  end: Math.round(document.documentElement.scrollHeight - innerHeight),
  t: globalThis.__meridian?.river?.uT?.value ?? null,
}))
await browser.close()

const reachedPct = Math.round((scrolled.y / scrolled.end) * 100)
console.log('\n=== SCROLL BENCH ===')
console.log(`tier: ${tier.backend} ${tier.count} @ dpr${tier.maxDpr}`)
console.log(`reached: ${reachedPct}% of page (scrollY ${scrolled.y}/${scrolled.end}, narrative uT ${scrolled.t?.toFixed(3)})`)
console.log(`avg ${r.avg} · p5 ${r.p5} · min1s ${r.min1s} fps  (over ${SCROLL_MS / 1000}s, ${r.buckets.length} buckets)`)
console.log(`buckets: [${r.buckets.join(' ')}]`)
