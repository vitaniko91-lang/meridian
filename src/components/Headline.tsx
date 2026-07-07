import type { Seg } from '../content/copy'

/**
 * Renders a copy-deck headline: plain segments in Satoshi 500 ivory,
 * `em` segments in Instrument Serif italic gold (the Vault Light device).
 * Sentence case as written in copy — no uppercase transform, ever.
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
