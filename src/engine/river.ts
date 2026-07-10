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
  oneMinus,
  select,
  sin,
  smoothstep,
  time,
  uniform,
  uniformArray,
  uv,
  vec3,
  vec4,
} from 'three/tsl'
import { CHAPTER_U, ROUTE_SAMPLES } from './route'
import { PRISM_AT, PRISM_HALF, prismFan, prismWindow, spectral } from './prism'
import { routeWindow } from './windows'

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
  /**
   * Camera-framed birth point for the hero bead during chapter 1 (before the
   * stream reveals). The engine recomputes it each frame from the camera basis
   * so the lone "born" particle is always in-frame; the hero mixes from this to
   * its route position as the stream fades in. Parked at origin until set.
   */
  uHeroBirth: THREE.UniformNode<'vec3', THREE.Vector3>
  /** World-space pointer for repulsion; parked far away until first pointermove. */
  uPointer: THREE.UniformNode<'vec3', THREE.Vector3>
  /** Sprite scale multiplier, default 0.6 — bench-validated look (`?scale=` dev override). */
  uScale: THREE.UniformNode<'float', number>
  /** Sprite alpha multiplier, default 0.5 — bench-validated look (`?alpha=` dev override). */
  uAlpha: THREE.UniformNode<'float', number>
  /**
   * Settlement crystal centre (world space) — LATTICE_ORIGIN + LATTICE_OFFSET.
   * Exposed for composition tuning: the kernel's lattice grid and the hero snap
   * slot both derive from it, so nudging `.value` live re-homes the whole crystal
   * (locked particles migrate via the steering spring). Baked offset lives in
   * LATTICE_OFFSET; this handle is the live-tuning surface.
   */
  uLatticeOrigin: THREE.UniformNode<'vec3', THREE.Vector3>
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

// Peak-1 stream-reveal ramp bounds in narrative-time (uT). The river is dark
// through "The Instant" (#instant lands at uT≈0.03) and full by the time
// "The Stream" copy arrives (#stream section top ≈ uT 0.13). The hero bead's
// birth-lift uses the same bounds so it settles onto the route as the river
// appears. Tuned visually 2026-07-09 against p3t2-* captures.
// Derivation: those uT targets come from the page's scroll geometry — hero
// 100lvh + 7×130lvh chapters + contact 90lvh, mapped scroll→uT through
// scrollToNarrative's smootherstep. If a section height changes, the #instant/
// #stream scroll fractions move, so re-derive these two bounds against them.
const REVEAL_START = 0.05
const REVEAL_END = 0.12

// The Gate (chapter 4) — in-flight screening. A rare impostor deflects out of
// the gold stream and is permanently marked steel; 99.96% pass untouched.
// GATE_AT = 3.5/7 sits mid chapter-4's u-range [3/7, 4/7]; the deflection acts
// only inside the ±GATE_HALF route-window, then the route spring re-converges.
const GATE_AT = 3.5 / 7
const GATE_HALF = 0.04
// Suspect = ~0.04% of particles (hash(instanceIndex + 31) < this). Verified:
// hash(0 + 31) = 0.98 ≥ threshold, so the hero (instance 0) is never a suspect
// — and the hero pin at the end of the kernel overrides any impulse regardless.
const SUSPECT_THRESHOLD = 0.0004
// Steel #5A6B7A — the screened-out currency's cool, inert tone.
// Steel — the screened-out currency's cold, inert tone. Brightened from the base
// palette #5A6B7A so the handful of tiny deflected specks read as a distinct cold
// blue against the vault black (a literal #5A6B7A is too dark to catch the eye at
// this size); still unmistakably steel, not a second accent.
const STEEL = [0.47, 0.58, 0.72] as const

