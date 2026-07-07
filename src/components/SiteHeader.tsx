/**
 * Fixed top bar. Flat per house style — hairline only, no blur, no backdrop.
 * `solid` paints the vault ground behind it — the reduced-motion page flows
 * text naturally under the header, so a transparent bar would jumble with
 * scrolling copy. The full app keeps the default (transparent over canvas).
 */
export default function SiteHeader({ solid = false }: { solid?: boolean }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-ivory/[0.08] px-6 py-5 ${
        solid ? 'bg-vault' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        {/* mark: gold arc with a meridian line — the token owns the color */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-gold">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" />
          <ellipse cx="8" cy="8" rx="3" ry="6.5" stroke="currentColor" strokeWidth="1" />
        </svg>
        <span className="font-sans text-sm font-medium tracking-[0.18em] text-ivory">MERIDIAN</span>
      </div>
      <a
        href="#contact"
        className="font-mono text-xs uppercase tracking-widest text-gold transition-colors duration-200 hover:text-ivory"
      >
        Talk to us
      </a>
    </header>
  )
}
