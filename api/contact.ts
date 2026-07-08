// Vercel serverless function. SELF-CONTAINED — zero imports from ../src
// (PRAXIS lesson: api/ and src/ ship as separate bundles; sharing code
// across that boundary has broken before). Validation logic below is a
// deliberate duplicate of src/lib/validate.ts, not a shared import.
// Typechecked by tsconfig.api.json (strict, node types) via `tsc -b`.

// Minimal structural types for the Vercel Node runtime — intentionally local
// (no @vercel/node dep) and narrowed to exactly what this handler touches.
type VercelRequest = {
  method?: string
  body?: unknown
}
type VercelResponse = {
  status(code: number): VercelResponse
  json(payload: unknown): void
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'Bad JSON' })
    }
  }
  const record: Record<string, unknown> =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const name = String(record.name ?? '').trim()
  const email = String(record.email ?? '').trim()
  const message = String(record.message ?? '').trim()

  const bad = (m: string) => res.status(400).json({ error: m })
  if (!name) return bad('name')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('email')
  if (message.length < 10) return bad('message')

  const key = process.env.RESEND_API_KEY
  if (key) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'MERIDIAN <onboarding@resend.dev>',
          to: 'vita.niko91@gmail.com',
          subject: `MERIDIAN contact — ${name}`,
          text: `${name} <${email}>\n\n${message}`,
        }),
      })
      if (!r.ok) return res.status(502).json({ error: 'Mail relay failed' })
    } catch {
      // network throw (DNS, TLS, timeout) must not surface as an unhandled 500
      return res.status(502).json({ error: 'Mail relay failed' })
    }
  } else {
    console.log('[meridian contact]', { name, email, message })
  }
  return res.status(200).json({ ok: true })
}
