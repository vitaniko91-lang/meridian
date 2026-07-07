import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { scrollToNarrative, timerLabel } from './engine/timeline'

// Lenis smooths the wheel, gsap's ticker drives it, ScrollTrigger maps
// document progress → narrative time t ∈ [0,1] for the engine + timer HUD.
export function initScroll(onT: (t: number) => void, timerEl: HTMLElement) {
  gsap.registerPlugin(ScrollTrigger)
  const lenis = new Lenis() // defaults ≈ native feel, no hijack
  lenis.on('scroll', ScrollTrigger.update)
  const raf = (time: number) => lenis.raf(time * 1000) // gsap ticker: s → ms
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)

  const st = ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      const t = scrollToNarrative(self.progress)
      onT(t)
      timerEl.textContent = timerLabel(t)
    },
  })

  return () => {
    st.kill()
    gsap.ticker.remove(raf)
    lenis.destroy()
  }
}
