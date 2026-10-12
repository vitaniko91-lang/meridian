import { beforeEach, describe, expect, it, vi } from 'vitest'

const init = vi.fn()
vi.mock('posthog-js', () => ({ default: { init } }))

import { startAnalytics } from './analytics'

describe('startAnalytics', () => {
  beforeEach(() => init.mockClear())

  it('does nothing without a key or outside production', async () => {
    expect(await startAnalytics({ key: undefined, enabled: true })).toBe(false)
    expect(await startAnalytics({ key: 'phc_test', enabled: false })).toBe(false)
    expect(init).not.toHaveBeenCalled()
  })

  it('initialises PostHog cookieless on the EU host', async () => {
    expect(await startAnalytics({ key: 'phc_test', enabled: true })).toBe(true)
    expect(init.mock.calls[0][1]).toMatchObject({
      api_host: 'https://eu.i.posthog.com',
      persistence: 'memory',
      respect_dnt: true,
      session_recording: { maskAllInputs: true },
      disable_surveys: true,
    })
  })
})
