// src/lib/validate.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ContactInput = { name: string; email: string; message: string }
export type ContactResult = { ok: true } | { ok: false; errors: Partial<Record<keyof ContactInput, string>> }

/**
 * Shared shape between ContactForm.tsx (inline errors) and api/contact.ts
 * (which duplicates this logic — the API is self-contained, no src/ imports).
 */
export function validateContact(input: ContactInput): ContactResult {
  const errors: Partial<Record<keyof ContactInput, string>> = {}

  const name = input.name.trim()
  const email = input.email.trim()
  const message = input.message.trim()

  if (name.length < 1) errors.name = 'Enter your name'
  if (!EMAIL_RE.test(email)) errors.email = "That email doesn't look right"
  if (message.length < 10) errors.message = 'Tell us a little more — at least 10 characters'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true }
}