// Settlement (chapter 6) — the climax: the stream crystallizes into a cubic
// lattice (the settled ledger). Each particle derives its lattice slot from
// instanceIndex and steers off the route into it. Narrative-time (uT) driven,
// so the lock is permanent once reached — and releases if the user scrolls back
// up into the river (an acceptable, delightful reversibility).
const CH6_U = CHAPTER_U(6) // 6/7 ≈ 0.857 — start of the Settlement chapter.
// Crystallize ramp bounds in narrative-time. The leading edge (−0.10) is early
// and wide DELIBERATELY: the per-particle STAGGER below delays visible locking,
// and the settlement section-top lands at uT≈0.82 — so a wide ramp makes the
// lock already visibly forming as the SETTLEMENT copy pins ("part river, part
// lattice"), completing by mid-runway. The crystallizing particles sit in the
// settlement basin (x≈17..26), off-screen-right during the PRISM chapter, so
// the early start never bleeds crystal into the dispersion beat. Trailing edge
// (+0.05) so the body is fully locked before PAID and before the hero snap.
// Tuned visually against the p3t4-* captures (uT: settlement≈0.82, paid≈0.95).
const CRYSTAL_START = CH6_U - 0.1
const CRYSTAL_END = CH6_U + 0.05
// Full world-space extent of the settlement crystal cube — HELD CONSTANT across
// tiers so the composition is count-independent (the per-slot pitch is derived
// as LATTICE_EXTENT / side inside createRiver, side = ⌈∛count⌉). Without this the
// cube would grow with the particle count (6u @300k but 9u @1M at a fixed pitch)
// and re-encroach on the PAID copy on the WebGPU tier. 6u is the Task-5 art-pass
// value: at the old ~9.4u the cube spanned the whole left half at #paid and
// buried the (left-hugging) copy; a compact 6u cube keeps its screen footprint
// centred on its projection point, in the frame's open centre-right, clear of
// the top-left copy and fully on-screen at every width (incl. the tall wrapped
// 375 metric). Paired with the soft sprite glow so the dense lattice still reads
// as one ordered glowing object; higher tiers just pack the same cube denser.
const LATTICE_EXTENT = 6
// World-space nudge of the crystal centre off the raw route point, to seat the
// cube in the frame's open centre-right/lower at #paid — clear of the
// left-hugging PAID copy — without touching any camera anchor (which would also
// move the #contact tail framing). +x/−y/+z ≈ screen right+down at the paid
// framing. Tuned live against the p3t5 paid/settlement matrix (1440/768/375).
const LATTICE_OFFSET = new THREE.Vector3(5.5, -3, 3)
// The hero (instance 0) snaps LAST: it keeps riding the route until the crystal
// is nearly formed, then lerps hard to its reserved centre-front slot. Window
// sits just past CRYSTAL_END so the keystone lands after the body has locked.
// Exported so engine.ts fires the settlement micro-shake at the exact same
// scroll position the hero begins its snap — one source of truth, no drift.
export const HERO_SNAP_START = CH6_U + 0.055
const HERO_SNAP_END = CH6_U + 0.11

/**
 * Per-particle phase along the route — the SAME expression is evaluated in the
 * update kernel (compute pass) and the material colorNode (render pass), and
 * they must agree so the spectral tint lands exactly on the fanned particles.
 *
 * Why that's safe in r185: `time` is a renderGroup uniform whose value comes
 * from `NodeFrame.time`, and NodeFrame.update() — the only place time advances
 * (Timer.js → onRenderUpdate((frame) => frame.time)) — is called ONCE per rAF
 * tick in Animation.js:77, BEFORE the user animation-loop callback runs.
 * `renderer.compute()` and `renderer.render()` only re-stamp
 * `nodeFrame.renderId` (forcing the uniform callback to re-run) but read the
 * same frozen `frame.time` — so compute and render within one frame see
 * identical time, and this expression is deterministic on (instanceIndex, time).
 */
const particleProgress = () => fract(hash(instanceIndex).add(time.mul(0.02)))

/** Static per-particle wavelength for the prism dispersion, hue ∈ [0,1]. */
const particleHue = () => hash(instanceIndex.add(777))

/**
 * 1 for the rare "suspect" particles the gate screens out, 0 otherwise — the
 * SAME expression drives both the deflection impulse (kernel) and the steel
 * tint (material), so the deflected specks and the steel specks are the exact
 * same particles. A 0/1 multiply (not a branch) avoids warp divergence.
 */
