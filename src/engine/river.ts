import * as THREE from 'three/webgpu'
import {
  Fn,
  If,
  cos,
  deltaTime,
  float,
  fract,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  select,
  sin,
  time,
  uniform,
  uniformArray,
  vec3,
  vec4,
} from 'three/tsl'
import { ROUTE_SAMPLES } from './route'

/**
 * GPU particle river advected along the narrative route spline: each particle
 * owns a phase drifting forward along the route (read from a uniform array —
 * NOT a texture; see route.ts for why) with lateral swirl for body, plus
 * pointer repulsion for tactility.
 *
 * Instance 0 is the hero particle — pinned exactly onto the route at the
 * narrative time `uT`, rendered larger and brighter.
 *
 * Buffers live entirely on the GPU (`instancedArray` storage); the CPU only
 * dispatches kernels. Mirrors the official three.js compute-particles idiom
 * documented in three/src/nodes/accessors/StorageBufferNode.js.
 */
export type River = {
  /** Instanced sprite cloud — add to the scene. */
  mesh: THREE.Sprite
  /** One-time seeding kernel — run once via `renderer.computeAsync(river.init)`. */
  init: THREE.ComputeNode
  /** Per-frame advection kernel — run via `renderer.compute(river.update)` in the loop. */
  update: THREE.ComputeNode
  /** Narrative time 0..1 — hero particle rides the route at this phase. */
  uT: THREE.UniformNode<'float', number>
  /** World-space pointer for repulsion; parked far away until first pointermove. */
  uPointer: THREE.UniformNode<'vec3', THREE.Vector3>
  /** Sprite scale multiplier, default 0.6 — bench-validated look (`?scale=` dev override). */
  uScale: THREE.UniformNode<'float', number>
  /** Sprite alpha multiplier, default 0.5 — bench-validated look (`?alpha=` dev override). */
  uAlpha: THREE.UniformNode<'float', number>
  /**
   * Position storage node — debug/verification handle. Read positions back with
   * `renderer.getArrayBufferAsync(river.positions.value)` (r185 common Renderer API).
   */
  positions: THREE.StorageBufferNode<'vec3'>
  /**
   * Dispose the GPU material. (Sprite geometry is module-shared in three — never disposed.)
   * NOTE: the `instancedArray` storage buffers are GPU resources freed only by
   * `renderer.dispose()` — a tier switch must NOT recreate rivers on a live
   * renderer, or the old buffers leak for the renderer's lifetime.
   */
  dispose: () => void
}

const SEED_HALF_LENGTH = 20 // world units; initial cloud spans x in [-20, 20]

