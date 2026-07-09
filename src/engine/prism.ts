import type { Node } from 'three/webgpu'
import { Fn, float, smoothstep, vec3 } from 'three/tsl'
import { routeWindow } from './windows'

/**
 * Prism dispersion — the signature moment of the route. Around progress
 * PRISM_AT the gold river splits into a spectrum: each particle carries a
 * static wavelength (hue) that drives BOTH a lateral fan offset (velocity
 * impulse in the update kernel) and a spectral tint (material colorNode),
 * then re-converges to gold past the window.
 *
 * Pure TSL expression helpers — no uniforms, no state. Shared by the compute
 * kernel and the render material so the fan geometry and the tint agree.
 */

/** Route progress where the prism sits. */
export const PRISM_AT = 0.62
/** Half-width of the dispersion window in route-progress units. */
export const PRISM_HALF = 0.05

/** Crude-but-pretty spectral ramp: hue ∈ [0,1] maps violet→red. */
export const spectral = Fn(([hue]: [Node<'float'>]) => {
  const r = smoothstep(0.5, 0.8, hue)
  const g = smoothstep(0.1, 0.45, hue).mul(float(1).sub(smoothstep(0.65, 0.95, hue)))
  const b = float(1).sub(smoothstep(0.2, 0.55, hue))
  return vec3(r, g, b)
})

/** Triangle window 0→1→0 across the prism: 1 at PRISM_AT, 0 beyond ±PRISM_HALF. */
export const prismWindow = (progress: Node<'float'>) => routeWindow(progress, PRISM_AT, PRISM_HALF)

/**
 * Lateral fan direction: spreads particles by wavelength inside the window
 * (mostly Y with a touch of Z so the band reads at a raking camera angle).
 * Callers apply it as a velocity impulse `.mul(0.05).mul(dtScale)` — the
 * steering spring in the update kernel provides the re-convergence for free.
 */
export const prismFan = (hue: Node<'float'>, inWindow: Node<'float'>) =>
  vec3(float(0), hue.sub(0.5).mul(1.2), hue.sub(0.5).mul(0.4)).mul(inWindow)
