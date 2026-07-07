import * as THREE from 'three/webgpu'
import { chooseTier, detectEnv, type Tier } from './tiers'
import { createFpsMeter } from './fps'
import { createRiver } from './river'

export type Engine = {
  tier: Tier
  dispose: () => void
}

export async function createEngine(
  canvas: HTMLCanvasElement,
  hud: HTMLElement,
  signal?: AbortSignal,
): Promise<Engine> {
  const env = detectEnv()
  const tier = chooseTier(env)

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

  const river = createRiver(tier.count)
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

  renderer.setAnimationLoop(() => {
    fps.tick()
    renderer.compute(river.update)
    renderer.render(scene, camera)
  })

  // exposed for later tasks
  ;(globalThis as any).__meridian = { renderer, scene, camera, tier, river }

  return {
    tier,
    dispose() {
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onPointerMove)
      // three r185 Renderer.dispose() calls setAnimationLoop(null) internally
      renderer.dispose()
      river.dispose()
      delete (globalThis as any).__meridian
    },
  }
}
