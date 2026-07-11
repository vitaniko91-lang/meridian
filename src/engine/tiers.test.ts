import { describe, it, expect } from 'vitest'
import { chooseTier } from './tiers'

// Truth table per 2026-07-07 bench verdict: webgl2-first regardless of
// hasWebGPU; webgpu tiers only via explicit preferWebGPU opt-in.
describe('chooseTier', () => {
  it('defaults desktop to webgl2 200k even when WebGPU is available', () => {
    expect(chooseTier({ hasWebGPU: true, isMobile: false })).toEqual({
      backend: 'webgl2', count: 200_000, maxDpr: 1.5,
    })
  })
  it('defaults desktop to webgl2 200k without WebGPU', () => {
    expect(chooseTier({ hasWebGPU: false, isMobile: false })).toEqual({
      backend: 'webgl2', count: 200_000, maxDpr: 1.5,
    })
  })
  it('defaults mobile to webgl2 100k even when WebGPU is available', () => {
    expect(chooseTier({ hasWebGPU: true, isMobile: true })).toEqual({
      backend: 'webgl2', count: 100_000, maxDpr: 1.5,
    })
  })
  it('defaults mobile to webgl2 100k without WebGPU', () => {
    expect(chooseTier({ hasWebGPU: false, isMobile: true })).toEqual({
      backend: 'webgl2', count: 100_000, maxDpr: 1.5,
    })
  })
  it('preferWebGPU opts desktop into the webgpu 1M tier (only if WebGPU exists)', () => {
    expect(chooseTier({ hasWebGPU: true, isMobile: false, preferWebGPU: true })).toEqual({
      backend: 'webgpu', count: 1_000_000, maxDpr: 2,
    })
    // preferWebGPU without actual WebGPU support falls back to the webgl2 default
    expect(chooseTier({ hasWebGPU: false, isMobile: false, preferWebGPU: true })).toEqual({
      backend: 'webgl2', count: 200_000, maxDpr: 1.5,
    })
  })
  it('preferWebGPU opts mobile into the webgpu 300k tier', () => {
    expect(chooseTier({ hasWebGPU: true, isMobile: true, preferWebGPU: true })).toEqual({
      backend: 'webgpu', count: 300_000, maxDpr: 1.5,
    })
  })
})
