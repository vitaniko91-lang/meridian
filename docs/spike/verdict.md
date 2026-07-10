# Engine spike verdict — MERIDIAN Plan 1

**Date:** 2026-07-07
**Decision:** GATE PASSED. Engine direction confirmed: three.js r185 TSL, **webgl2-first tiers**, WebGPU behind `?webgpu` opt-in. Prism dispersion: **GO**. Proceed to Plan 2 (art direction + chapters) on this engine.

---

## 1. Gate numbers

Production preview, real Chrome, unattended playwright bench (`scripts/bench.mjs`), MacBook Air M-series, cold.

| Config | fps (avg/low) | Verdict |
|---|---|---|
| **webgl2 300k @ dpr2 (default tier)** | **60/60** | **GATE PASSED** |
| webgl2 500k | 31/26 | over budget |
| webgpu 300k | 40/35 | under webgl2 at same count |
| webgpu 500k | 28/25 | |
| webgpu 1M | 14/13 | |

**Final tiers:**

- Desktop: **webgl2 300k @ dpr2**
- Mobile: **webgl2 100k @ dpr1.5** (unmeasured, conservative)
- WebGPU tiers behind `?webgpu`: 1M / 300k

**CAVEAT (thermal):** scroll-time fps and late-session numbers are thermally contaminated — the Air heat-soaks; idle fps varied 60→32→43 with no code change. Definitive scroll-under-load fps needs a cold single-run protocol → Plan 3 QA. This is also the live argument for spec §11 adaptive quality.

![Default tier: webgl2 300k @ dpr2 particle river](river-default-tier.png)

## 2. Prism: GO (Vitalina, 2026-07-07)

- Spectral fan reads as optics: hue-ordered, widening + re-converging.
- Strictly window-local (pixel-probed outside the window: zero spectral leakage).
- Hero conversion (gold → currency color) persists after the window.
- Backends identical (webgl2 vs webgpu).
- **Tuning carry-forward:** fan core saturates white at high counts — saturation / window-alpha knob → Plan 3 art pass.

![Prism dispersion: hue-ordered spectral fan at the route window](prism-01-dispersion.png)

![Hero particle converted to the new currency color past the window](prism-02-hero-converted.png)

## 3. Root-cause log

1. **three r185 WebGPU backend: large fixed per-frame overhead on this hardware.** 50k=60fps → 100k=41fps — barely count-sensitive, i.e. the cost is per-frame, not per-particle. Consequence: webgl2-first tiers. Re-bench future three versions via `?webgpu`.
2. **React StrictMode double-mount killed the shared WebGL2 context.** The aborted engine's `WebGLBackend.dispose()` → `loseContext()` destroyed the surviving engine's shared canvas context (permanent whiteout). This invalidated all early "webgl2" benches — they were rAF on a dead canvas. Fixed via `setTimeout(0)`-deferred engine creation (see `src/App.tsx`). WebGPU was immune only because each renderer owns a separate GPUDevice.

## 4. TSL r185 drift log (for Plans 2–3)

- npm `three` ships no HTML examples — use source + `examples/jsm`.
- `THREE.TSL.ShaderNodeObject` doesn't exist → use `THREE.ComputeNode` / typed `UniformNode`.
- Particle drawable = `THREE.Sprite` + `.count` (not InstancedMesh).
- Route delivery via `uniformArray` (256 vec3 → padded vec4, 4KB UBO) works on both backends; `texture()`-in-compute was never exercised.
- `deltaTime` & `time` are renderGroup uniforms updated once per rAF BEFORE the loop callback → compute and render see identical values within a frame.
- WebGPU storage readback: vec3 padded to 16 bytes (stride 4).

## 5. Reduced-motion / zero-3D gate (this task)

`src/main.tsx` gates on `matchMedia('(prefers-reduced-motion: reduce)')` and dynamic-imports either `App` (motion) or `AppStatic` (poster shell). Verified on the production build:

- Chunk graph: three lives only in the `App-*.js` chunk (~993 KB / 287 KB gzip), reachable **only** via dynamic `import()`; entry chunk is React-only (~192 KB / 61 KB gzip), no modulepreload of the App chunk.
- Runtime (Chrome `--force-prefers-reduced-motion`, production preview): `performance.getEntriesByType('resource')` shows entry + `AppStatic-*.js` only — the three chunk is **never fetched**. Without the flag: canvas + `globalThis.__meridian` (`webgl2`, 300k) appear.
- `AppStatic.tsx` is a placeholder poster (CSS gradient); real poster art → Plan 2.

![Reduced-motion poster shell — zero three.js bytes fetched](reduced-motion-poster.png)

## 6. Instruments in repo

- `scripts/bench.mjs` — unattended fps matrix; run against the production preview.
- `?sweep` in-page instrument — **KNOWN BUG:** a hidden-throttled 0.2fps sample is saved past the `document.hidden` guard. Superseded by bench.mjs; fix-or-delete in Plan 3.
- Query overrides: `?count` `?dpr` `?webgl` `?webgpu` `?scale` `?alpha`.

