import { useEffect, useRef, useState } from 'react'
import { createEngine } from './engine/engine'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const [backend, setBackend] = useState('…')

  useEffect(() => {
    let disposed = false
    let dispose = () => {}
    createEngine(canvasRef.current!, hudRef.current!).then((engine) => {
      if (disposed) return engine.dispose()
      dispose = engine.dispose
      setBackend(engine.tier.backend)
    })
    return () => {
      disposed = true
      dispose()
    }
  }, [])

  return (
    <main className="h-[400lvh]">
      <canvas ref={canvasRef} className="fixed inset-0 h-[100lvh] w-full" />
      <div ref={hudRef} className="fixed right-3 top-3 font-mono text-xs text-[#E8C275]" />
      <div className="fixed left-3 top-3 font-mono text-xs text-[#8A8071]">{backend}</div>
    </main>
  )
}
