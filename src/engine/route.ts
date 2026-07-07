import * as THREE from 'three/webgpu'

/**
 * The narrative route: a CatmullRom spline sampled into a 256×1 float texture
 * so the particle update kernel can steer toward it with a single texture tap.
 *
 * CPU side keeps the curve for the camera rail (`curve.getPointAt`); GPU side
 * reads the same route from `tex` — both views stay in sync by construction.
 */
export const ROUTE_SAMPLES = 256

export type Route = {
  curve: THREE.CatmullRomCurve3
  /** 256×1 RGBA float texture; xyz = route point at u = texelIndex / (ROUTE_SAMPLES - 1). */
  tex: THREE.DataTexture
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
  const pts = curve.getSpacedPoints(ROUTE_SAMPLES - 1)
  const data = new Float32Array(ROUTE_SAMPLES * 4)
  pts.forEach((p, i) => data.set([p.x, p.y, p.z, 0], i * 4))
  const tex = new THREE.DataTexture(data, ROUTE_SAMPLES, 1, THREE.RGBAFormat, THREE.FloatType)
  // Nearest keeps float32 textures samplable on both backends without the
  // float32-filterable (WebGPU) / OES_texture_float_linear (WebGL2) features.
  // 256 samples over a ~50-unit route ≈ 0.2-unit steps — plenty smooth here.
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return { curve, tex }
}
