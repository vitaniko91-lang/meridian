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
 * Re-bench 2026-07-07 on the PRODUCTION preview build, post-d836f13 — the
 * original same-day bench was INVALIDATED by the StrictMode context-loss bug
 * (it measured rAF on a device-lost white canvas); the webgl2-first
 * conclusion survived honest re-measurement with real rendering verified on
 * both backends. (MacBook Air, unattended playwright-core run,
 * scripts/bench.mjs, background throttling disabled; avg fps / min 1s-bucket
 * over 6s after 3s warmup):
 *
 *   webgl2  300k @ dpr2 → 60 / 60   (the default tier)
 *   webgl2  500k        → 31 / 26
 *   webgpu  300k        → 40 / 35
 *   webgpu  500k        → 28 / 25
 *   webgpu    1M        → 14 / 13
 *
 * The default webgl2 tier holds 60fps while every WebGPU config trails it at
 * equal counts on this machine. So webgl2 is the DEFAULT regardless of WebGPU
 * availability; the WebGPU tiers stay reachable via env.preferWebGPU
 * (`?webgpu`) for re-benching on other hardware / future three versions.
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
