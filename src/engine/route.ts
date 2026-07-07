import * as THREE from 'three/webgpu'

/**
 * The narrative route: a CatmullRom spline sampled into 256 equally-spaced
 * points that the particle update kernel reads as a `uniformArray` (UBO).
 *
 * Why not a DataTexture: a uniform array is backend-agnostic by construction —
 * std140 UBO on the WebGL2 transform-feedback path, uniform buffer on WebGPU —
 * with no sampler, no float-filtering features (float32-filterable /
 * OES_texture_float_linear) and no texture-in-compute question at all.
 * Numerically verified on BOTH backends 2026-07-07 (position readback via
 * renderer.getArrayBufferAsync: finite, on-route, full spread).
 *
 * CPU side keeps the curve for the camera rail (`curve.getPointAt`); GPU side
 * reads the same route from `points` — both views stay in sync by construction.
 */
export const ROUTE_SAMPLES = 256

export type Route = {
  curve: THREE.CatmullRomCurve3
  /** ROUTE_SAMPLES equally-spaced points; index i ↔ u = i / (ROUTE_SAMPLES - 1). */
  points: THREE.Vector3[]
}

// Placeholder spike route: a sweeping S-curve. Plan 3 replaces control
// points with the real 7-chapter route.
export function createRoute(): Route {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-24, 0, 0),
    new THREE.Vector3(-8, 3, -4),
    new THREE.Vector3(6, -2, 3),
    new THREE.Vector3(24, 1, 0),
  ])
  const points = curve.getSpacedPoints(ROUTE_SAMPLES - 1)
  return { curve, points }
}
