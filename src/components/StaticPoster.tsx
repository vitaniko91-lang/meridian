/**
 * Reduced-motion hero visual: the vault ground + a static golden ribbon that
 * echoes the route S-curve (enters left-center, dips, rises to the right),
 * with the hero particle frozen near its start. Pure SVG — no canvas, no
 * filters: the glow is three layered strokes of the same path at increasing
 * width / decreasing opacity. MUST stay free of motion imports.
 */

// One sweeping S-bezier, C1-smooth at the joint (S reflects the previous
// control point). Overshoots the viewBox on both sides so the ribbon reads
// as passing through the frame, not drawn inside it.
const RIBBON = 'M -40 430 C 280 330, 480 640, 780 520 S 1240 260, 1480 230'

// On-path point at t=0.2 of the first cubic — the frozen hero particle.
const DOT = { x: 139.4, y: 412.5 }

export default function StaticPoster() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* Vault radial ground — same gradient device as the canvas backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_110%,color-mix(in_srgb,var(--color-gold)_20%,transparent)_0%,color-mix(in_srgb,var(--color-gold)_6%,transparent)_38%,var(--color-vault)_72%)]" />
      <svg
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        {/* layered strokes: widest/faintest first, crisp core last */}
        <path d={RIBBON} fill="none" stroke="var(--color-gold)" strokeWidth="40" opacity="0.05" />
        <path d={RIBBON} fill="none" stroke="var(--color-gold)" strokeWidth="14" opacity="0.12" />
        <path d={RIBBON} fill="none" stroke="var(--color-gold)" strokeWidth="2" opacity="0.9" />
        {/* the payment, frozen at t = 0.000s: gold halo, white-hot core */}
        <circle cx={DOT.x} cy={DOT.y} r="10" fill="var(--color-gold)" opacity="0.18" />
        <circle cx={DOT.x} cy={DOT.y} r="5" fill="var(--color-gold)" opacity="0.5" />
        <circle cx={DOT.x} cy={DOT.y} r="3" fill="var(--color-ivory)" />
      </svg>
    </div>
  )
}
