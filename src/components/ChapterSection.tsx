import type { Chapter } from '../content/copy'
import Headline from './Headline'
import Reveal from './Reveal'

/**
 * One narrative chapter: a 130lvh scroll runway with a sticky text block
 * hugging the left or right edge (copy.ts decides) — the center stays clear
 * for the particle river.
 */
export default function ChapterSection({ c }: { c: Chapter }) {
  return (
    <section id={c.id} aria-labelledby={`${c.id}-h`} className="relative min-h-[130lvh]">
      <div
        className={`sticky top-[22vh] max-w-[480px] px-6 ${
          c.side === 'left' ? 'md:ml-[8vw]' : 'md:ml-auto md:mr-[8vw]'
        }`}
      >
        <Reveal>
          {/* No uppercase transform: copy carries intended caps — "t = 0.120s" must keep its lowercase t/s */}
          <p className="font-mono text-[11px] tracking-[0.22em] text-muted">{c.kicker}</p>
          <Headline
            as="h2"
            id={`${c.id}-h`}
            segs={c.headline}
            className="mt-4 text-[clamp(1.75rem,4vw,2.5rem)] leading-tight"
          />
          <p className="mt-5 text-[15px] leading-relaxed text-ivory/85">{c.body}</p>
          {c.metric && <p className="mt-6 font-mono text-sm text-gold">{c.metric}</p>}
        </Reveal>
      </div>
    </section>
  )
}
