import type { Chapter } from '../content/copy'
import ChapterCopy from './ChapterCopy'
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
        {/* Direct call (not <ChapterCopy/>): Reveal must receive the four copy
            lines as direct children to keep the per-line mask + 60ms stagger. */}
        <Reveal>{ChapterCopy({ c })}</Reveal>
      </div>
    </section>
  )
}