const suspectFactor = () => select(hash(instanceIndex.add(31)).lessThan(SUSPECT_THRESHOLD), float(1), float(0))

export function createRiver(count: number, routePoints: THREE.Vector3[], latticeOrigin: THREE.Vector3): River {
  const positions = instancedArray(count, 'vec3')
  const velocities = instancedArray(count, 'vec3')

  // Route as a 256-entry vec3 uniform array (std140 UBO, 4KB padded) — works
  // identically on the WebGL2 transform-feedback and WebGPU compute paths.
  // (Chosen over a DataTexture tap: no sampler / float-filtering caveats.)
  const route = uniformArray<'vec3'>(routePoints, 'vec3')

  const uT = uniform(0)
  const uHeroBirth = uniform(new THREE.Vector3(0, 0, 0))
  const uPointer = uniform(new THREE.Vector3(0, 0, 999))
  // Bench 2026-07-07: scale 1 / alpha 0.55 blows out to white under additive
  // blending at 300k+ — 0.6/0.5 is the validated look. `?scale=` `?alpha=` override.
  const uScale = uniform(0.6)
  const uAlpha = uniform(0.5)
  // Settlement lattice: cube side (⌈∛count⌉ = 67 for 300k; a hardcoded 64 would
  // overflow — 64³ = 262144 < 300000) and its world-space centre (the ch6 route
  // basin, passed from route.ts LATTICE_ORIGIN, cloned so we don't alias the
  // exported constant). Both feed the crystallization kernel below AND the hero
  // snap; set once at construction.
  // Cube side = ⌈∛count⌉ (67 @300k, 100 @1M); pitch derived so the cube's world
  // extent is LATTICE_EXTENT regardless of count (see the const's note) — the
  // crystal composition stays fixed across tiers; higher counts just pack denser.
  const latticeSide = Math.ceil(Math.cbrt(count))
  const latticePitch = LATTICE_EXTENT / latticeSide
  const uLatticeSide = uniform(latticeSide)
  const uLatticeOrigin = uniform(latticeOrigin.clone().add(LATTICE_OFFSET))

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
    const progress = particleProgress()
    const target = sampleRoute(progress)

    // Lateral swirl gives the river body; amplitude varies per particle so the
    // stream has a dense core and loose fringes.
    const swirlAmp = hash(instanceIndex.add(42)).add(0.3).mul(0.35)
    const swirl = vec3(
      float(0),
      sin(progress.mul(40).add(time)).mul(swirlAmp),
      cos(progress.mul(38).add(time.mul(0.8))).mul(swirlAmp),
    )

    // Settlement crystallization target: each particle owns a cubic lattice
    // slot derived from its instanceIndex — decompose the flat index into
    // (cellX, cellY, cellZ) in float space (int mod isn't cleanly typed in r185;
    // the float idiom a − b·floor(a/b) is exact for non-negative a and gives a
    // TRUE 3D cube: x is fastest, then y, then z, all spanning 0..side−1). The
    // ×0.5 recenters the cube on LATTICE_ORIGIN.
    const idxF = float(instanceIndex)
    const side = uLatticeSide
    const cellX = idxF.sub(side.mul(idxF.div(side).floor())) // idx mod side
    const layer = idxF.div(side).floor() // floor(idx / side)
    const cellY = layer.sub(side.mul(layer.div(side).floor())) // layer mod side
    const cellZ = idxF.div(side.mul(side)).floor() // floor(idx / side²)
    // Break the perfect-grid moiré: nudge each cell by up to ±18% of the pitch on
    // each axis (per-particle hash). A mathematically perfect grid seen in
    // perspective under additive blending aliases into sharp radiating moiré
    // lines; this jitter reads as an organic crystal with thermal noise instead.
    // ±0.18·pitch stays well under half a pitch, so cells never overlap — the
    // cube is still unmistakably ordered, just not machined.
    const jitter = vec3(
      hash(instanceIndex.add(11)).sub(0.5),
      hash(instanceIndex.add(22)).sub(0.5),
      hash(instanceIndex.add(33)).sub(0.5),
    ).mul(latticePitch * 0.36)
    const grid = vec3(cellX, cellY, cellZ).sub(side.mul(0.5)).mul(latticePitch).add(uLatticeOrigin).add(jitter)

    // Crystallize blend (narrative-time). STAGGER per particle so slots lock in
    // hash order, not all at once — "staggered magnetic locking". `staggered`
    // drives BOTH the steering target crossfade AND the damping stiffen, and
    // clamps to [0,1] (smoothstep clamps): 0 = pure river, 1 = pure lattice.
    const crystallize = smoothstep(float(CRYSTAL_START), float(CRYSTAL_END), float(uT))
    const staggered = smoothstep(float(0), float(1), crystallize.mul(1.4).sub(hash(instanceIndex.add(97)).mul(0.4)))

    // The particle steers toward steerTarget — the route point early, crossfading
    // to its lattice slot as it crystallizes. Compute it BEFORE the wrap guard so
    // the guard can key off the ACTUAL target, not the raw route point.
    const routeTarget = target.add(swirl)
    const steerTarget = mix(routeTarget, grid, staggered)

    // Phase wrap (route tail → head) yanks routeTarget ~48 units away every ~50s;
    // instead of streaking across the scene such particles respawn at the target.
    // Discrete respawn, not a rate — no dtScale. The guard keys off steerTarget
    // (not raw routeTarget): while crystallizing (staggered ∈ [0.5,1)) a wrap
    // still moves steerTarget by (1−staggered)·48 — which can exceed 12 — so
    // snapping to steerTarget teleports the particle toward its lattice slot
    // rather than letting it streak across the crystal. Fully locked (staggered=1)
    // steerTarget = the stationary grid slot, so the guard never fires there.
    If(steerTarget.sub(p).length().greaterThan(12), () => {
      p.assign(steerTarget)
      v.assign(vec3(0))
    })

    // Steer toward steerTarget. This IS the restoring force: the drifting phase
    // supplies forward motion, the spring pulls back in / locks the crystal.
    // dtScale discipline: the damping decay goes through pow(dtScale), the
    // additive steering impulse through .mul(dtScale). The damping STIFFENS
    // 0.94→0.80 as it locks (tighter decay = snappier magnetic convergence).
    const desired = steerTarget.sub(p).mul(0.04)
    const dampBase = mix(float(0.94), float(0.80), staggered)
    v.assign(v.mul(dampBase.pow(dtScale)).add(desired.mul(dtScale)))

    // Fade the per-phase route impulses (prism fan, gate deflection) out as a
    // particle locks, so residual side-forces don't fuzz the crystal lattice.
    const notLocked = float(1).sub(staggered)

    // Prism dispersion: inside the window the stream fans into a spectrum band —
    // a per-wavelength lateral impulse spreads particles by hue; the steering
    // spring above re-converges them once the phase drifts past the window.
    // Applied AFTER the wrap guard (which zeroes v) so a wrap-snap can't fight
    // the fan; max offset ~±0.9 units stays far under the 12-unit snap radius.
    const inWindow = prismWindow(progress)
    v.addAssign(prismFan(particleHue(), inWindow).mul(0.05).mul(dtScale).mul(notLocked))

    // Gate screening: inside the gate window the rare suspects get a lateral +
    // downward impulse — pushed DOWN and aside, out of the gold stream. Deflection
    // deepened (~4 units, still far under the 12-unit wrap-snap radius) so the few
    // deflected specks separate clearly from the ribbon and read as "the rare
    // impostor deflects into the cold" rather than a faint fringe. The steering
    // spring re-converges them once the phase drifts past the window, so they
    // oscillate below the route, never escape. Force → ×dtScale; × suspectFactor
    // (0/1, unchanged count → the on-screen "99.96% pass" stays honest). AFTER the
    // wrap guard, same as the prism fan, so a wrap-snap can't fight it.
    const inGateWindow = routeWindow(progress, GATE_AT, GATE_HALF)
    v.addAssign(vec3(0, -1.5, 0.55).mul(inGateWindow).mul(0.11).mul(dtScale).mul(suspectFactor()).mul(notLocked))

    // Pointer repulsion (tactility proof).
    const toPointer = p.sub(uPointer)
    const dist = toPointer.length().max(0.0001)
    If(dist.lessThan(1.5), () => {
      v.addAssign(toPointer.div(dist).mul(float(1.5).sub(dist)).mul(0.01).mul(dtScale))
    })

    p.addAssign(v.mul(dtScale))

    // Hero particle: instance 0 rides the route exactly at narrative time uT —
    // pinned after integration so no force can pull it off the rail. During
    // chapter 1 ("The Instant") the route start is deliberately sunk (route.ts
    // cp0) to keep the river clear of copy, so the bead would fall off-frame —
    // but the lone particle MUST be visible for "one particle of value, released
    // into the dark". So the hero is BORN at uHeroBirth, a camera-framed point
    // the engine recomputes each frame (guaranteed in-frame regardless of route
    // geometry), then settles onto the route as the stream reveals (born ramp,
    // same bounds as the material reveal below).
    If(instanceIndex.equal(0), () => {
      const routePos = sampleRoute(float(uT).clamp(0, 1))
      const born = smoothstep(float(REVEAL_START), float(REVEAL_END), float(uT))
      const ride = mix(uHeroBirth, routePos, born)
      // Hero snaps LAST into a RESERVED centre-front slot — the near (+z) face
      // centre of the crystal (the paid camera sits at large +z, so +z reads as
      // "front"), making the hero the ledger's visible keystone. This composes
      // cleanly with the ch1 born mix above: `born` ramps at uT≈0, `snap` at
      // uT≈0.91 — opposite ends of uT, so at most one is ever in transit.
      const heroLattice = uLatticeOrigin.add(vec3(float(0), float(0), side.mul(latticePitch).mul(0.5)))
      const snap = smoothstep(float(HERO_SNAP_START), float(HERO_SNAP_END), float(uT))
      p.assign(mix(ride, heroLattice, snap))
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
  // Body: gold everywhere, spectral ONLY inside the prism window. The phase is
  // recomputed here with the SAME expression as the update kernel — see the
  // particleProgress note on why compute and render agree within a frame.
  const bodyProgress = particleProgress()
  // Prism dispersion window (render side) — same triangle as the kernel fan.
  // Reused for the spectral mix AND the core-dim in the alpha below.
  const inWindowBody = prismWindow(bodyProgress)
  // Saturated spectrum (Task-5 verdict §2): at 300k the fan blew to a white core
  // because thousands of overlapping additive hues summed past clip. Two knobs
  // fix it — (1) spectral(hue).pow(0.8) lifts each channel toward its pure hue so
  // the band reads vivid violet→red, and (2) inWindowBody.pow(0.7) brings colour
  // in earlier/stronger across the window. The dense-core dim lives in the alpha.
  const bodyColor = mix(
    vec3(0.91, 0.76, 0.46), // #E8C275 as light
    spectral(particleHue()).pow(vec3(0.8)),
    inWindowBody.pow(0.7),
  )
  // Gate mark: a suspect's color shifts to steel once its phase passes the gate.
  // Progress-based smoothstep (like the prism tint) so it SURVIVES past the
  // window — unlike the triangle deflection, it stays steel. NB this is permanent
  // per phase-lap, NOT narrative-permanent like the hero conversion below:
  // particleProgress fract-wraps every ~50s (time·0.02), so a suspect re-greys
  // from gold each lap as its phase re-crosses the gate. Non-suspects:
  // suspectFactor 0 → mix returns bodyColor unchanged.
  const steeled = smoothstep(float(GATE_AT), float(GATE_AT + GATE_HALF), bodyProgress)
  // 1 for a deflected suspect past the gate, else 0 — reused for the steel tint AND
  // a sprite-size boost so the handful of screened-out specks actually read.
  const steeledSuspect = steeled.mul(suspectFactor())
  const screenedColor = mix(bodyColor, vec3(STEEL[0], STEEL[1], STEEL[2]), steeledSuspect)
  // Ch7 pull-back vista shimmer: once crystallized, each locked cell breathes at
  // a sub-1Hz rate (0.7 rad/s ≈ 0.11 Hz) with a per-particle phase (hash(idx))
  // so the crystal glimmers asynchronously — the settled ledger, alive but calm.
  // This is the ONE permitted idle motion, and it is NOT a status pulse: it's a
  // faint ±10% brightness ripple applied only to the crystallized fraction
  // (crystallizeMat = the same uT ramp as the kernel, so all cells cross into
  // shimmer together). Gold/steel bodies keep full brightness while a river.
  const crystallizeMat = smoothstep(float(CRYSTAL_START), float(CRYSTAL_END), float(uT))
  const shimmer = float(0.9).add(sin(time.mul(0.7).add(hash(instanceIndex).mul(6.2832))).mul(0.1))
  const litColor = screenedColor.mul(mix(float(1), shimmer, crystallizeMat))
  // Hero conversion: once narrative time uT passes the prism, the hero's warm
  // gold permanently shifts to the "new currency" cool light — driven by uT
  // (not particle phase), so the change persists after the window.
  const converted = smoothstep(float(PRISM_AT), float(PRISM_AT + PRISM_HALF), float(uT))
  const heroColor = mix(vec3(1.0, 0.88, 0.62), vec3(0.72, 0.86, 1.0), converted)
  // Peak 1 — the stream reveal: chapter 1 shows ONLY the hero bead in darkness;
  // the river fades in as you scroll from "The Instant" into "The Stream" (ch2).
  // The ramp completes just BEFORE #stream's copy lands (uT≈0.13 at that section
  // top), so the river is already full and bright when "One payment is never
  // alone" appears — the darkness→river fill-in reads as the peak moment during
  // the scroll transition, not as an ashy half-reveal. Ramp driven by uT (same
  // idiom as the hero conversion above); the hero pin uses the SAME bounds to
  // settle the bead onto the route as the river materialises around it.
  const reveal = smoothstep(float(REVEAL_START), float(REVEAL_END), float(uT))
  // Radial sprite glow — soften every additive square into a point of light.
  // The Sprite billboard's uv() runs 0..1 across the quad (centre 0.5,0.5), so
  // `d` is the radial distance from centre; smoothstep(0.5,0.0,d) is 1 at the
  // centre → 0 at the edge midpoint (d=0.5), already 0 at the corners. Folding
  // it into the additive alpha turns each hard chip into a soft round bead. This
  // does double duty: it breaks up the settlement crystal's square-on-square
  // moiré, and it makes the lone hero bead read as a glow rather than a pixel.
  const spriteGlow = smoothstep(0.5, 0.0, uv().sub(0.5).length())
  // Dense-core dim inside the prism window: each in-window particle sheds up to
  // 45% of its additive alpha at the window peak, so the thousands of overlapping
  // sprites at the fan's heart stop summing to a blown white lens and the
  // per-particle hues show through instead (Task-5 verdict §2, the other half of
  // the saturation fix). oneMinus(inWindowBody·0.45): 1 outside → 0.55 at peak.
  const prismDim = oneMinus(inWindowBody.mul(0.45))
  material.colorNode = select(
    isHero,
    vec4(heroColor, spriteGlow),
    vec4(litColor, float(0.55).mul(uAlpha).mul(reveal).mul(spriteGlow).mul(prismDim)),
  )
  // Hero glow while alone: ×9 in the ch1 darkness (the lone "particle of light"
  // needs presence to carry the opening beat), easing back to its normal ×4 as
  // the river appears (same reveal ramp). Static presence — no pulse/loop. The
  // hard square softens to a radial glow in Task 5's sprite art pass.
  material.scaleNode = float(0.02)
    .add(hash(instanceIndex).mul(0.02))
    .mul(uScale)
    .mul(select(isHero, mix(float(9), float(4), reveal), mix(float(1), float(2.4), steeledSuspect)))

  const mesh = new THREE.Sprite(material)
  mesh.count = count
  mesh.frustumCulled = false

  return {
    mesh,
    init,
    update,
    uT,
    uHeroBirth,
    uPointer,
    uScale,
    uAlpha,
    uLatticeOrigin,
    positions,
    dispose() {
      material.dispose()
    },
  }
}
