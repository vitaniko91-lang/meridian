// src/content/copy.test.ts
import { describe, it, expect } from 'vitest'
import { CHAPTERS, HERO, FOOTER } from './copy'

describe('copy deck', () => {
  it('has exactly 7 chapters in spec order', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      'instant', 'stream', 'routing', 'gate', 'prism', 'settlement', 'paid',
    ])
  })
  it('every chapter carries kicker, headline, body', () => {
    for (const c of CHAPTERS) {
      expect(c.kicker.length).toBeGreaterThan(0)
      expect(c.headline.length).toBeGreaterThan(0)
      expect(c.body.length).toBeGreaterThan(0)
    }
  })
  it('hero hook mentions the 0.4 seconds', () => {
    expect(HERO.headline.map((s) => s.text).join('')).toContain('0.4 seconds')
  })
  it('footer declares the fictional brand', () => {
    expect(FOOTER.credit).toContain('fictional')
  })
})
