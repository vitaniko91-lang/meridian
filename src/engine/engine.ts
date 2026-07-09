import * as THREE from 'three/webgpu'
import { chooseTier, detectEnv, type Tier } from './tiers'
import { createFpsMeter } from './fps'
import { createRiver } from './river'
import { CHAPTER_ANCHORS, CHAPTER_ANCHORS_PORTRAIT, CHAPTER_U, LATTICE_ORIGIN, createRoute } from './route'
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

  const fps = createFpsMeter(hud)
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio, tier.maxDpr))
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
  const SHAKE_TRIGGER = CHAPTER_U(6) + 0.055 // == river HERO_SNAP_START
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
    // Frame-rate independent exponential smoothing: equals the old 0.06/frame
    // at 60fps, but converges identically at 30 or 120fps. dt clamped at 50ms
    // so tab-switch pauses don't teleport the camera.
    const dt = lastTime < 0 ? 1 / 60 : Math.min((time - lastTime) / 1000, 0.05)
    lastTime = time
    tSmooth += (tTarget - tSmooth) * (1 - Math.pow(1 - 0.06, dt * 60))
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

  // dev-only fps sweep instrument — lazy, zero cost without ?sweep
  // (startSweep is a module singleton, so a StrictMode double-mount can't double-start it)
  if (location.search.includes('sweep')) {
    void import('./sweep').then(({ startSweep }) => startSweep(tier))
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
