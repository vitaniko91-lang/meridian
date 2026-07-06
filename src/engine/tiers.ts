export type Tier = {
  backend: 'webgpu' | 'webgl2'
  count: number
  maxDpr: number
}

export type Env = { hasWebGPU: boolean; isMobile: boolean }

export function chooseTier(env: Env): Tier {
  if (env.hasWebGPU) {
    return env.isMobile
      ? { backend: 'webgpu', count: 300_000, maxDpr: 1.5 }
      : { backend: 'webgpu', count: 1_000_000, maxDpr: 2 }
  }
  return env.isMobile
    ? { backend: 'webgl2', count: 80_000, maxDpr: 1.25 }
    : { backend: 'webgl2', count: 200_000, maxDpr: 1.5 }
}

export function detectEnv(): Env {
  return {
    hasWebGPU: typeof navigator !== 'undefined' && 'gpu' in navigator,
    isMobile: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
  }
}
