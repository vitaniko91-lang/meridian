import * as THREE from 'three/webgpu'
import { chooseTier, detectEnv, type Tier } from './tiers'
import { createFpsMeter } from './fps'

export type Engine = {
  tier: Tier
  dispose: () => void
}

export async function createEngine(canvas: HTMLCanvasElement, hud: HTMLElement): Promise<Engine> {
  const env = detectEnv()
  const tier = chooseTier(env)

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: false,
    forceWebGL: tier.backend === 'webgl2',
  })
  await renderer.init()
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.maxDpr))
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.setClearColor(0x0b0a08)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200)
  camera.position.set(0, 0, 12)

  const fps = createFpsMeter(hud)
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight, false)
  }
  addEventListener('resize', onResize)

  renderer.setAnimationLoop(() => {
    fps.tick()
    renderer.render(scene, camera)
  })

  // exposed for later tasks
  ;(globalThis as any).__meridian = { renderer, scene, camera, tier }

  return {
    tier,
    dispose() {
      renderer.setAnimationLoop(null)
      removeEventListener('resize', onResize)
      renderer.dispose()
    },
  }
}
