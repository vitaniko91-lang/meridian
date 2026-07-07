import { useEffect, useRef, useState } from 'react'
import { createEngine } from './engine/engine'
import { initScroll } from './scroll'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)
  const [backend, setBackend] = useState('…')

  useEffect(() => {
    const ac = new AbortController()
    let disposed = false
    let dispose = () => {}
    let disposeScroll = () => {}
    // Engine creation is deferred one tick: React StrictMode (dev) runs
    // effect → cleanup → effect synchronously, and the first timer is
    // cancelled before it fires, so only ONE engine is ever created per
    // canvas. Two engines on one canvas is fatal on the webgl2 path: the
    // aborted engine's renderer.dispose() calls
    // WEBGL_lose_context.loseContext() on the GL context it SHARES with the
    // live engine → "WebGL Device Lost" → permanently white canvas
    // (root-caused 2026-07-07; webgpu survives only because each renderer
    // owns a separate GPUDevice).
    const start = setTimeout(() => {
      createEngine(canvasRef.current!, hudRef.current!, ac.signal)
        .then((engine) => {
          if (disposed) return engine.dispose()
          dispose = engine.dispose
          // scroll needs engine.setT, so it boots only after the engine resolves
          disposeScroll = initScroll((t) => engine.setT(t), timerRef.current!)
          setBackend(engine.tier.backend)
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') {
            console.error('[meridian] engine init failed', err)
            setBackend('error')
          }
        })
    }, 0)
    return () => {
      clearTimeout(start)
      disposed = true
      ac.abort()
      disposeScroll() // stop driving setT before the engine goes away
      dispose()
    }
  }, [])

  return (
    <main className="h-[400lvh]">
      <canvas ref={canvasRef} className="fixed inset-0 h-[100lvh] w-full" />
      <div ref={hudRef} className="fixed right-3 top-3 font-mono text-xs text-[#E8C275]" />
      <div className="fixed left-3 top-3 font-mono text-xs text-[#8A8071]">{backend}</div>
      <div ref={timerRef} aria-hidden="true" className="fixed bottom-3 left-3 font-mono text-sm text-[#E8C275]">
        t = 0.000s
      </div>
    </main>
  )
}
