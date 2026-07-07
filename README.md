# MERIDIAN — engine spike

Award-showpiece particle-river engine spike for MERIDIAN, a fictional B2B
payment-infrastructure brand (payments as light). Plan 1 proves the engine —
three.js r185 TSL on webgl2-first tiers, prism dispersion, Lenis+ScrollTrigger
narrative time, reduced-motion zero-3D gate — before any art direction lands.

- Verdict + measured tiers + root-cause log: [docs/spike/verdict.md](docs/spike/verdict.md)
- Design spec: [2026-07-06-meridian-showpiece-design.md](../../docs/superpowers/specs/2026-07-06-meridian-showpiece-design.md)

## Commands

- `npm run dev` — dev server (StrictMode; NOT for benchmarking)
- `npm test` — vitest logic suites (timeline, tiers, overrides, sweep)
- `npm run build` — `tsc -b` + vite build
- `npm run lint` — oxlint
- `npm run preview` — production preview
- `npm run bench:serve` — production preview on :5199 for `scripts/bench.mjs`

## Dev instruments

- Query overrides: `?count` `?dpr` `?webgl` `?webgpu` `?scale` `?alpha`
- `?sweep` — in-page fps sweep. KNOWN BUG: a hidden-throttled ~0.2fps sample can
  be saved past the `document.hidden` guard. Superseded by bench.mjs; fix-or-delete in Plan 3.
- `scripts/bench.mjs` — unattended fps matrix. Run against a **production preview**
  (`npm run build && npm run bench:serve`), never the dev server.

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
