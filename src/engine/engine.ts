import * as THREE from 'three/webgpu'
import { chooseTier, detectEnv, type Tier } from './tiers'
import { createFpsMeter } from './fps'
import { createRiver, HERO_SNAP_START } from './river'
import { CHAPTER_ANCHORS, CHAPTER_ANCHORS_PORTRAIT, LATTICE_ORIGIN, createRoute } from './route'
import { lerpAnchors } from './timeline'
import { parseOverrides } from './overrides'

export type Engine = {
  tier: Tier
  setT: (t: number) => void
  dispose: () => void
}

export async function createEngine(
  canvas: HTMLCanvasElement,
  hud: HTMLElement,
  signal?: AbortSignal,
): Promise<Engine> {
  // dev tuning overrides for acceptance runs: ?count= ?dpr= ?webgl ?webgpu ?scale= ?alpha=
  const overrides = parseOverrides(location.search)
  const env = detectEnv()
  if (overrides.forceWebGL) env.hasWebGPU = false
  if (overrides.preferWebGPU) env.preferWebGPU = true
  const tier = chooseTier(env)
  if (overrides.count !== undefined) tier.count = overrides.count
  if (overrides.dpr !== undefined) tier.maxDpr = overrides.dpr

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: false,
    forceWebGL: tier.backend === 'webgl2',
  })
  await renderer.init()
  if (signal?.aborted) {
    renderer.dispose()
    throw new DOMException('Engine creation aborted', 'AbortError')
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.maxDpr))
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.setClearColor(0x0b0a08)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200)
  camera.position.set(0, 0, 12)

  const route = createRoute()
  const river = createRiver(tier.count, route.points, LATTICE_ORIGIN)
  if (overrides.scale !== undefined) river.uScale.value = overrides.scale
  if (overrides.alpha !== undefined) river.uAlpha.value = overrides.alpha
  scene.add(river.mesh)
  await renderer.computeAsync(river.init)
  if (signal?.aborted) {
    river.dispose()
    renderer.dispose()
    throw new DOMException('Engine creation aborted', 'AbortError')
  }

  // Adaptive quality: keep the experience smooth on weak/passively-cooled GPUs by
  // shedding render load until fps recovers, while fast machines keep full quality.
  // dpr-FIRST (fill-rate): the settlement crystal's dense additive overdraw is the
  // heaviest frame, and halving dpr quarters that fill — and it only softens the
  // particle canvas, never the DOM copy. Particle count (draw) is the last resort.
  // Monotonic down (never steps back up) so it can't oscillate; the reduction
  // targets the worst scene the visitor reaches. Disabled when a manual ?dpr/?count
  // override pins the tier (benchmarking).
  const QUALITY_STEPS = [
    { dpr: 1, count: 1 }, // full
    { dpr: 0.8, count: 1 },
    { dpr: 0.65, count: 1 },
    { dpr: 0.55, count: 0.8 },
    { dpr: 0.5, count: 0.6 }, // floor
  ]
  const adaptive = overrides.dpr === undefined && overrides.count === undefined
  let qLevel = 0
  let warmup = 0
  let lowRun = 0
  const applyQuality = () => {
    const q = QUALITY_STEPS[qLevel]
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.maxDpr * q.dpr))
    renderer.setSize(innerWidth, innerHeight, false)
    river.mesh.count = Math.floor(tier.count * q.count)
  }
  const onSecond = (f: number) => {
    if (!adaptive) return
    if (warmup < 2) {
      warmup++ // let the scene + thermal settle before judging
      return
    }
    lowRun = f < 50 ? lowRun + 1 : 0
    if (lowRun >= 2 && qLevel < QUALITY_STEPS.length - 1) {
      qLevel++
      applyQuality()
      lowRun = 0
    }
  }

  const fps = createFpsMeter(hud, onSecond)
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.maxDpr * QUALITY_STEPS[qLevel].dpr))
    renderer.setSize(innerWidth, innerHeight, false)
  }
  addEventListener('resize', onResize)

  // pointer → world plane z=0 (feeds river repulsion uniform)
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const pointerHit = new THREE.Vector3()
  const onPointerMove = (e: PointerEvent) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    if (raycaster.ray.intersectPlane(pointerPlane, pointerHit)) {
      river.uPointer.value.copy(pointerHit)
    }
  }
  addEventListener('pointermove', onPointerMove)

  // Camera rail: chase a target narrative time along the route spline.
  // Scroll (src/scroll.ts) drives tTarget via setT; the loop smooths toward it.
  let tTarget = 0
  let tSmooth = 0
  // Settlement snap micro-shake: a one-shot damped-sine camera nudge fired the
  // instant tSmooth crosses into the hero-snap window (the ledger "locks in").
  // Transform-only (offsets camera.position AFTER framing), ~7 frames @60fps.
  // Debounced: armed once per upward crossing, re-arms only when tSmooth falls
  // back below the trigger — so scrubbing back and forth can't spam it.
  const SHAKE_TRIGGER = HERO_SNAP_START // imported from river.ts — one source of truth
  const SHAKE_MS = 120
  const SHAKE_AMP = 0.045 // world units — a ~2px jolt at the paid framing distance
  let prevTSmooth = 0
  let shakeArmed = true
  let shakeStart = -1
  const camOffset = new THREE.Vector3()
  const camPoint = new THREE.Vector3()
  const lookPoint = new THREE.Vector3()
  // Scratch vectors for the hero birth point (chapter 1): a camera-framed
  // location so the lone "born" bead is always in-frame, biased into the empty
  // space to screen-right of the #instant copy (which pins top-left).
  const camForward = new THREE.Vector3()
  const camRight = new THREE.Vector3()
  const heroBirth = new THREE.Vector3()
  const WORLD_UP = new THREE.Vector3(0, 1, 0)

  let lastTime = -1
  renderer.setAnimationLoop((time: number) => {
    fps.tick()
    // Frame-rate independent exponential smoothing: K=0.09 per 60fps-frame,
    // converging identically at 30 or 120fps. dt clamped at 50ms so tab-switch
    // pauses don't teleport the camera. K raised 0.06→0.09 in the Task-5 scroll
    // pass so this (already-eased-by-Lenis) layer stays dominant with less
    // compounding — one snappy smoother reads better than two stacked slow ones.
    const dt = lastTime < 0 ? 1 / 60 : Math.min((time - lastTime) / 1000, 0.05)
    lastTime = time
    tSmooth += (tTarget - tSmooth) * (1 - Math.pow(1 - 0.09, dt * 60))
    river.uT.value = tSmooth // hero particle rides with the camera
    // Micro-shake trigger: fire on the upward crossing of the snap threshold
    // (debounced via shakeArmed); re-arm once tSmooth drops back below it.
    if (shakeArmed && prevTSmooth < SHAKE_TRIGGER && tSmooth >= SHAKE_TRIGGER) {
      shakeStart = time
      shakeArmed = false
    }
    if (tSmooth < SHAKE_TRIGGER) shakeArmed = true
    prevTSmooth = tSmooth
    // Per-chapter framing: piecewise-lerped camera offset + look-ahead
    // (route.ts CHAPTER_ANCHORS carry the composition intent per chapter;
    // portrait viewports swap the hero keyframe — see route.ts).
    const framing = lerpAnchors(
      tSmooth,
      camera.aspect < 1 ? CHAPTER_ANCHORS_PORTRAIT : CHAPTER_ANCHORS,
    )
    route.curve.getPointAt(tSmooth, camPoint)
    camera.position.copy(camPoint).add(camOffset.fromArray(framing.camOffset))
    route.curve.getPointAt(Math.min(tSmooth + framing.lookAhead, 1), lookPoint)
    // Raise the aim above the route (portrait-only in practice): screen center
    // rides the look target and the ribbon hugs the route below it, so a
    // positive bias sinks the whole river band below the full-width mobile copy
    // without the tilt a camera-height change induces. heroBirth reads this same
    // (biased) lookPoint so the born bead stays consistent with screen center.
    lookPoint.y += framing.lookYOffset
    camera.lookAt(lookPoint)

    // Hero birth point: lookPoint projects to screen center, so nudge along the
    // camera-right axis into the empty half beside the #instant copy. Recomputed
    // every frame from the current camera basis — the hero bead mixes from this
    // to its route position as the stream reveals (see river.ts hero pin).
    camForward.subVectors(lookPoint, camera.position).normalize()
    camRight.crossVectors(camForward, WORLD_UP).normalize()
    heroBirth.copy(lookPoint).addScaledVector(camRight, 3.6).addScaledVector(camForward, -1.5)
    river.uHeroBirth.value.copy(heroBirth)

    // Apply the settlement micro-shake LAST — a damped sine on camera.position
    // only (no re-aim: lookAt already ran, so this is a pure translational
    // jolt). Runs the frame after heroBirth so the shake never perturbs it.
    if (shakeStart >= 0) {
      const e = time - shakeStart
      if (e <= SHAKE_MS) {
        const s = SHAKE_AMP * (1 - e / SHAKE_MS) * Math.sin((e / SHAKE_MS) * Math.PI * 3)
        camera.position.x += s
        camera.position.y += s * 0.6
      } else {
        shakeStart = -1
      }
    }

    renderer.compute(river.update)
    renderer.render(scene, camera)
  })

  // exposed for later tasks
  // anchors included as a live-tuning surface: the loop re-lerps CHAPTER_ANCHORS
  // every frame, so console edits show up immediately (composition work).
  ;(globalThis as any).__meridian = {
    renderer,
    scene,
    camera,
    tier,
    river,
    route,
    anchors: CHAPTER_ANCHORS,
    anchorsPortrait: CHAPTER_ANCHORS_PORTRAIT,
  }

  return {
    tier,
    setT(t: number) {
      // Feeds the camera-rail smoothing input — NOT river.uT directly —
      // so the hero particle and camera stay in lockstep through tSmooth.
      tTarget = t
    },
    dispose() {
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onPointerMove)
      // river → renderer, same order as the abort path (route is CPU-only now —
      // its uniformArray buffer is freed with the renderer);
      // three r185 Renderer.dispose() calls setAnimationLoop(null) internally
      river.dispose()
      renderer.dispose()
      delete (globalThis as any).__meridian
    },
  }
}
