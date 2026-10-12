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

export async function startAnalytics({ key, enabled }: Options): Promise<boolean> {
  if (!key || !enabled) return false
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
