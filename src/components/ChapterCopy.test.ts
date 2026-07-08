import { describe, it, expect } from 'vitest'
import ChapterCopy from './ChapterCopy'
import type { Chapter } from '../content/copy'

// Contract test — ChapterCopy MUST return a keyed ARRAY (not a fragment):
// Reveal staggers its direct children via Children.toArray, which flattens
// arrays but cannot see through an element or fragment. ChapterSection
// depends on calling it as a plain function. No DOM needed: we inspect the
// returned ReactElement[] directly (vitest env is node).

const base: Chapter = {
  id: 'instant',
  side: 'left',
  kicker: 't = 0.000s · THE INSTANT',
  headline: [{ text: 'A payment is born as ' }, { text: 'light.', em: true }],
  body: 'Somewhere, someone taps pay.',
}

describe('ChapterCopy contract', () => {
  it('returns 4 keyed elements when the chapter has a metric', () => {
    const out = ChapterCopy({ c: { ...base, metric: '41,000 tx/s sustained' } })
    expect(Array.isArray(out)).toBe(true)
    expect(out).toHaveLength(4)
    expect(out.map((el) => el.key)).toEqual(['kicker', 'headline', 'body', 'metric'])
  })

  it('returns 3 keyed elements when the chapter has no metric', () => {
    const out = ChapterCopy({ c: base })
    expect(Array.isArray(out)).toBe(true)
    expect(out).toHaveLength(3)
    expect(out.map((el) => el.key)).toEqual(['kicker', 'headline', 'body'])
  })
})
