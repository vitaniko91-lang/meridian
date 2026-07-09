import * as THREE from 'three/webgpu'
import type { ChapterAnchor } from './timeline'

/**
 * The narrative route: a CatmullRom spline sampled into 256 equally-spaced
 * points that the particle update kernel reads as a `uniformArray` (UBO).
 *
 * Why not a DataTexture: a uniform array is backend-agnostic by construction —
 * std140 UBO on the WebGL2 transform-feedback path, uniform buffer on WebGPU —
 * with no sampler, no float-filtering features (float32-filterable /
 * OES_texture_float_linear) and no texture-in-compute question at all.
 * Numerically verified on BOTH backends 2026-07-07 (position readback via
 * renderer.getArrayBufferAsync: finite, on-route, full spread).
 *
 * CPU side keeps the curve for the camera rail (`curve.getPointAt`); GPU side
 * reads the same route from `points` — both views stay in sync by construction.
 */
export const ROUTE_SAMPLES = 256

export type Route = {
  curve: THREE.CatmullRomCurve3
  /** ROUTE_SAMPLES equally-spaced points; index i ↔ u = i / (ROUTE_SAMPLES - 1). */
  points: THREE.Vector3[]
}

/** Route progress where chapter i starts (7 equal scroll segments, i = 0..7). */
export const CHAPTER_U = (i: number) => i / 7

/**
 * Camera framing keyframes: hero start + one per chapter end (u = i/7, so
 * chapter i's scroll segment lerps anchor[i-1] → anchor[i]). Composition
 * intent per anchor:
 *  - x pushes the river AWAY from the chapter copy (text left → +x, right → -x;
 *    the far look-target recenters, so a -x camera slide reads as river-left)
 *  - y/z control how low/far the ribbon rides — text pins at top 22vh, the
 *    ribbon belongs in the lower half at every viewport width
 *  - lookAhead flattens (raises) or steepens (drops) the run-out
 * Tuned visually 2026-07-08 against the 3-width Playwright matrix (p3t1-*).
 */
export const CHAPTER_ANCHORS: ChapterAnchor[] = [
  { id: 'hero', u: CHAPTER_U(0), camOffset: [2.4, 3.4, 6.2], lookAhead: 0.14 },
  { id: 'instant', u: CHAPTER_U(1), camOffset: [0.8, 2.1, 6.0], lookAhead: 0.05 },
  // stream y=2.6 is a verified local optimum for the ROUTING frame (the near
  // arm it governs is angle-pinned: y 2.35 and 3.0 both push it INTO the copy)
  { id: 'stream', u: CHAPTER_U(2), camOffset: [0.3, 2.6, 6.0], lookAhead: 0.05 },
  { id: 'routing', u: CHAPTER_U(3), camOffset: [2.2, 2.2, 7.0], lookAhead: 0.045 },
  { id: 'gate', u: CHAPTER_U(4), camOffset: [-1.6, 1.3, 7.0], lookAhead: 0.045 },
  // prism y raised: drops the dispersion spray below the chapter metric line
  { id: 'prism', u: CHAPTER_U(5), camOffset: [2.6, 2.1, 7.5], lookAhead: 0.045 },
  // settlement y=4.2 drops the lattice band below the PAID chapter copy too
  // (the paid frame blends settlement→paid framing)
  { id: 'settlement', u: CHAPTER_U(6), camOffset: [-4.6, 4.2, 8.5], lookAhead: 0.05 },
  // Paid/contact: camera HIGH above the tail pitched steeply down — the tail
  // band threads the 1920 contact-form corridor (between the EMAIL and MESSAGE
  // boxes) and the PAID chapter copy stays fully clear. The u=1 lookAt≡route
  // end always projects to exact screen center, so ~the end cluster + a thin
  // band near it are geometrically pinned to the center row at t=1; Tasks 2-4
  // kernel windows fade the river past PAID, which removes that residue.
  { id: 'paid', u: CHAPTER_U(7), camOffset: [-3.75, 12, 18.75], lookAhead: 0.06 },
]

/**
 * Portrait (aspect < 1) framing overrides: the narrow viewport is a
 * center-crop of the landscape composition, which drags the ribbon across
 * the (now full-width) copy. Portrait copy owns the TOP half of the frame at
 * every chapter, so every portrait anchor raises the camera (bigger +y) —
 * near-field river drops into the lower half, below the full-width text.
 * Tuned against the 768×1024 + 375×812 Playwright matrix (p3t1-*).
 */
