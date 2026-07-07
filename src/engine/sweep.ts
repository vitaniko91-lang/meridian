/**
 * Self-driving fps sweep instrument (dev-only).
 *
 * Dynamically imported by engine.ts ONLY when location.search contains 'sweep'
 * — zero cost otherwise. Sweep configs ride on the existing query-param
 * overrides (?count= ?dpr= ?webgl ?scale= ?alpha=).
 *
 * Arm it:
 *   localStorage.meridianQueue = JSON.stringify([
 *     '?sweep&count=250000&dpr=1.5',
 *     '?sweep&webgl&count=150000&dpr=1.5',
 *   ])
 *   location.assign(location.pathname + JSON.parse(localStorage.meridianQueue)[0])
 *
 * Each page: waits until the tab is visible, warms up 2.5s, measures 6s via
 * requestAnimationFrame, appends {config, backend, count, avg, min1s, at} to
 * localStorage.meridianResults, then navigates to the next queue entry.
 * If the tab goes hidden mid-measure the sample is discarded and the
 * measurement re-arms on the next visibilitychange→visible (idempotent).
 */

const QUEUE_KEY = 'meridianQueue'
const RESULTS_KEY = 'meridianResults'
const WARMUP_MS = 2500
const MEASURE_MS = 6000

export type SweepResult = {
  config: string
  backend: 'webgpu' | 'webgl2'
  count: number
  avg: number
  min1s: number
  at: string
}

/**
 * Where to go after measuring `current`:
 * found → next entry; found at end → null (complete);
 * not found → first entry (recovery: ad-hoc config joins the queue's start);
 * empty queue → null.
 */
export function nextInQueue(current: string, queue: string[]): string | null {
  if (queue.length === 0) return null
  const i = queue.indexOf(current)
  if (i === -1) return queue[0]
  return queue[i + 1] ?? null
}

function readQueue(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === 'string') : []
  } catch {
    return []
  }
}

function appendResult(result: SweepResult): void {
  let results: unknown[] = []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '[]')
    if (Array.isArray(parsed)) results = parsed
  } catch {
    /* corrupted store — start fresh */
  }
  results.push(result)
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results))
}

let started = false // module singleton: guards StrictMode double-mount

export function startSweep(tier: { backend: 'webgpu' | 'webgl2'; count: number }): void {
  if (started) return
  started = true

  const overlay = document.createElement('div')
  overlay.style.cssText =
    'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;' +
    'background:rgba(0,0,0,0.85);color:#E8C275;font:12px monospace;' +
    'padding:4px 12px;border-radius:4px;pointer-events:none'
  document.body.append(overlay)

  const queue = readQueue()
  const current = location.search
  const idx = queue.indexOf(current)
  const label = `${idx === -1 ? '?' : idx + 1}/${queue.length}`
  const setStatus = (text: string) => {
    overlay.textContent = `sweep ${label} · ${text}`
  }

  let measuring = false

  const arm = () => {
    if (measuring || document.hidden) return
    measuring = true

    const warmupStart = performance.now()
    let measureStart = -1
    let frames = 0
    let bucketFrames = 0
    let bucketStart = 0
    let minBucket = Infinity

    const loop = () => {
      // Tab hidden mid-run: discard the sample, re-arm on next visible.
      if (document.hidden) {
        measuring = false
        setStatus('paused (tab hidden) — will restart when visible')
        return
      }
      const now = performance.now()

      if (measureStart < 0) {
        // warmup phase
        setStatus('warmup…')
        if (now - warmupStart >= WARMUP_MS) {
          measureStart = now
          bucketStart = now
          setStatus('measuring…')
        }
        requestAnimationFrame(loop)
        return
      }

      frames++
      bucketFrames++
      if (now - bucketStart >= 1000) {
        minBucket = Math.min(minBucket, (bucketFrames * 1000) / (now - bucketStart))
        bucketFrames = 0
        bucketStart = now
      }

      if (now - measureStart >= MEASURE_MS) {
        const avg = (frames * 1000) / (now - measureStart)
        finish(avg, minBucket === Infinity ? avg : minBucket)
        return
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  const finish = (avg: number, min1s: number) => {
    appendResult({
      config: current,
      backend: tier.backend,
      count: tier.count,
      avg: Math.round(avg * 10) / 10,
      min1s: Math.round(min1s * 10) / 10,
      at: new Date().toISOString(),
    })
    const next = nextInQueue(current, queue)
    if (next !== null) {
      setStatus(`done (avg ${Math.round(avg)}) → next`)
      location.assign(location.pathname + next)
    } else {
      overlay.textContent = 'SWEEP COMPLETE ✓ — можно закрывать'
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) arm()
  })
  arm()
  if (document.hidden) setStatus('waiting for tab focus…')
}