export function createRiver(count: number, routePoints: THREE.Vector3[]): River {
  const positions = instancedArray(count, 'vec3')
  const velocities = instancedArray(count, 'vec3')

  // Route as a 256-entry vec3 uniform array (std140 UBO, 4KB padded) — works
  // identically on the WebGL2 transform-feedback and WebGPU compute paths.
  // (Chosen over a DataTexture tap: no sampler / float-filtering caveats.)
  const route = uniformArray<'vec3'>(routePoints, 'vec3')

  const uT = uniform(0)
  const uPointer = uniform(new THREE.Vector3(0, 0, 999))
  // Bench 2026-07-07: scale 1 / alpha 0.55 blows out to white under additive
  // blending at 300k+ — 0.6/0.5 is the validated look. `?scale=` `?alpha=` override.
  const uScale = uniform(0.6)
  const uAlpha = uniform(0.5)

  // Linearly interpolated route lookup at u ∈ [0,1] (in-kernel, no sampler).
  // Indices are clamped in float space before the int cast — @types/three r185
  // doesn't type clamp/min on int nodes, and the result is identical.
  const sampleRoute = (u: THREE.Node<'float'>) => {
    const scaled = u.mul(ROUTE_SAMPLES - 1).clamp(0, ROUTE_SAMPLES - 1)
    const i0 = scaled.floor().toInt()
    const i1 = scaled.add(1).clamp(0, ROUTE_SAMPLES - 1).floor().toInt()
    return mix(vec3(route.element(i0)), vec3(route.element(i1)), scaled.fract())
  }

  // One-time init kernel: seed a loose cloud along X; route steering pulls
  // everything onto the spline within the first second.
  const init = Fn(() => {
    const p = positions.element(instanceIndex)
    const seed = hash(instanceIndex)
    const seed2 = hash(instanceIndex.add(1234))
    const seed3 = hash(instanceIndex.add(9876))
    p.x = seed.mul(40).sub(SEED_HALF_LENGTH)
    p.y = seed2.sub(0.5).mul(2)
    p.z = seed3.sub(0.5).mul(2)
    velocities.element(instanceIndex).assign(vec3(0.02, 0, 0))
  })().compute(count)

  // Per-frame kernel: steer each particle toward its drifting phase point on
  // the route spline + lateral swirl + pointer avoidance.
  // All rates are tuned for a 60fps reference frame and scaled by dtScale so the
  // river flows at the same world speed on 60Hz, 120Hz, or a stuttering tab.
  const update = Fn(() => {
    const p = positions.element(instanceIndex)
    const v = velocities.element(instanceIndex)

    // deltaTime normalized to 60fps frames; clamped to guard huge tab-switch deltas.
    const dtScale = deltaTime.mul(60).min(3)

    // Each particle owns a phase along the route, drifting forward with time;
    // fract() wraps it, replacing the old x-wrap (particles respawn at the head).
    const progress = fract(hash(instanceIndex).add(time.mul(0.02)))
    const target = sampleRoute(progress)

    // Lateral swirl gives the river body; amplitude varies per particle so the
    // stream has a dense core and loose fringes.
    const swirlAmp = hash(instanceIndex.add(42)).add(0.3).mul(0.35)
    const swirl = vec3(
      float(0),
      sin(progress.mul(40).add(time)).mul(swirlAmp),
      cos(progress.mul(38).add(time.mul(0.8))).mul(swirlAmp),
    )

    // Phase wrap (route tail → head) yanks the target ~48 units away; instead
    // of streaking across the scene (and past the camera rail as a giant
    // near-camera sprite), such particles respawn at their new target.
    // Discrete respawn, not a rate — no dtScale. Threshold 12 still lets the
    // initial seed cloud converge visibly.
    const toTarget = target.add(swirl).sub(p).toVar()
    If(toTarget.length().greaterThan(12), () => {
      p.assign(target.add(swirl))
      v.assign(vec3(0))
      toTarget.assign(vec3(0))
    })

    // Steer toward the (swirled) route point. This IS the restoring force now —
    // it replaces the old y/z spring toward the ribbon core AND the constant +X
    // drift: the drifting phase supplies forward motion, the spring pulls back in.
    // dtScale discipline: the 0.94 steering damping replaces the old 0.985
    // (steering gain 0.04 is far stronger than the old accumulative terms and
    // needs heavier damping to converge instead of orbiting the target); as a
    // per-reference-frame decay it goes through pow(dtScale), and the additive
    // steering impulse through .mul(dtScale), same as every other term.
    const desired = toTarget.mul(0.04)
    v.assign(v.mul(float(0.94).pow(dtScale)).add(desired.mul(dtScale)))

    // Pointer repulsion (tactility proof).
    const toPointer = p.sub(uPointer)
    const dist = toPointer.length().max(0.0001)
    If(dist.lessThan(1.5), () => {
      v.addAssign(toPointer.div(dist).mul(float(1.5).sub(dist)).mul(0.01).mul(dtScale))
    })

    p.addAssign(v.mul(dtScale))

    // Hero particle: instance 0 rides the route exactly at narrative time uT —
    // pinned after integration so no force can pull it off the rail.
    If(instanceIndex.equal(0), () => {
      p.assign(sampleRoute(float(uT).clamp(0, 1)))
      v.assign(vec3(0))
    })
  })().compute(count)

  // Additive gold sprites; hero (instance 0) is 4× larger and brighter.
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  material.positionNode = positions.toAttribute()
  const isHero = instanceIndex.equal(0)
  material.colorNode = select(
    isHero,
    vec4(1.0, 0.88, 0.62, 1),
    vec4(vec3(0.91, 0.76, 0.46), float(0.55).mul(uAlpha)), // #E8C275 as light
  )
  material.scaleNode = float(0.02)
    .add(hash(instanceIndex).mul(0.02))
    .mul(uScale)
    .mul(select(isHero, float(4), float(1)))

  const mesh = new THREE.Sprite(material)
  mesh.count = count
  mesh.frustumCulled = false

  return {
    mesh,
    init,
    update,
    uT,
    uPointer,
    uScale,
    uAlpha,
    positions,
    dispose() {
      material.dispose()
    },
  }
}
