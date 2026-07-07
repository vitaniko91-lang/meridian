// Reduced-motion shell: same <main> layout as App, but a static CSS-gradient
// poster instead of the canvas. MUST NOT import three/gsap/lenis (directly or
// transitively) — the whole point of the main.tsx gate is that this path
// downloads zero motion bytes. Placeholder poster; real poster art in Plan 2.
export default function AppStatic() {
  return (
    <main className="h-[400lvh]">
      <div
        aria-hidden="true"
        className="fixed inset-0 h-[100lvh] w-full bg-[radial-gradient(120%_90%_at_50%_110%,rgba(232,194,117,0.20)_0%,rgba(232,194,117,0.06)_38%,#0B0A08_72%)]"
      />
      <div className="fixed left-3 top-3 font-mono text-xs text-[#8A8071]">static</div>
      <div aria-hidden="true" className="fixed bottom-3 left-3 font-mono text-sm text-[#E8C275]">
        t = 0.000s
      </div>
    </main>
  )
}