const PORTRAIT_OVERRIDES: Record<string, Pick<ChapterAnchor, 'camOffset' | 'lookAhead'>> = {
  // Hero rides very high (y 10.5) + max lookAhead: drops the ribbon out of the
  // 15px sub-copy at both 768/1024 and 375/812; the remaining headline
  // crossing is dim-fringe and stays legible (bold 800 white over speckle).
  hero: { camOffset: [-0.8, 10.5, 6.6], lookAhead: 0.2 },
  // instant lookAhead 0.12 pitches the view up just enough to sink the near
  // crest below the STREAM chapter's copy block (near-field responds to
  // lookAhead, NOT to camera height — height responses invert for near arms)
  instant: { camOffset: [0.8, 4.2, 6.0], lookAhead: 0.12 },
  stream: { camOffset: [0.5, 6.0, 10], lookAhead: 0.17 },
  routing: { camOffset: [-1.5, 8.5, 12], lookAhead: 0.06 },
  gate: { camOffset: [-3.0, 6.5, 7.5], lookAhead: 0.1 },
  prism: { camOffset: [0.0, 6.5, 7.5], lookAhead: 0.1 },
  settlement: { camOffset: [-2.0, 6.6, 11.5], lookAhead: 0.05 },
  // Portrait paid: much farther pull-back than landscape — at portrait the
  // contact form is near-full-width and screen center (≡ the pinned t=1 look
  // target) falls between the EMAIL and MESSAGE boxes; the extra distance
  // compresses the tail into a thin line that threads that corridor.
  paid: { camOffset: [-9, 23.75, 38], lookAhead: 0.06 },
}

export const CHAPTER_ANCHORS_PORTRAIT: ChapterAnchor[] = CHAPTER_ANCHORS.map((a) =>
  PORTRAIT_OVERRIDES[a.id] ? { ...a, ...PORTRAIT_OVERRIDES[a.id] } : a,
)

// Designed 7-chapter route (replaces the Plan-1 spike S-curve): one control
// point per narrative beat, x sweeping left→right so route-u tracks screen
// travel, y/z undulating for the braid/fork/basin drama. The tail DIPS
// (cp7 y=-2.2) so the contact-section vista approaches the route end from
// BELOW screen center — keeps the ribbon out of the contact form fields
// (at t=1 lookAt≡route end, which always projects to exact screen center).
const CONTROL_POINTS = [
  new THREE.Vector3(-26, -3.5, 0), // ch1 The Instant — darkness; sunk below the hero camera so the near-ribbon rises INTO frame clear of the sub-copy at narrow viewports
  new THREE.Vector3(-18, 2, -3), // ch2 The Stream — river reveal, wide
  new THREE.Vector3(-9, -1.5, 3), // ch3 Routing — braided fork region
  new THREE.Vector3(-1, 2.5, -2), // ch4 The Gate — lens plane
  new THREE.Vector3(7, -1, 2.5), // ch5 The Prism — dispersion window (u≈0.62)
  new THREE.Vector3(15, -0.5, -1), // ch6 Settlement — lattice basin (kept low so the paid pull-back's behind-route can't tower over the camera)
  new THREE.Vector3(26.1, -2.2, 0.4), // ch7 Paid — low vista run-out
  new THREE.Vector3(27, -4.2, -4.1), // finish dives down-away roughly along the paid-anchor view ray so the end cluster foreshortens toward a pip at screen center (route end ≡ look target at t=1; the steeper tuned paid pitch leaves a short whisker). Tasks 2-4 kernel windows fade the river out past PAID, which removes the residual pip/whisker over the contact form.
]

// Single shared curve instance: the CPU camera rail (curve.getPointAt) and the
// GPU route points (getSpacedPoints) both derive from it, and LATTICE_ORIGIN
// below reads it at chapter 6 — one source of truth, no drift by construction.
const curve = new THREE.CatmullRomCurve3(CONTROL_POINTS)

/**
 * Centre of the Settlement crystal lattice (Plan-3 Task 4). The route point at
 * the start of chapter 6 (Settlement) — arc-length parametrised, so it matches
 * the camera rail's own `getPointAt` sampling. Exported so the engine can seed
 * the river's `uLatticeOrigin` uniform once and tests can assert it tracks the
 * curve. Read at module load (triggers the curve's arc-length LUT once).
 */
export const LATTICE_ORIGIN: THREE.Vector3 = curve.getPointAt(CHAPTER_U(6))

export function createRoute(): Route {
  const points = curve.getSpacedPoints(ROUTE_SAMPLES - 1)
  return { curve, points }
}
