import * as THREE from 'three/webgpu'
import { chooseTier, detectEnv, type Tier } from './tiers'
import { createFpsMeter } from './fps'
import { createRiver } from './river'
import { createRoute } from './route'
import { parseOverrides } from './overrides'

export type Engine = {
  tier: Tier
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
  const river = createRiver(tier.count, route.points)
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
  // Temporary keyboard drive ('1'/'2'/'3' → 0/0.5/1) until Task 6's scroll harness.
  let tTarget = 0
  let tSmooth = 0
  const camOffset = new THREE.Vector3(0, 1.2, 7)
  const camPoint = new THREE.Vector3()
  const lookPoint = new THREE.Vector3()
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === '1') tTarget = 0
    else if (e.key === '2') tTarget = 0.5
    else if (e.key === '3') tTarget = 1
  }
  addEventListener('keydown', onKeyDown)

  renderer.setAnimationLoop(() => {
    fps.tick()
    tSmooth += (tTarget - tSmooth) * 0.06
    river.uT.value = tSmooth // hero particle rides with the camera
    route.curve.getPointAt(tSmooth, camPoint)
    camera.position.copy(camPoint).add(camOffset)
    route.curve.getPointAt(Math.min(tSmooth + 0.04, 1), lookPoint)
    camera.lookAt(lookPoint)
    renderer.compute(river.update)
    renderer.render(scene, camera)
  })

  // exposed for later tasks
  ;(globalThis as any).__meridian = { renderer, scene, camera, tier, river, route }

  // dev-only fps sweep instrument — lazy, zero cost without ?sweep
  // (startSweep is a module singleton, so a StrictMode double-mount can't double-start it)
  if (location.search.includes('sweep')) {
    void import('./sweep').then(({ startSweep }) => startSweep(tier))
  }

  return {
    tier,
    dispose() {
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onPointerMove)
      removeEventListener('keydown', onKeyDown)
      // river → renderer, same order as the abort path (route is CPU-only now —
      // its uniformArray buffer is freed with the renderer);
      // three r185 Renderer.dispose() calls setAnimationLoop(null) internally
      river.dispose()
      renderer.dispose()
      delete (globalThis as any).__meridian
    },
  }
}
