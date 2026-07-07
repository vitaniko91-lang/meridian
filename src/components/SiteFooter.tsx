import { FOOTER } from '../content/copy'

export default function SiteFooter() {
  return (
    <footer className="relative border-t border-ivory/[0.08] px-6 py-16">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted">{FOOTER.credit}</p>
        <nav aria-label="External links">
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {FOOTER.links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  rel={l.href.startsWith('http') ? 'noopener' : undefined}
                  className="font-mono text-xs uppercase tracking-widest text-muted transition-colors duration-200 hover:text-gold focus-visible:text-gold"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
