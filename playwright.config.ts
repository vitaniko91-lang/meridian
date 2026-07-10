import { defineConfig } from '@playwright/test'

// MERIDIAN — end-to-end + a11y suite.
//
// Runs against a PRODUCTION preview, never the dev server: the reduced-motion
// chunk split (main.tsx dynamic imports) and the engine's cold-boot timing only
// exist in the built app, and the dev server's StrictMode double-mount is a
// known contaminant (see docs/spike/verdict.md).
//
// `webServer` builds + previews on :5202, so `npm run e2e` is a SINGLE command.
// It reuses an already-running preview on :5202 (iterate against a warm server)
// and never touches the human's dev preview on :5199.
//
// Backend note: headless Chromium's DEFAULT WebGL2 tier falls back to
// SwiftShader (software raster), whose continuous render loop starves the main
// thread so hard that Playwright's own in-page queries can't even be scheduled
// (`Received: undefined`, then the test times out). `--enable-unsafe-webgpu`
// gives us a HARDWARE Metal-backed WebGPU adapter instead, so the motion specs
// navigate with `?webgpu` (via APP_URL) and stay responsive. `--enable-unsafe-
// swiftshader` remains as the fallback GL context. The default webgl2 tier
// selection is covered by the unit suite (tiers.test.ts) + scripts/bench-*.mjs.

const PORT = 5202
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // WebGL under SwiftShader is CPU/GPU-bound — serial avoids starvation
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 90_000, // generous: WebGPU cold-boot runs ~10s headless
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    // Tracing is OFF by design: it snapshots the DOM + a screenshot on every
    // action, and serialising the live WebGL canvas that often starves the
    // software-raster render loop into the test timeout. The failure page
    // snapshot in test-results/ is captured independently and is enough to
    // diagnose. (Perf is measured by scripts/bench-*.mjs, never here.)
    trace: 'off',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
