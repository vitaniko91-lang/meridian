import type { Node } from 'three/webgpu'
import { float } from 'three/tsl'

/**
 * Route windows — reusable triangle factors keyed on route progress.
 *
 * A route window rises 0→1→0: it peaks at `at` and reaches 0 at `at ± half`,
 * clamped to 0 beyond. Route effects (the prism dispersion, the gate
 * deflection) multiply their impulse/tint by a window so they act only inside a
 * narrow band of route-progress and re-converge outside it. Pure TSL — no
 * uniforms, no state; shared by the compute kernel and the render material so
 * geometry and color agree within a frame.
 */

/**
 * TSL-node triangle window: 1 at `at`, 0 at/beyond `at ± half`.
 * `at`/`half` are plain numbers (compile-time route constants).
 */
export const routeWindow = (progress: Node<'float'>, at: number, half: number) =>
  float(1).sub(progress.sub(at).abs().div(half).min(1))

/**
 * Pure-numeric mirror of `routeWindow`, for unit tests — a TSL node can't be
 * evaluated on the CPU without a renderer, so this reference implements the
 * SAME formula. Keep the two in sync.
 */
export const triangleWindow = (progress: number, at: number, half: number) =>
  1 - Math.min(Math.abs(progress - at) / half, 1)
