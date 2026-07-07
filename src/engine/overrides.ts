/**
 * Dev tuning overrides for acceptance runs, parsed once from the query string.
 * Pure — no window access — so it stays unit-testable.
 *
 *   ?count=300000  → overrides tier.count (positive integer)
 *   ?dpr=1.5       → overrides tier.maxDpr (positive number)
 *   ?webgl         → forces hasWebGPU=false (real WebGL2 fallback path)
 *   ?scale=0.5     → sprite scale multiplier, default 1
 *   ?alpha=0.4     → sprite alpha multiplier, default 1
 *
 * Garbage values (NaN, non-positive) are ignored: count/dpr stay undefined,
 * scale/alpha fall back to 1.
 */
export type Overrides = {
  count?: number
  dpr?: number
  forceWebGL: boolean
  scale: number
  alpha: number
}

function positiveNumber(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key)
  if (raw === null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function parseOverrides(search: string): Overrides {
  const params = new URLSearchParams(search)
  const count = positiveNumber(params, 'count')
  return {
    count: count === undefined ? undefined : Math.floor(count),
    dpr: positiveNumber(params, 'dpr'),
    forceWebGL: params.has('webgl'),
    scale: positiveNumber(params, 'scale') ?? 1,
    alpha: positiveNumber(params, 'alpha') ?? 1,
  }
}
