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
