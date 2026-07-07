import { useEffect, useRef, useState } from 'react'
import ChapterSection from './components/ChapterSection'
import ContactForm from './components/ContactForm'
import Headline from './components/Headline'
import Reveal from './components/Reveal'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import { CHAPTERS, CTA, HERO } from './content/copy'
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
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only fixed top-2 left-2 z-50 bg-vault text-gold px-3 py-2 font-mono text-xs"
      >
        Skip to content
      </a>
      <SiteHeader />
      <canvas ref={canvasRef} className="fixed inset-0 -z-10 h-[100lvh] w-full" />
      <div ref={hudRef} className="fixed right-3 top-3 font-mono text-xs text-gold" />
      <div className="fixed left-3 top-3 font-mono text-xs text-muted">{backend}</div>
      <div ref={timerRef} aria-hidden="true" className="fixed bottom-3 left-3 font-mono text-sm text-gold">
        t = 0.000s
      </div>
      <main id="main" className="relative">
        <section className="flex min-h-[100lvh] items-center">
          <div className="max-w-[640px] px-6 md:ml-[8vw]">
            <Reveal>
              <p className="font-mono text-[11px] tracking-[0.22em] text-muted">{HERO.kicker}</p>
              <Headline as="h1" segs={HERO.headline} className="mt-4 text-[clamp(2.5rem,6vw,4rem)] leading-tight" />
              <p className="mt-6 max-w-[480px] leading-relaxed text-ivory/85">{HERO.sub}</p>
              <p className="mt-10 font-mono text-xs text-gold">{HERO.cue} ↓</p>
            </Reveal>
          </div>
        </section>
        {CHAPTERS.map((c) => (
          <ChapterSection key={c.id} c={c} />
        ))}
        <section id="contact" aria-labelledby="contact-h" className="flex min-h-[90lvh] items-center">
          <div className="max-w-[560px] px-6 md:ml-[8vw]">
            <Reveal>
              <Headline as="h2" id="contact-h" segs={CTA.headline} className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight" />
              <p className="mt-5 text-[15px] leading-relaxed text-ivory/85">{CTA.body}</p>
              <ContactForm />
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
