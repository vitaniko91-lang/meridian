/**
 * Cartographic ornament (Vault Light §5) — a static, zero-motion decorative
 * layer: fixed corner coordinates and a faint meridian globe behind the hero.
 *
 * Pure texture: pointer-events-none, aria-hidden, no state, no JS animation, no
 * CSS animation. It sits ABOVE the canvas (`-z-10`) but BEHIND page content
 * (`-z-[1]`), so the arc reads behind the hero kicker while the copy stays on
 * top. Being motion-free it is safe to mount in AppStatic (reduced-motion) too —
 * it imports nothing from three/gsap/lenis, so the zero-motion-bytes guarantee
 * holds.
 *
 * Header/footer boundary hairlines already exist (SiteHeader `border-b`,
 * SiteFooter `border-t`, both `border-ivory/[0.08]`), so they are NOT duplicated
 * here. The 48.8566° N / 2.3522° E marks are Paris — the historic Paris
 * Meridian, a quiet nod to the brand name. Decorative; hidden from AT.
 */
export default function Ornament() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-[1] overflow-hidden">
      {/* Faint meridian globe behind the hero (upper-left), echoing the logo
          mark — outer circle + two meridian ellipses + one latitude ellipse.
          Sized in vh so it scales with the viewport; ivory strokes at 5–7%. */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className="absolute -left-[9vw] top-[6vh] h-[64vh] w-[64vh] text-ivory"
        preserveAspectRatio="xMidYMid meet"
      >
        <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.25" opacity="0.07" />
        <ellipse cx="50" cy="50" rx="18" ry="48" stroke="currentColor" strokeWidth="0.25" opacity="0.055" />
        <ellipse cx="50" cy="50" rx="34" ry="48" stroke="currentColor" strokeWidth="0.25" opacity="0.045" />
        <ellipse cx="50" cy="50" rx="48" ry="18" stroke="currentColor" strokeWidth="0.25" opacity="0.045" />
        <line x1="50" y1="2" x2="50" y2="98" stroke="currentColor" strokeWidth="0.25" opacity="0.055" />
      </svg>
      {/* Corner coordinates — cartographic marginalia. Placed clear of the HUD
          (fps top-right, timer bottom-left). */}
      <span className="absolute right-6 top-20 font-mono text-[10px] tracking-[0.28em] text-muted/70">
        48.8566° N
      </span>
      <span className="absolute right-6 bottom-6 font-mono text-[10px] tracking-[0.28em] text-muted/70">
        2.3522° E
      </span>
    </div>
  )
}
