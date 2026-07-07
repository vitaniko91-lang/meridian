import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Reduced-motion / zero-3D gate: the motion app (three/gsap/lenis) and the
// static poster shell are BOTH dynamic imports, so the entry chunk carries
// zero motion bytes. Under prefers-reduced-motion the three.js chunk is
// never even fetched (verified via performance resource entries).
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

async function boot() {
  const { default: App } = reduced
    ? await import('./AppStatic') // poster shell, zero three.js bytes
    : await import('./App')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
boot()
