const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

// smoothstep at the ends, linear-ish middle — keeps chapters proportional to scroll
export function scrollToNarrative(scrollProgress: number): number {
  const x = clamp01(scrollProgress)
  return x * x * (3 - 2 * x)
}

export function timerLabel(t: number): string {
  return `t = ${(clamp01(t) * 0.4).toFixed(3)}s`
}
