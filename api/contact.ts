// Vercel serverless function. SELF-CONTAINED — zero imports from ../src
// (PRAXIS lesson: api/ and src/ ship as separate bundles; sharing code
// across that boundary has broken before). Validation logic below is a
// deliberate duplicate of src/lib/validate.ts, not a shared import.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'Bad JSON' })
    }
  }
  const { name = '', email = '', message = '' } = body ?? {}
  const bad = (m: string) => res.status(400).json({ error: m })
  if (!String(name).trim()) return bad('name')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return bad('email')
  if (String(message).trim().length < 10) return bad('message')

  const key = process.env.RESEND_API_KEY
  if (key) {
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
  } else {
    console.log('[meridian contact]', { name, email, message })
  }
  return res.status(200).json({ ok: true })
}
