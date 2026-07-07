import { Children, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Masked line-reveal — the SINGLE entrance dialect of the site (anti-slop
 * rule): nothing else on the page animates its entrance. Fires ONCE when the
 * block enters the viewport, then unobserves. Each direct child sits inside
 * an overflow-hidden mask and slides up from translate-y-full with a 60ms
 * stagger. transform/opacity ONLY — no other animated properties.
 */
export default function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  // Observer-less environments (SSR, legacy) render children visible.
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect() // fire once, never again
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return (
    <div ref={ref} className={className}>
      {Children.toArray(children).map((child, i) => (
        <div key={i} className="overflow-hidden">
          <div
            className={`transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
              shown ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
            }`}
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            {child}
          </div>
        </div>
      ))}
    </div>
  )
}
