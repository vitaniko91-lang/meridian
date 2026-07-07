/**
 * Dev tuning overrides for acceptance runs, parsed once from the query string.
 * Pure — no window access — so it stays unit-testable.
 *
 *   ?count=300000  → overrides tier.count (positive integer)
 *   ?dpr=1.5       → overrides tier.maxDpr (positive number)
 *   ?webgl         → forces hasWebGPU=false (real WebGL2 fallback path)
 *   ?webgpu        → preferWebGPU=true, opts into the WebGPU tiers
 *                    (precedence: ?webgl wins over ?webgpu)
 *   ?scale=0.5     → sets the sprite scale multiplier uniform
 *   ?alpha=0.4     → sets the sprite alpha multiplier uniform
 *
 * Garbage values (NaN, non-positive) are ignored — the field stays undefined
 * and the engine keeps its tuned defaults (uScale 0.6 / uAlpha 0.5).
 */
export type Overrides = {
  count?: number
  dpr?: number
  forceWebGL: boolean
  preferWebGPU: boolean
  scale?: number
  alpha?: number
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
  const forceWebGL = params.has('webgl')
  return {
    count: count === undefined ? undefined : Math.floor(count),
    dpr: positiveNumber(params, 'dpr'),
    forceWebGL,
    preferWebGPU: params.has('webgpu') && !forceWebGL,
    scale: positiveNumber(params, 'scale'),
    alpha: positiveNumber(params, 'alpha'),
  }
}
