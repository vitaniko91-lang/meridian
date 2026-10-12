import { describe, expect, it } from 'vitest'
import { isInternalVisitor } from './analytics'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

describe('isInternalVisitor', () => {
  it('is false for an ordinary visitor and stores nothing', () => {
    const storage = memoryStorage()
    expect(isInternalVisitor('', storage)).toBe(false)
    expect(storage.getItem('vn-internal')).toBeNull()
  })

  it('?internal=1 marks this browser, and the mark survives later visits', () => {
    const storage = memoryStorage()
    expect(isInternalVisitor('?internal=1', storage)).toBe(true)
    expect(isInternalVisitor('', storage)).toBe(true)
  })

  it('?internal=0 clears the mark', () => {
    const storage = memoryStorage()
    isInternalVisitor('?internal=1', storage)
    expect(isInternalVisitor('?internal=0', storage)).toBe(false)
    expect(isInternalVisitor('', storage)).toBe(false)
  })

  it('still honours ?internal=1 when storage is unavailable', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(isInternalVisitor('?internal=1', throwing)).toBe(true)
    expect(isInternalVisitor('', throwing)).toBe(false)
    expect(isInternalVisitor('', null)).toBe(false)
  })
})
