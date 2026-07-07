import { describe, expect, it } from 'vitest'
import { nextInQueue } from './sweep'

const queue = ['?sweep&count=250000', '?sweep&count=500000', '?sweep&webgl&count=150000']

describe('nextInQueue', () => {
  it('returns the next entry when current is found', () => {
    expect(nextInQueue('?sweep&count=250000', queue)).toBe('?sweep&count=500000')
    expect(nextInQueue('?sweep&count=500000', queue)).toBe('?sweep&webgl&count=150000')
  })

  it('returns null when current is the last entry (sweep complete)', () => {
    expect(nextInQueue('?sweep&webgl&count=150000', queue)).toBeNull()
  })

  it('recovers to the first entry when current is not in the queue', () => {
    expect(nextInQueue('?sweep&count=999', queue)).toBe('?sweep&count=250000')
  })

  it('returns null for an empty queue', () => {
    expect(nextInQueue('?sweep&count=250000', [])).toBeNull()
  })
})
