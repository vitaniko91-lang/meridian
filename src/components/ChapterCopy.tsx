import type { ReactElement } from 'react'
import type { Chapter } from '../content/copy'
import Headline from './Headline'

/**
 * The pure text block of a chapter: kicker, headline, body, optional metric.
 * Presentational only — NO Reveal, NO motion imports — so the reduced-motion
 * page (AppStatic) renders the exact same copy with zero motion bytes.
 *
 * Returns a keyed ARRAY (not a fragment) on purpose: Reveal staggers its
 * direct children, and Children.toArray flattens arrays but cannot see
 * through a <ChapterCopy /> element or a fragment. ChapterSection therefore
 * calls this as a plain function — `<Reveal>{ChapterCopy({ c })}</Reveal>` —
 * which hands Reveal the same four masked lines (60ms stagger) as before the
 * extraction. Keep this hook-free; a direct call would break with hooks.
 */
export default function ChapterCopy({ c }: { c: Chapter }): ReactElement[] {
  return [
    // No uppercase transform: copy carries intended caps — "t = 0.120s" must keep its lowercase t/s
    <p key="kicker" className="font-mono text-[11px] tracking-[0.22em] text-muted">
      {c.kicker}
    </p>,
    <Headline
      key="headline"
      as="h2"
      id={`${c.id}-h`}
      segs={c.headline}
      className="mt-4 text-[clamp(1.75rem,4vw,2.5rem)] leading-tight"
    />,
    <p key="body" className="mt-5 text-[15px] leading-relaxed text-ivory/85">
      {c.body}
    </p>,
    ...(c.metric
      ? [
          <p key="metric" className="mt-6 font-mono text-sm text-gold">
            {c.metric}
          </p>,
        ]
      : []),
  ]
}
