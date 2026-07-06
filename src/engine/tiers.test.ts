import { describe, it, expect } from 'vitest'
import { chooseTier } from './tiers'

describe('chooseTier', () => {
  it('gives webgpu desktop the full river', () => {
    expect(chooseTier({ hasWebGPU: true, isMobile: false })).toEqual({
      backend: 'webgpu', count: 1_000_000, maxDpr: 2,
    })
  })
  it('caps webgl2 desktop at 200k', () => {
    expect(chooseTier({ hasWebGPU: false, isMobile: false })).toEqual({
      backend: 'webgl2', count: 200_000, maxDpr: 1.5,
    })
  })
  it('reduces count and caps dpr on webgpu mobile', () => {
    expect(chooseTier({ hasWebGPU: true, isMobile: true })).toEqual({
      backend: 'webgpu', count: 300_000, maxDpr: 1.5,
    })
  })
  it('reduces count and caps dpr on webgl2 mobile', () => {
    expect(chooseTier({ hasWebGPU: false, isMobile: true })).toEqual({
      backend: 'webgl2', count: 80_000, maxDpr: 1.25,
    })
  })
})
