/**
 * PostHog, cookieless. `persistence: 'memory'` writes nothing to cookies or
 * storage, so no consent banner is needed; a returning visitor counts as new.
 * EU host keeps the data in the EU. Loaded in its own chunk after first paint;
 * without a key, or outside a production build, nothing is downloaded.
 */
interface Options {
  key: string | undefined
  enabled: boolean
}

const INTERNAL_FLAG = 'vn-internal'
type FlagStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * The owner's own browsers stay out of the numbers: open any page once with
 * `?internal=1` and this browser is remembered (localStorage, this site only);
 * `?internal=0` forgets it. Ordinary visitors never get anything written.
 */
export function isInternalVisitor(search: string, storage: FlagStorage | null): boolean {
  const param = new URLSearchParams(search).get('internal')
  try {
    if (param === '1') storage?.setItem(INTERNAL_FLAG, '1')
    if (param === '0') storage?.removeItem(INTERNAL_FLAG)
    return param === '1' || (param !== '0' && storage?.getItem(INTERNAL_FLAG) === '1')
  } catch {
    return param === '1'
  }
}

function browserStorage(): FlagStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export async function startAnalytics({ key, enabled }: Options): Promise<boolean> {
  if (!key || !enabled) return false
  if (typeof window !== 'undefined' && isInternalVisitor(window.location.search, browserStorage())) {
    return false
  }
  const { default: posthog } = await import('posthog-js')
  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    persistence: 'memory',
    person_profiles: 'identified_only',
    respect_dnt: true,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: { maskAllInputs: true },
    disable_surveys: true,
  })
  return true
}
