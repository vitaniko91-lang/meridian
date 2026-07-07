import type { Seg } from '../content/copy'

/**
 * Renders a copy-deck headline: plain segments in Satoshi 500 ivory,
 * `em` segments in Instrument Serif italic gold (the Vault Light device).
 * Sentence case as written in copy — no uppercase transform, ever.
 *
 * Weight 500 is the deliberate "quiet" Vault Light choice (spec said 600):
 * judged side-by-side with a true variable-font 600 (2026-07-07) — at 600 the
 * sans gains mass and competes with the italic serif accent; 500 keeps the
 * quiet-frame/serif-jewel contrast. Kept 500.
 */
export default function Headline({
  segs,
  as: Tag,
  id,
  className,
}: {
  segs: Seg[]
  as: 'h1' | 'h2'
  id?: string
  className?: string
}) {
  return (
    <Tag id={id} className={`font-sans font-medium text-ivory ${className ?? ''}`}>
      {segs.map((s, i) =>
        s.em ? (
          // font-normal: Instrument Serif ships 400 only — don't synthesize 500
          <em key={i} className="font-display font-normal italic text-gold">
            {s.text}
          </em>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </Tag>
  )
}
