const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

// smoothstep at the ends, linear-ish middle — keeps chapters proportional to scroll
export function scrollToNarrative(scrollProgress: number): number {
  const x = clamp01(scrollProgress)
  return x * x * (3 - 2 * x)
}

// Chapter starts per spec §3 (7 equal scroll segments → 8 anchors).
// The clock is deliberately non-linear: it crawls through The Instant,
// sprints toward Settlement — time dilation made legible.
export const TIME_ANCHORS = [0, 0.008, 0.05, 0.12, 0.18, 0.39, 0.3996, 0.4] as const

// Maps narrative progress t (equal 1/7 scroll chapters) to the spec's
// non-linear in-story clock, piecewise-linear between chapter anchors.
export function narrativeSeconds(t: number): number {
  const x = clamp01(t) * 7
  const i = Math.min(Math.floor(x), 6)
  const f = x - i
  return TIME_ANCHORS[i] + (TIME_ANCHORS[i + 1] - TIME_ANCHORS[i]) * f
}

export function timerLabel(t: number): string {
  return `t = ${narrativeSeconds(t).toFixed(3)}s`
}

/**
 * One camera-framing keyframe on the route. Defined here (not route.ts) so the
 * type stays importable without pulling three — this module must remain pure
 * (AppStatic constraint: no three/gsap/lenis in the reduced-motion graph).
 */
export type ChapterAnchor = {
  id: string
  /** Route progress 0..1 where this framing peaks (chapter starts, u = i/7). */
  u: number
  /** Camera offset from the route point, world units [x, y, z]. */
  camOffset: [number, number, number]
  /** How far ahead along the route (in u) the camera looks. */
  lookAhead: number
}

export type Framing = { camOffset: [number, number, number]; lookAhead: number }

/**
 * Piecewise-linear camera framing between chapter anchors by route progress u
 * — same pattern as narrativeSeconds, but keyed on each anchor's own u so it
 * tolerates non-uniform spacing. Clamps outside [first.u, last.u].
 */
export function lerpAnchors(u: number, anchors: readonly ChapterAnchor[]): Framing {
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  if (u <= first.u) return { camOffset: [...first.camOffset], lookAhead: first.lookAhead }
  if (u >= last.u) return { camOffset: [...last.camOffset], lookAhead: last.lookAhead }
  // >= so an exact anchor hit lands at f=0 (returns that anchor's values
  // exactly — no float drift from x + (y-x)*1). Guarded by the clamps above.
  let i = 0
  while (u >= anchors[i + 1].u) i++
  const a = anchors[i]
  const b = anchors[i + 1]
  const f = (u - a.u) / (b.u - a.u)
  const lp = (x: number, y: number) => x + (y - x) * f
  return {
    camOffset: [
      lp(a.camOffset[0], b.camOffset[0]),
      lp(a.camOffset[1], b.camOffset[1]),
      lp(a.camOffset[2], b.camOffset[2]),
    ],
    lookAhead: lp(a.lookAhead, b.lookAhead),
  }
}
