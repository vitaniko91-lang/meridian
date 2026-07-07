import * as THREE from 'three/webgpu'
import {
  Fn,
  If,
  cos,
  deltaTime,
  float,
  hash,
  instancedArray,
  instanceIndex,
  sin,
  time,
  uniform,
  vec3,
  vec4,
} from 'three/tsl'

/**
 * GPU particle river: a loose ribbon of additive gold sprites advected along
 * +X by a pseudo-curl flow field, with pointer repulsion for tactility.
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
  /** Narrative time 0..1 (scroll-driven in a later task). */
  uT: THREE.UniformNode<'float', number>
  /** World-space pointer for repulsion; parked far away until first pointermove. */
  uPointer: THREE.UniformNode<'vec3', THREE.Vector3>
  /** Sprite scale multiplier, default 1 (art-tuning knob; `?scale=` dev override). */
  uScale: THREE.UniformNode<'float', number>
  /** Sprite alpha multiplier, default 1 (art-tuning knob; `?alpha=` dev override). */
  uAlpha: THREE.UniformNode<'float', number>
  /**
   * Dispose the GPU material. (Sprite geometry is module-shared in three — never disposed.)
   * NOTE: the `instancedArray` storage buffers are GPU resources freed only by
   * `renderer.dispose()` — a tier switch must NOT recreate rivers on a live
   * renderer, or the old buffers leak for the renderer's lifetime.
   */
  dispose: () => void
}

const RIBBON_HALF_LENGTH = 20 // world units; ribbon spans x in [-20, 20]

export function createRiver(count: number): River {
  const positions = instancedArray(count, 'vec3')
  const velocities = instancedArray(count, 'vec3')

  const uT = uniform(0)
  const uPointer = uniform(new THREE.Vector3(0, 0, 999))
  const uScale = uniform(1)
  const uAlpha = uniform(1)

  // One-time init kernel: seed a loose ribbon along X.
  const init = Fn(() => {
    const p = positions.element(instanceIndex)
    const seed = hash(instanceIndex)
    const seed2 = hash(instanceIndex.add(1234))
    const seed3 = hash(instanceIndex.add(9876))
    p.x = seed.mul(40).sub(RIBBON_HALF_LENGTH)
    p.y = seed2.sub(0.5).mul(2)
    p.z = seed3.sub(0.5).mul(2)
    velocities.element(instanceIndex).assign(vec3(0.02, 0, 0))
  })().compute(count)

  // Per-frame kernel: advect along +X with pseudo-curl swirl + pointer avoidance.
  // All rates are tuned for a 60fps reference frame and scaled by dtScale so the
  // river flows at the same world speed on 60Hz, 120Hz, or a stuttering tab.
  const update = Fn(() => {
    const p = positions.element(instanceIndex)
    const v = velocities.element(instanceIndex)

    // deltaTime normalized to 60fps frames; clamped to guard huge tab-switch deltas.
    const dtScale = deltaTime.mul(60).min(3)

    // Weak spring toward the ribbon core (y=0, z=0) so pointer kicks don't
    // permanently diffuse the ribbon. Task 5's route attraction extends this term.
    v.addAssign(vec3(float(0), p.y.mul(-0.001), p.z.mul(-0.001)).mul(dtScale))

    const swirl = vec3(
      float(0),
      sin(p.x.mul(0.35).add(time.mul(0.6))).mul(0.004),
      cos(p.x.mul(0.28).add(time.mul(0.45))).mul(0.004),
    )
    v.assign(
      v.mul(float(0.985).pow(dtScale)).add(swirl.mul(dtScale)).add(vec3(0.0006, 0, 0).mul(dtScale)),
    )

    // Pointer repulsion (tactility proof).
    const toPointer = p.sub(uPointer)
    const dist = toPointer.length().max(0.0001)
    If(dist.lessThan(1.5), () => {
      v.addAssign(toPointer.div(dist).mul(float(1.5).sub(dist)).mul(0.01).mul(dtScale))
    })

    p.addAssign(v.mul(dtScale))
    // Wrap the ribbon: x > 20 → back to -20.
    If(p.x.greaterThan(RIBBON_HALF_LENGTH), () => {
      p.x.subAssign(RIBBON_HALF_LENGTH * 2)
    })
  })().compute(count)

  // Additive gold sprites.
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  material.positionNode = positions.toAttribute()
  material.colorNode = vec4(vec3(0.91, 0.76, 0.46), float(0.55).mul(uAlpha)) // #E8C275 as light
  material.scaleNode = float(0.02).add(hash(instanceIndex).mul(0.02)).mul(uScale)

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
    dispose() {
      material.dispose()
    },
  }
}
