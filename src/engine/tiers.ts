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
 * webgl2 beats every WebGPU config at equal counts on this machine, so webgl2 is
 * the DEFAULT regardless of WebGPU availability; the WebGPU tiers stay reachable
 * via env.preferWebGPU (`?webgpu`) for other hardware / future three versions.
 *
 * DEFAULT LOWERED 200k @ dpr1.5 (2026-07-11): the earlier 300k @ dpr2 "60/60"
 * came from a PARKED steady-state bench; scrolling through the settlement crystal
 * on a real (passively-cooled) MacBook Air only sustained ~36fps. On-device A/B
 * on the live site pinned the bottleneck to the PARTICLE COUNT, not fill-rate —
 * lowering dpr barely moved it, halving the count nearly doubled fps:
 *   300k @ dpr2   → 29    300k @ dpr1 → 30   (dpr ≈ irrelevant → not fill-bound)
 *   250k @ dpr1.5 → 38
 *   200k @ dpr1.5 → 57    ← new default (→ a solid 60 on a cool machine)
 *   150k @ dpr1.5 → 58
 * 200k is still a dense river (the additive glow fills it) and dpr1.5 stays crisp
 * on Retina. Fast machines can still opt into 1M via `?webgpu`. All numbers above
 * are from a thermally-soaked box — relative, not absolute; the ordering holds.
 */
export function chooseTier(env: Env): Tier {
  if (env.preferWebGPU && env.hasWebGPU) {
    return env.isMobile
      ? { backend: 'webgpu', count: 300_000, maxDpr: 1.5 }
      : { backend: 'webgpu', count: 1_000_000, maxDpr: 2 }
  }
  return env.isMobile
    ? { backend: 'webgl2', count: 100_000, maxDpr: 1.5 }
    : { backend: 'webgl2', count: 200_000, maxDpr: 1.5 }
}

export function detectEnv(): Env {
  return {
    hasWebGPU: typeof navigator !== 'undefined' && 'gpu' in navigator,
    isMobile: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
    preferWebGPU: false,
  }
}
