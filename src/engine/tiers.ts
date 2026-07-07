export type Tier = {
  backend: 'webgpu' | 'webgl2'
  count: number
  maxDpr: number
}

export type Env = {
  hasWebGPU: boolean
  isMobile: boolean
  /** Opt back into the WebGPU tiers (`?webgpu` dev override). Default false. */
  preferWebGPU?: boolean
}

/**
 * WEBGL2-FIRST — measured verdict, not a fallback.
 *
 * Bench 2026-07-07 (MacBook Air, unattended playwright-core run, scripts/bench.mjs,
 * background throttling disabled; avg fps / min 1s-bucket over 6s after 3s warmup):
 *
 *   webgl2  500k @ dpr1.5 → 60 / 58
 *   webgl2  300k @ dpr2   → 60 / 60
 *   webgl2  200k @ dpr1.5 → 59 / 58
 *   webgpu   50k          → 60        (cliffs at 100k → 41 fps)
 *   webgpu  300k          → 38        (barely count-sensitive → ~fixed per-frame overhead)
 *
 * three r185's WebGPU backend carries a large fixed per-frame cost on this
 * machine while the WebGL2 path sustains 60fps at 500k. So webgl2 is the
 * DEFAULT regardless of WebGPU availability; the old WebGPU tiers stay
 * reachable via env.preferWebGPU (`?webgpu`) for re-benching on other
 * hardware / future three versions.
 */
export function chooseTier(env: Env): Tier {
  if (env.preferWebGPU && env.hasWebGPU) {
    return env.isMobile
      ? { backend: 'webgpu', count: 300_000, maxDpr: 1.5 }
      : { backend: 'webgpu', count: 1_000_000, maxDpr: 2 }
  }
  return env.isMobile
    ? { backend: 'webgl2', count: 100_000, maxDpr: 1.5 }
    : { backend: 'webgl2', count: 300_000, maxDpr: 2 }
}

export function detectEnv(): Env {
  return {
    hasWebGPU: typeof navigator !== 'undefined' && 'gpu' in navigator,
    isMobile: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
    preferWebGPU: false,
  }
}
