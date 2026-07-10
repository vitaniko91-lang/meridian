/**
 * MERIDIAN scroll-driven soundscape — fully synthesized (Web Audio), no audio
 * files, in the spirit of the generated particle engine. "A Swiss observatory at
 * night": quiet, tonal, precise — never a whoosh library.
 *
 * Two layers:
 *  1. Ambient bed — three detuned drones through a lowpass whose cutoff + gain
 *     follow scroll velocity. Still ≈ silence; moving = the stream breathes.
 *  2. Chapter tones — a soft synthesized bell at each chapter arrival. The arc
 *     rises then resolves: sparse low → fuller → brighter → the Prism blooms a
 *     spectral chord → Settlement a crystalline lock → Paid a warm low resolve.
 *
 * Autoplay-safe: the AudioContext is created + resumed lazily on the first
 * update() (which only fires from a real scroll = user activation). Respects a
 * mute toggle; the caller starts it muted under prefers-reduced-motion.
 */

// Narrative-time (uT) points where each chapter's copy + visual beat arrive on
// screen — measured from the live camera rail (section-top scroll positions).
// A tone fires once per upward crossing of each. Index ↔ chapter 1..7.
const TONE_AT = [0.027, 0.13, 0.287, 0.473, 0.662, 0.829, 0.95]

type ToneSpec = { partials: number[]; peak: number; attack: number; decay: number }

// Per-chapter bell voicings. Inharmonic-ish partials give a struck-metal timbre;
// the fundamental sequence is a gentle rising line resolving down at Paid.
const TONES: ToneSpec[] = [
  { partials: [146.83], peak: 0.05, attack: 0.01, decay: 2.6 }, // 1 Instant — D3, a single point of light in the dark
  { partials: [220, 330], peak: 0.06, attack: 0.012, decay: 2.4 }, // 2 Stream — A3+E4, the river arrives, fuller
  { partials: [261.63, 392], peak: 0.055, attack: 0.012, decay: 2.2 }, // 3 Routing — C4+G4
  { partials: [329.63, 415.3], peak: 0.05, attack: 0.008, decay: 1.8 }, // 4 Gate — E4+G#4, a touch tense/bright
  { partials: [392, 493.88, 587.33, 739.99], peak: 0.05, attack: 0.02, decay: 3.4 }, // 5 Prism — spectral chord bloom
  { partials: [880, 1174.66, 1567.98], peak: 0.045, attack: 0.004, decay: 1.1 }, // 6 Settlement — crystalline high lock
  { partials: [110, 164.81, 220], peak: 0.06, attack: 0.02, decay: 4.5 }, // 7 Paid — low warm resolve, "unremarkable as sunrise"
]

// Bed drone frequencies (A1 sub, E2 fifth, A2 warmth) — a hollow open-fifth pad.
const BED_FREQS = [55, 82.41, 110]

export type Audio = {
  /** Feed each scroll frame: narrative time t ∈ [0,1] and raw px/s scroll velocity. */
  update(t: number, velocity: number): void
  /** Flip mute; returns the new muted state. Fades, never hard-cuts. */
  toggleMute(): boolean
  isMuted(): boolean
  dispose(): void
}

export function createAudio(initialMuted: boolean): Audio {
  let muted = initialMuted
  let ctx: AudioContext | null = null
  let master: GainNode | null = null // overall fade (mute)
  let bedGain: GainNode | null = null // velocity-driven presence
  let bedFilter: BiquadFilterNode | null = null // velocity-driven brightness
  let bus: GainNode | null = null // tones + bed feed here → reverb + dry → compressor
  let lastT = 0
  let started = false

  // A short procedural reverb impulse — exponential-decay stereo noise. Cheap,
  // gives the observatory a sense of stone space without shipping an IR file.
  function makeImpulse(context: AudioContext, seconds: number, decay: number) {
    const rate = context.sampleRate
    const length = Math.floor(rate * seconds)
    const impulse = context.createBuffer(2, length, rate)
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return impulse
  }

  function build() {
    if (started) return
    started = true
    ctx = new AudioContext()

    // Gentle limiter so stacked tones + bed never clip the low master ceiling.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 4
    comp.attack.value = 0.006
    comp.release.value = 0.25

    master = ctx.createGain()
    master.gain.value = 0 // fade in below
    comp.connect(master)
    master.connect(ctx.destination)

    bus = ctx.createGain()
    bus.gain.value = 1
    // dry
    bus.connect(comp)
    // wet reverb tail
    const convolver = ctx.createConvolver()
    convolver.buffer = makeImpulse(ctx, 1.4, 2.2)
    const wet = ctx.createGain()
    wet.gain.value = 0.28
    bus.connect(convolver)
    convolver.connect(wet)
    wet.connect(comp)

    // Ambient bed → lowpass → bedGain → bus
    bedFilter = ctx.createBiquadFilter()
    bedFilter.type = 'lowpass'
    bedFilter.frequency.value = 200
    bedFilter.Q.value = 0.7
    bedGain = ctx.createGain()
    bedGain.gain.value = 0.0001
    bedFilter.connect(bedGain)
    bedGain.connect(bus)
    BED_FREQS.forEach((f, i) => {
      const osc = ctx!.createOscillator()
      osc.type = i === 0 ? 'triangle' : 'sine'
      osc.frequency.value = f
      osc.detune.value = (i - 1) * 4 // a few cents of spread for a living pad
      const g = ctx!.createGain()
      g.gain.value = i === 0 ? 0.5 : 0.32
      osc.connect(g)
      g.connect(bedFilter!)
      osc.start()
    })

    // Fade the master up to the (low) ceiling once running.
    master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.4)
  }

  function ring(spec: ToneSpec) {
    if (!ctx || !bus) return
    const now = ctx.currentTime
    spec.partials.forEach((f, i) => {
      const osc = ctx!.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ctx!.createGain()
      // higher partials quieter (natural bell rolloff)
      const p = spec.peak / (1 + i * 0.6)
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(p, now + spec.attack)
      g.gain.exponentialRampToValueAtTime(0.0001, now + spec.attack + spec.decay)
      osc.connect(g)
      g.connect(bus!)
      osc.start(now)
      osc.stop(now + spec.attack + spec.decay + 0.05)
    })
  }

  return {
    update(t, velocity) {
      if (muted) {
        lastT = t
        return
      }
      if (!started) build()
      if (ctx && ctx.state === 'suspended') void ctx.resume() // we're inside a scroll gesture

      // Velocity → bed presence + brightness (smoothed so it glides, not jerks).
      const v = Math.min(1, Math.abs(velocity) / 2000)
      if (ctx && bedGain && bedFilter) {
        bedGain.gain.setTargetAtTime(0.02 + v * 0.075, ctx.currentTime, 0.3)
        bedFilter.frequency.setTargetAtTime(200 + v * 900, ctx.currentTime, 0.25)
      }

      // Chapter tones on upward crossings (scrolling forward through time).
      for (let i = 0; i < TONE_AT.length; i++) {
        const thr = TONE_AT[i]
        if (lastT < thr && t >= thr) ring(TONES[i])
      }
      lastT = t
    },
    toggleMute() {
      muted = !muted
      if (!muted && !started) build()
      if (ctx && master) {
        if (ctx.state === 'suspended') void ctx.resume()
        master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.15)
      }
      return muted
    },
    isMuted() {
      return muted
    },
    dispose() {
      if (ctx) {
        if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
        const c = ctx
        setTimeout(() => void c.close(), 200)
      }
      ctx = null
      started = false
    },
  }
}
