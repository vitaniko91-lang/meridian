export function createFpsMeter(el: HTMLElement) {
  let frames = 0
  let last = performance.now()
  const samples: number[] = []
  function tick() {
    frames++
    const now = performance.now()
    if (now - last >= 1000) {
      const fps = Math.round((frames * 1000) / (now - last))
      samples.push(fps)
      if (samples.length > 60) samples.shift() // rolling window: last 60s only
      el.textContent = `${fps} fps · p5 ${p5()}`
      frames = 0
      last = now
    }
  }
  function p5() {
    if (!samples.length) return '—'
    const sorted = [...samples].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.05)]
  }
  return { tick, p5 }
}
