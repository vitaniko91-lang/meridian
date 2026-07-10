/**
 * Fixed top bar. Flat per house style — hairline only, no blur, no backdrop.
 * `solid` paints the vault ground behind it — the reduced-motion page flows
 * text naturally under the header, so a transparent bar would jumble with
 * scrolling copy. The full app keeps the default (transparent over canvas).
 */
type SoundControl = { muted: boolean; onToggle: () => void }

export default function SiteHeader({
  solid = false,
  sound,
}: {
  solid?: boolean
  /** When present (motion app only), renders a sound mute toggle before the CTA. */
  sound?: SoundControl
}) {
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
      <div className="flex items-center gap-6">
        {sound && (
          <button
            type="button"
            onClick={sound.onToggle}
            aria-pressed={!sound.muted}
            aria-label={sound.muted ? 'Enable sound' : 'Mute sound'}
            className="text-muted transition-colors duration-200 hover:text-gold"
          >
            {/* three rising bars — filled when on, hairline when muted */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-current">
              <rect x="1.5" y="9" width="2" height="4" rx="0.5" fill="currentColor" opacity={sound.muted ? 0.4 : 1} />
              <rect x="6" y="5.5" width="2" height="7.5" rx="0.5" fill="currentColor" opacity={sound.muted ? 0.4 : 1} />
              <rect x="10.5" y="2.5" width="2" height="10.5" rx="0.5" fill="currentColor" opacity={sound.muted ? 0.4 : 1} />
              {sound.muted && <line x1="1" y1="15" x2="15" y2="1" stroke="currentColor" strokeWidth="1" />}
            </svg>
          </button>
        )}
        <a
          href="#contact"
          className="font-mono text-xs uppercase tracking-widest text-gold transition-colors duration-200 hover:text-ivory"
        >
          Talk to us
        </a>
      </div>
    </header>
  )
}
