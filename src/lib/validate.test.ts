import { describe, it, expect } from 'vitest'
import { validateContact } from './validate'

describe('validateContact', () => {
  it('accepts a valid submission', () => {
    expect(validateContact({ name: 'Ada', email: 'ada@bank.com', message: 'We move money and need faster rails.' }))
      .toEqual({ ok: true })
  })
  it('rejects bad email', () => {
    const r = validateContact({ name: 'Ada', email: 'not-an-email', message: 'Long enough message here.' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.email).toBeTruthy()
  })
  it('rejects empty fields', () => {
    const r = validateContact({ name: '', email: '', message: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(['name', 'email', 'message']))
  })
  it('rejects short message', () => {
    const r = validateContact({ name: 'Ada', email: 'ada@bank.com', message: 'hi' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.message).toBeTruthy()
  })
})
