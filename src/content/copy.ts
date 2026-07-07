// src/content/copy.ts
export type Seg = { text: string; em?: boolean }
export type Chapter = {
  id: 'instant' | 'stream' | 'routing' | 'gate' | 'prism' | 'settlement' | 'paid'
  kicker: string          // uppercase micro-label, includes the narrative timestamp
  headline: Seg[]
  body: string
  metric?: string         // mono callout line
  side: 'left' | 'right'  // which edge the text block hugs (center stays for the river)
}

export const HERO = {
  kicker: 'MERIDIAN — SETTLEMENT INFRASTRUCTURE',
  headline: [
    { text: 'What happens in the ' },
    { text: '0.4 seconds', em: true },
    { text: ' between pay and paid?' },
  ] as Seg[],
  sub: 'Meridian is the settlement layer for global finance. This is the journey of a single payment — slowed four thousand times.',
  cue: 'Scroll to slow time',
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'instant', side: 'left',
    kicker: 't = 0.000s · THE INSTANT',
    headline: [{ text: 'A payment is born as ' }, { text: 'light.', em: true }],
    body: 'Somewhere, someone taps “pay”. Before the receipt, before the ledger, there is only intent — one particle of value, released into the dark.',
  },
  {
    id: 'stream', side: 'right',
    kicker: 't = 0.008s · INITIATION',
    headline: [{ text: 'One payment is ' }, { text: 'never alone.', em: true }],
    body: 'Within milliseconds it joins the stream: tens of thousands of transactions enter Meridian every second, each one a particle in the same river of value.',
    metric: '41,000 tx/s sustained',
  },
  {
    id: 'routing', side: 'left',
    kicker: 't = 0.050s · ROUTING',
    headline: [{ text: 'Every particle ' }, { text: 'knows its way.', em: true }],
    body: 'The routing engine weighs cost, liquidity and latency across every open corridor — and commits your payment to the fastest safe path in under four milliseconds.',
    metric: '38 clearing corridors · 4 ms route decision',
  },
  {
    id: 'gate', side: 'right',
    kicker: 't = 0.120s · THE GATE',
    headline: [{ text: 'Trust is a ' }, { text: 'filter,', em: true }, { text: ' not a wall.' }],
    body: 'Every particle passes the lens. Risk is scored in flight — no queues, no batch reviews. The rare impostor deflects into the cold; the stream never slows.',
    metric: '99.96% pass in-flight · zero replay windows',
  },
  {
    id: 'prism', side: 'left',
    kicker: 't = 0.180s · THE PRISM',
    headline: [{ text: 'Currency is just ' }, { text: 'wavelength.', em: true }],
    body: 'Conversion is not an exchange desk — it is refraction. Your payment enters as one currency, bends through mid-market at the instant of crossing, and leaves as another. Same value. New light.',
    metric: '214 currencies · one beam',
  },
  {
    id: 'settlement', side: 'right',
    kicker: 't = 0.390s · SETTLEMENT',
    headline: [{ text: 'Finality is a ' }, { text: 'crystal.', em: true }],
    body: 'The stream condenses into the ledger lattice. Every particle locks — atomically, irreversibly, in the same instant. Yours snaps into place last, exactly where it was always going.',
    metric: 'Atomic finality · T+0',
  },
  {
    id: 'paid', side: 'left',
    kicker: 't = 0.400s · PAID',
    headline: [{ text: '0.4 seconds. ' }, { text: 'Paid.', em: true }],
    body: 'Time resumes. The receipt arrives, unremarkable as sunrise. Behind it, the mesh carries on — forty-one thousand more journeys already in flight.',
    metric: '99.999% uptime · 41k tx/s · 214 currencies · T+0',
  },
]

export const CTA = {
  headline: [{ text: 'Build on ' }, { text: 'Meridian.', em: true }] as Seg[],
  body: 'Rails for banks, platforms and treasuries that measure settlement in milliseconds, not days.',
  button: 'Talk to us',
}

export const FOOTER = {
  credit: 'MERIDIAN is a fictional brand. Designed & built by Vitalina Nikulina.',
  links: [
    { label: 'Portfolio', href: 'https://vitaniko91-lang.github.io/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/vitalina-nikulina-0a3088215/' },
    { label: 'Email', href: 'mailto:vita.niko91@gmail.com' },
  ],
}