## 7. Scroll-feel carry-forward (Task 6 review)

Slidey inertia = stacked exponential smoothers: Lenis lerp 0.1 (τ≈167ms) × engine tSmooth (τ≈270ms) ≈ 1.3s settle. Plan 3 levers, in impact order:

1. Remove one smoothing layer OR raise Lenis lerp to 0.15–0.2.
2. Consider Lenis duration+easing mode for deterministic chapter beats.
3. `wheelMultiplier`.
4. `syncTouch: true` for mobile.
5. Note: `scrollToNarrative` smoothstep compounds top/bottom slowness deliberately.

## 8. Process lesson

**Compiling ≠ working.** Every GPU change needs numeric readback + screenshot self-check — the Task 5 whiteout passed tsc, tests, and build while rendering a dead canvas.

---

## Mobile (Plan 3 Task 6 — emulation, NOT device truth)

Verified via playwright-core device emulation (isMobile + hasTouch → `matchMedia('(pointer: coarse)')` true) at 375×812, 390×844, 412×915, 768×1024. All numbers below are **indicative** — headless render on a dev laptop, DPR-capped, thermally/host-contaminated. They are NOT a real-device measurement.

### Tier that loads (emulated)
Every mobile viewport selected the **mobile tier: `webgl2` / 100 000 particles / dpr 1.5**, confirmed by reading `__meridian.tier.{backend,count}` in-page (not inferred). The crystal at 100k (compact lattice, Task 5) still reads as a cube. No WebGPU on mobile — the mobile tier is webgl2 by construction, so "both backends" is a desktop-only concern.

### What was verified (in emulation)
- **Layout / legibility.** Every chapter's kicker + headline + body + metric is clear of the river band and the settlement/paid crystal at 375 **and** 390, at the section-top snapshot **and** ~mid-runway (the sticky reading window). The binding case was peak-1's **stream reveal**, whose band sweeps up ~300px mid-runway; a static per-anchor offset that clears the snapshot did not clear the dwell, so the stream anchors carry the strongest look-bias. 412 and 768 also clean. Evidence: `scratchpad/p3t6final-{w}-{frame}.png` (matrix) + `p3t6c5*` (tuning).
- **No horizontal overflow.** `document.documentElement.scrollWidth == innerWidth` at every frame, all four widths (375/390/412/768). Copy blocks are `max-w-[480px]`, full-width with `px-6` below the `md` breakpoint; nothing exceeds the viewport.
- **Touch scroll (`syncTouch`).** Emulated touch swipes (CDP `Input.dispatchTouchEvent`) advance `window.scrollY` (0→2882px over 6 swipes), narrative `uT` (0→0.259), and the on-screen timer (`t = 0.000s` → `t = 0.114s`). Scroll is Lenis-eased, not hijacked/locked — it tracks the swipe. Evidence: `scratchpad/p3t6-touch.mjs`.
- **Pointer flow-field on touch — DECISION.** `pointermove` **does** fire for touch in Chromium (`pointerType: "touch"`); the engine's existing `pointermove` handler updated `river.uPointer` from a touch drag (`[0,0,999]→[-4.5,8.9,0]`, raycast onto the z=0 plane). So the finger perturbs the river during touch scroll as a gentle bonus. **No `touchmove` handler was added** — it would be redundant.

### The mobile fix (framing lever)
The river ribbon tracks screen center (the `lookAt` target), so on a narrow full-width-copy screen it always crossed the metric row. Camera-Y / lookAhead only slide it around the text column. Added `lookYOffset` to the camera framing (`timeline.ts` `ChapterAnchor`/`Framing`, applied in `engine.ts` before `lookAt`) — it raises the aim above the route so screen center sits above the river, sinking the whole band **uniformly** below the copy without tilt. Portrait-only in practice (landscape anchors omit it → 0). Per-anchor values in `route.ts` `PORTRAIT_OVERRIDES`. Canvas is `fixed -z-10` (behind all copy), so this was always a contrast concern (gold speckle behind the gold metric), never occlusion — the fix keeps the bright band out from behind the text.

### Indicative emulated fps
`fps · p5<5th-percentile-low>` HUD, ~6s warmup, deviceScaleFactor 2 (render dpr capped to 1.5):
- 390×844 (100k): ~57–60 fps steady; p5-low 28 (warmup dip).
- 768×1024 (100k): ~50–60 fps steady; p5-low 48.

### ⚠ MUST verify on a real device before Awwwards submission
DPR-capped fps in headless emulation is **not** device truth (spec §11 adaptive-quality argument still stands; the Plan-1 thermal caveat too). Before submission, Vitalina must open the live site on a **real phone** and confirm: (1) sustained fps under scroll on a mid-range handset (the 100k tier is conservative but unmeasured on-device); (2) touch-scroll feel (Lenis syncTouch momentum vs native); (3) legibility in daylight; (4) no thermal throttling over a full scroll-through. This is a manual step — emulation covered layout, legibility, overflow, and touch-plumbing only.
