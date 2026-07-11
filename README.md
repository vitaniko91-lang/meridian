# MERIDIAN

> What happens in the 0.4 seconds between "pay" and "paid"?

**Live:** https://meridian-settlement.vercel.app

Award-showpiece particle-river site for MERIDIAN, a fictional B2B
payment-infrastructure brand (payments as light) — a scroll-driven narrative
that slows a single payment four thousand times across seven chapters. Built on
three.js r185 TSL on webgl2-first tiers, prism dispersion, Lenis+ScrollTrigger
narrative time, with a reduced-motion zero-3D fallback. Not a real company — a
design/engineering showpiece by Vitalina Nikulina.

- Deploy record + live smoke + launch checklist: [docs/spike/deploy.md](docs/spike/deploy.md)
- Verdict + measured tiers + root-cause log: [docs/spike/verdict.md](docs/spike/verdict.md)
- Design spec: [2026-07-06-meridian-showpiece-design.md](../../docs/superpowers/specs/2026-07-06-meridian-showpiece-design.md)

## Commands

- `npm run dev` — dev server (StrictMode; NOT for benchmarking)
- `npm test` — vitest logic suites (timeline, tiers, overrides, route, windows)
- `npm run e2e` — Playwright end-to-end + a11y suite (builds + previews on :5202
  via `webServer`, then runs `e2e/*.spec.ts`; one command, no manual server)
- `npm run build` — `tsc -b` + vite build
- `npm run lint` — oxlint
- `npm run preview` — production preview
- `npm run bench:serve` — production preview on :5199 for `scripts/bench.mjs`

## Deployment

Vercel is git-connected to this repo: a push to `main` auto-builds and deploys to
the live URL above. No manual deploy step.

## Dev instruments

- Query overrides: `?count` `?dpr` `?webgl` `?webgpu` `?scale` `?alpha`
- `?debug` — reveals the fps meter (top-right) + backend label (top-left). Off by
  default (they're decoration; the label is kept in the DOM but `hidden`).
- `scripts/bench.mjs` — unattended **steady-state** fps matrix (camera parked).
  Run against a **production preview** (`npm run build && npm run bench:serve`),
  never the dev server.
- `scripts/bench-scroll.mjs` — **scroll-motion** fps: measures fps while the
  narrative is scrubbed top→bottom (the true worst case). Same cold protocol —
  read the header comment before trusting a number.

The old in-page `?sweep` overlay was removed in Plan 3 (it had a hidden-throttle
sampling bug and is superseded by the two `scripts/bench-*.mjs` instruments).

## Load-bearing constraints

1. **Never two engines on one canvas.** On webgl2 a disposed engine's `loseContext()`
   kills the GL context it shares with the survivor (StrictMode whiteout, root-caused
   2026-07-07) — engine creation is `setTimeout(0)`-deferred in `App.tsx`.
2. **Never recreate rivers on a live renderer.** `instancedArray` storage buffers are
   freed only by `renderer.dispose()`; a tier switch on a live renderer leaks the old buffers.
3. **`AppStatic.tsx` must never import three/gsap/lenis** (directly or transitively) —
   it is the zero-3D reduced-motion path; the gate in `main.tsx` depends on it.
4. **Scroll harness is single-instance** (`initScroll` guards, warns, and returns a
   no-op disposer on double-init) — it mutates global gsap ticker state.

Conscious leftovers, not bugs: AppStatic's `400lvh` scroll length is a placeholder
until the Plan 2 poster decides; `createFpsMeter`'s `p5` readout and `River.positions`
are documented debug/readback surfaces.
