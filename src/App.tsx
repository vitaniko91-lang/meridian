import { useEffect, useRef, useState } from 'react'
import ChapterSection from './components/ChapterSection'
import ContactForm from './components/ContactForm'
import Headline from './components/Headline'
import Ornament from './components/Ornament'
import Reveal from './components/Reveal'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import { CHAPTERS, CTA, HERO } from './content/copy'
import { createEngine } from './engine/engine'
import { initScroll } from './scroll'
import { createAudio, type Audio } from './audio'

// Persisted mute choice. Reduced-motion visitors never reach this component
// (main.tsx routes them to AppStatic, which has no scroll and no audio), so the
// default here is unmuted — but browsers still block sound until the first
// gesture, so nothing plays until the visitor actually scrolls.
const MUTE_KEY = 'meridian-muted'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<Audio | null>(null)
  const [backend, setBackend] = useState('…')
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1')
  // Dev HUD (fps meter + backend label) is decoration, not part of the design.
  // It stays in the DOM — the engine's createFpsMeter(hud) writes to hudRef —
  // but is hidden from layout AND the a11y tree unless `?debug`, so it never
  // overlaps the header CTA in the default view (Plan-2 gate flag).
  const debug = location.search.includes('debug')

  useEffect(() => {
    const ac = new AbortController()
    let disposed = false
    let dispose = () => {}
    let disposeScroll = () => {}
    // Synthesized soundscape (src/audio.ts). Created now, but silent until the
    // engine boots AND the visitor's first scroll (a user gesture) unlocks the
    // AudioContext — so it never autoplays.
    const audio = createAudio(localStorage.getItem(MUTE_KEY) === '1')
    audioRef.current = audio
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
          // scroll needs engine.setT, so it boots only after the engine resolves;
          // it also feeds the audio bed (velocity) + chapter tones (t)
          disposeScroll = initScroll((t, v) => {
            engine.setT(t)
            audio.update(t, v)
          }, timerRef.current!)
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
      audio.dispose()
      audioRef.current = null
    }
  }, [])

  const toggleSound = () => {
    const next = audioRef.current?.toggleMute() ?? !muted
    setMuted(next)
    localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only fixed top-2 left-2 z-50 bg-vault text-gold px-3 py-2 font-mono text-xs"
      >
        Skip to content
      </a>
      <SiteHeader sound={{ muted, onToggle: toggleSound }} />
      <canvas ref={canvasRef} className="fixed inset-0 -z-10 h-[100lvh] w-full" />
      <Ornament />
      <div ref={hudRef} aria-hidden="true" hidden={!debug} className="fixed right-3 top-3 font-mono text-xs text-gold" />
      <div
        aria-hidden="true"
        hidden={!debug}
        data-testid="backend"
        className="fixed left-3 top-3 font-mono text-xs text-muted"
      >
        {backend}
      </div>
      <div
        ref={timerRef}
        data-testid="timer"
        aria-hidden="true"
        className="fixed bottom-3 left-3 font-mono text-sm text-gold"
      >
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
