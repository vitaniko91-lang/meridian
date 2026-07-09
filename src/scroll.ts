import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { scrollToNarrative, timerLabel } from './engine/timeline'

gsap.registerPlugin(ScrollTrigger)

// Lenis smooths the wheel, gsap's ticker drives it, ScrollTrigger maps
// document progress → narrative time t ∈ [0,1] for the engine + timer HUD.
//
// Single-instance guard: initScroll mutates global state (gsap ticker,
// lagSmoothing, ScrollTrigger). Calling it again while a previous instance is
// undisposed warns and returns a no-op disposer (chosen over throwing so a
// double-mount degrades gracefully instead of crashing the app).
let active = false

export function initScroll(onT: (t: number) => void, timerEl: HTMLElement) {
  if (active) {
    console.warn('[meridian] initScroll: previous instance not disposed — returning no-op disposer')
    return () => {}
  }
  active = true

  // lerp 0.16 (vs the 0.1 default) tightens Lenis's own smoothing so a wheel
  // flick settles in ~0.7-0.85s instead of ~1.3s+ — the Task-6 review found the
  // stacked smoothers (Lenis lerp × the engine's tSmooth) compounded into a
  // slidey ~1.3s glide. wheelMultiplier 0.9 trims a touch of over-throw;
  // syncTouch gives touch the same eased feel as the wheel (no raw native jump).
  const lenis = new Lenis({ lerp: 0.16, wheelMultiplier: 0.9, syncTouch: true })
  lenis.on('scroll', ScrollTrigger.update)
  const raf = (time: number) => lenis.raf(time * 1000) // gsap ticker: s → ms
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)

  const st = ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      // Intentional one-frame lag: three renders before the
      // gsap-ticker→lenis→ScrollTrigger chain samples scroll.
      const t = scrollToNarrative(self.progress)
      onT(t)
      timerEl.textContent = timerLabel(t)
    },
  })

  return () => {
    st.kill()
    gsap.ticker.remove(raf)
    gsap.ticker.lagSmoothing(500, 33) // restore gsap defaults
    lenis.destroy()
    active = false
  }
}
