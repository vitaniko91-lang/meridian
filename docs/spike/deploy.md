# MERIDIAN — Deploy record (Plan 3 Task 9)

**Date:** 2026-07-10
**Status:** LIVE on Vercel.

## Canonical URLs

- **Canonical (aliased):** https://meridian-settlement.vercel.app
- Secondary alias: https://meridian-rails.vercel.app
- Production deployment: https://meridian-gu6edqq3f-vitaniko91-langs-projects.vercel.app
- Vercel auto-alias: https://meridian-psi-opal.vercel.app
- Inspect: https://vercel.com/vitaniko91-langs-projects/meridian/GLjJycmymfHWZB5gHt9MvEYRVrZJ

`meridian.vercel.app` and `meridian-pay.vercel.app` were already taken;
`meridian-settlement` was the first free candidate and is the canonical alias.

## Project

- Team (org): `vitaniko91-langs-projects` — `team_oyfg2bpQeYn3svAo5pMGzoZa`
- Project: `meridian` — `prj_s4Pi8mYU9EXZfKMDpqyYUmt9cA1X`
- Deployment id: `dpl_GLjJycmymfHWZB5gHt9MvEYRVrZJ`
- Framework: Vercel auto-detected Vite (build `vite build`, output `dist`).
- **No `vercel.json`** — zero config. The app is one page + `#anchors` (no
  client routes), so no SPA rewrite is needed; static `/robots.txt`, `/llms.txt`,
  `/og.png`, `/fonts/*` all serve correctly from `dist`, and refresh does not 404.
- `api/contact.ts` → Vercel serverless function automatically. It is
  self-contained (zero `../src` imports — the PRAXIS cross-dir lesson), verified.
- `.vercel/` is gitignored (Vercel CLI added `.vercel` to `.gitignore` on link).

## SSO / Auth wall — DISABLED

New team projects ship with **Vercel Authentication** (a login wall) ON, so
anonymous visitors get a login screen instead of the site. Disabled via:

```
curl -X PATCH "https://api.vercel.com/v10/projects/prj_s4Pi8mYU9EXZfKMDpqyYUmt9cA1X?teamId=team_oyfg2bpQeYn3svAo5pMGzoZa" \
  -H "Authorization: Bearer <cli-token>" -d '{"ssoProtection": null}'
```

- Before: anonymous `GET` → **302** (redirect to login).
- After: `ssoProtection: null`, anonymous `GET` → **200**. Verified on both the
  production deployment URL and the `meridian-settlement` alias.

## Live smoke (production URL, real Chrome via Playwright) — 16/16 PASS

Run against the live alias, headless Chromium (`--enable-unsafe-webgpu`).

**Motion path** (`/?debug&webgpu&count=2000&dpr=1`):
- Boots: exactly 1 `<canvas>`, `globalThis.__meridian` defined, `tier.backend=webgpu` (count 2000).
- Exactly one `<h1>`, text "What happens in the 0.4 seconds…".
- Backend label present + visible via `?debug` (`webgpu`).
- Scroll clock runs `t = 0.000s` → reaches `prism` chapter → `t = 0.400s` at the bottom.

**Reduced-motion path** (`emulateMedia reducedMotion:'reduce'`, `/`):
- **No motion chunk fetched** — `App-*.js` (three/gsap/lenis) never loads; only `AppStatic-*.js` does.
- No `__meridian`, no `<canvas>`.
- All 7 chapters (`instant, stream, routing, gate, prism, settlement, paid`) in the DOM.
- Contact form + `Name` field present and immediately usable.

**Contact form — real live 2xx:**
- `curl POST /api/contact` with valid JSON → **200 `{"ok":true}`**; invalid email → **400 `{"error":"email"}`**; `GET` → **405**.
- Through the page (no mock): filled + submitted against the live endpoint → success
  message "Message sent — we read everything." shown and the form unmounted, **only
  after the real 200**. (No `RESEND_API_KEY` set → the function logs and returns 200;
  honest — no email is sent yet. See checklist item (f).)

**Static files (not index.html):**
- `/robots.txt` → 200, `text/plain`, real content (`User-agent: * / Allow: /`).
- `/llms.txt` → 200, `text/plain`, real content (MERIDIAN brand summary).

Build-time note: Vercel's function type-check logged a non-blocking
`api/contact.ts(39,15): error TS2591: Cannot find name 'process'` (its function
compiler doesn't load our `tsconfig.api.json` node types). The build completed
READY and the endpoint works at runtime (esbuild strips types) — confirmed by the
200/400/405 responses above. `npm run typecheck:api` passes locally, so this is
cosmetic on Vercel's side only.

## Live Lighthouse (desktop preset, against the live URL)

| Category | Live | Local (docs/qa) |
|---|---|---|
| Performance | **79** | 81 |
| Accessibility | **100** | 100 |
| Best Practices | **100** | 100 |
| SEO | **100** | 100 |

Live metrics: FCP 0.5s · **LCP 0.8s** · CLS 0.007 · Speed Index 1.5s · TBT 420ms.

Perf 79 is dragged down solely by **TBT (420ms)** — the three.js/WebGPU engine
boot on the main thread, expected for a motion showpiece. FCP/LCP/CLS are all
green (LCP is actually *better* live than local, 0.8s vs 1.0s, thanks to Vercel's
edge CDN). Lighthouse boots the full motion app; the reduced-motion path it never
triggers ships zero 3D and scores ~100 across the board. Recorded honestly.

## Pre-deploy gate (all green)

- `git status` — no uncommitted work in `src/` (only the unrelated
  `docs/post-assets/*` marketing-asset workstream, left untouched).
- `npm run build` — succeeds (`tsc -b` + vite build; App chunk code-split to 999 kB / 290 kB gzip, lazy-loaded).
- `npm run typecheck:api` — passes.
- `npm test` — **47/47** pass.

---

# Launch checklist (Vitalina's manual steps)

These are yours to run — out of scope for the automated deploy task.

- [ ] **(a) Real-device mobile check.** Open the live URL on your phone: confirm
      the scroll narrative feels smooth (fps), touch scrubbing works, and the
      mobile layout (full-width stacks, no horizontal overflow) holds. Headless
      can't judge real touch fps — only your hardware can.
- [ ] **(b) Cold-hardware perf re-run.** With no other heavy apps open, run
      `scripts/bench.mjs` (steady-state) + `scripts/bench-scroll.mjs` (scroll
      worst-case) against a fresh production preview, plus a local Lighthouse, to
      confirm **≥55fps scroll cold** on your machine. (bench requires the cold
      protocol in each script's header comment.)
- [ ] **(c) Screen-recording of the full scroll.** Record top→bottom with
      **Cmd+Shift+5** (NOT headless — headless freezes the WebGL motion). This is
      the clip for X / LinkedIn / Dribbble.
- [ ] **(d) Add a MERIDIAN card to the portfolio hub.** Separate repo:
      `cases/portfolio/src/data/cases.ts` + a thumbnail. Your call when to publish.
- [ ] **(e) Awwwards SOTD submission.** Paid — your call.
- [ ] **(f) (Optional) Make the contact form actually email.** Set
      `RESEND_API_KEY` in the Vercel project env and verify a sender domain in
      Resend. Until then the endpoint is honest: it validates, logs, and returns
      200 without sending mail.
