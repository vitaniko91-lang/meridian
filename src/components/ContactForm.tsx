import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CTA } from '../content/copy'
import { validateContact, type ContactInput } from '../lib/validate'

type Errors = Partial<Record<keyof ContactInput, string>>

const FIELD_ORDER: (keyof ContactInput)[] = ['name', 'email', 'message']

const INPUT_CLASS =
  'w-full rounded-none border border-ivory/[0.15] bg-transparent px-4 py-3 text-ivory placeholder:text-muted/60 focus:border-gold/60'
const LABEL_CLASS = 'mb-2 block font-mono text-[11px] uppercase tracking-[0.22em] text-muted'
// Error text stays ivory (≥4.5:1 AA on vault); steel carries the "cold" signal
// as a decorative 1px left border only — steel TEXT on vault is ~3.6:1 and the
// spec palette reserves steel for the Gate particles anyway.
const ERROR_CLASS = 'border-l border-steel pl-3 text-sm text-ivory/85'
const FIELD_ERROR_CLASS = `mt-2 ${ERROR_CLASS}`

/**
 * Contact form. Validates on submit, clears per-field errors on edit.
 * Success is shown ONLY after a 2xx from /api/contact — never optimistically.
 */
export default function ContactForm() {
  const [values, setValues] = useState<ContactInput>({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const inputRefs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  }
  const confirmRef = useRef<HTMLDivElement>(null)

  // After a real 2xx the form unmounts — move focus to the confirmation so
  // keyboard/AT users aren't left on a node that no longer exists.
  useEffect(() => {
    if (status === 'sent') confirmRef.current?.focus()
  }, [status])

  function onChange(field: keyof ContactInput, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Single normalize step: the SAME trimmed values feed validation and the
    // POST body, so client and API always agree (API re-trims — defense in depth).
    const normalized: ContactInput = {
      name: values.name.trim(),
      email: values.email.trim(),
      message: values.message.trim(),
    }
    const result = validateContact(normalized)
    if (!result.ok) {
      setErrors(result.errors)
      setStatus('idle') // clear any stale failure message — new attempt, new slate
      const firstInvalid = FIELD_ORDER.find((f) => result.errors[f])
      if (firstInvalid) inputRefs[firstInvalid].current?.focus()
      return
    }

    setErrors({})
    setStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
      })
      setStatus(res.ok ? 'sent' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="mt-8">
      {status !== 'sent' && (
        <form noValidate onSubmit={onSubmit}>
          <div>
            <label htmlFor="contact-name" className={LABEL_CLASS}>
              Name
            </label>
            <input
              ref={inputRefs.name}
              id="contact-name"
              type="text"
              autoComplete="name"
              className={INPUT_CLASS}
              value={values.name}
              onChange={(e) => onChange('name', e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'contact-name-err' : undefined}
            />
            {errors.name && (
              <p id="contact-name-err" className={FIELD_ERROR_CLASS}>
                {errors.name}
              </p>
            )}
          </div>

          <div className="mt-6">
            <label htmlFor="contact-email" className={LABEL_CLASS}>
              Email
            </label>
            <input
              ref={inputRefs.email}
              id="contact-email"
              type="email"
              autoComplete="email"
              className={INPUT_CLASS}
              value={values.email}
              onChange={(e) => onChange('email', e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'contact-email-err' : undefined}
            />
            {errors.email && (
              <p id="contact-email-err" className={FIELD_ERROR_CLASS}>
                {errors.email}
              </p>
            )}
          </div>

          <div className="mt-6">
            <label htmlFor="contact-message" className={LABEL_CLASS}>
              Message
            </label>
            <textarea
              ref={inputRefs.message}
              id="contact-message"
              rows={5}
              className={INPUT_CLASS}
              value={values.message}
              onChange={(e) => onChange('message', e.target.value)}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={errors.message ? 'contact-message-err' : undefined}
            />
            {errors.message && (
              <p id="contact-message-err" className={FIELD_ERROR_CLASS}>
                {errors.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="mt-8 bg-gold px-8 py-4 font-mono text-xs uppercase tracking-widest text-vault transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : CTA.button}
          </button>
        </form>
      )}

      {/* Persistent aria-live region, mounted from first render — success/failure
          text is swapped into it rather than mounted fresh, so screen readers
          reliably announce the update (a freshly-mounted live region can be missed). */}
      <div ref={confirmRef} tabIndex={-1} aria-live="polite">
        {status === 'sent' && (
          <p className="text-[15px] leading-relaxed text-ivory/85">Message sent — we read everything.</p>
        )}
        {status === 'failed' && (
          <p className={`${ERROR_CLASS} mt-4`}>Something went wrong on our side — email us instead.</p>
        )}
      </div>
    </div>
  )
}
