import ChapterCopy from './components/ChapterCopy'
import ContactForm from './components/ContactForm'
import Headline from './components/Headline'
import Ornament from './components/Ornament'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import StaticPoster from './components/StaticPoster'
import { CHAPTERS, CTA, HERO } from './content/copy'

/**
 * Reduced-motion page: the FULL story as a natural-flow document — every
 * chapter, the contact form, the footer — with a static SVG poster instead
 * of the canvas. No sticky, no scroll runways, no Reveal, no scroll cue
 * (nothing is revealed). MUST NOT import three/gsap/lenis, directly or
 * transitively — the main.tsx gate exists so this path downloads zero
 * motion bytes.
 */
export default function AppStatic() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only fixed top-2 left-2 z-50 bg-vault text-gold px-3 py-2 font-mono text-xs"
      >
        Skip to content
      </a>
      <SiteHeader solid />
      <Ornament />
      <main id="main" className="relative">
        <section className="relative flex min-h-[90vh] items-center">
          <StaticPoster />
          <div className="relative max-w-[640px] px-6 md:ml-[8vw]">
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted">{HERO.kicker}</p>
            <Headline
              as="h1"
              segs={HERO.headline}
              className="mt-4 text-[clamp(2.5rem,6vw,4rem)] leading-tight"
            />
            <p className="mt-6 max-w-[480px] leading-relaxed text-ivory/85">{HERO.sub}</p>
          </div>
          {/* frozen narrative clock — decorative continuity with the motion app */}
          <div aria-hidden="true" className="absolute bottom-3 left-3 font-mono text-sm text-gold">
            t = 0.000s
          </div>
        </section>
        {CHAPTERS.map((c) => (
          <section
            key={c.id}
            id={c.id}
            aria-labelledby={`${c.id}-h`}
            className={`max-w-[560px] px-6 py-20 ${
              c.side === 'left' ? 'md:ml-[8vw]' : 'md:ml-auto md:mr-[8vw]'
            }`}
          >
            <ChapterCopy c={c} />
          </section>
        ))}
        <section id="contact" aria-labelledby="contact-h" className="max-w-[560px] px-6 py-20 md:ml-[8vw]">
          <Headline
            as="h2"
            id="contact-h"
            segs={CTA.headline}
            className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight"
          />
          <p className="mt-5 text-[15px] leading-relaxed text-ivory/85">{CTA.body}</p>
          <ContactForm />
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
