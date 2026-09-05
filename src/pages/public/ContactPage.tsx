import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, Ref } from 'react'
import { profile } from '@/data'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { ContactCard } from '@/components/contact/ContactCard'
import {
  Magnetic,
  Marquee,
  Parallax,
  Reveal,
  SectionNumber,
  Stagger,
  TextReveal,
} from '@/motion'
import { cn } from '@/lib/cn'

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'
const SECTION_TITLE =
  'font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink'

/**
 * The address, split across elements.
 *
 * The rendered text is exactly the address — it selects, copies and reads
 * correctly — but the markup a naive `mailto:|[\w.]+@[\w.]+` scraper walks is
 * broken up by element boundaries. It is a speed bump, not a wall, which is all
 * an address published on a portfolio can ever be.
 */
function ObfuscatedEmail({
  value,
  className,
  ref,
}: {
  value: string
  className?: string
  ref?: Ref<HTMLSpanElement>
}) {
  const at = value.indexOf('@')
  if (at < 0) {
    return (
      <span ref={ref} className={className}>
        {value}
      </span>
    )
  }

  return (
    <span ref={ref} className={className}>
      <span>{value.slice(0, at)}</span>
      <span>@</span>
      <span>{value.slice(at + 1)}</span>
    </span>
  )
}

const KHARAGPUR_TIME_ZONE = 'Asia/Kolkata'

function kharagpurTime(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: KHARAGPUR_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
  } catch {
    return date.toLocaleTimeString()
  }
}

/**
 * The wall clock in Kharagpur, ticking once a second. Its own component so the
 * tick re-renders a single span rather than the page.
 */
function LocalClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className={cn('font-mono tabular-nums', className)}>
      <time dateTime={now.toISOString()}>{kharagpurTime(now)}</time> IST
    </span>
  )
}

/** A line of who and where, looping slowly between the two halves of the page. */
function PersonalBand({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="border-y border-line py-5">
      <Marquee speed={60}>
        {items.map((item) => (
          <Fragment key={item}>
            <span className={cn(EYEBROW, 'whitespace-nowrap')}>{item}</span>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
          </Fragment>
        ))}
      </Marquee>
    </div>
  )
}

const MIN_SUBJECT = 3
const MIN_MESSAGE = 12

export default function ContactPage() {
  useDocumentMeta({
    title: 'Contact',
    description: `Ways to reach ${profile.name} — email, GitHub and LinkedIn, plus a message composer that opens in your own mail app.`,
    canonicalPath: PUBLIC_ROUTES.contact,
  })

  const { toast } = useToast()
  const firstName = profile.name.split(' ')[0]

  /* -- copying the address --------------------------------------------- */

  const emailRef = useRef<HTMLSpanElement>(null)
  const copiedTimer = useRef<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  const selectEmail = useCallback(() => {
    const node = emailRef.current
    const selection = typeof window !== 'undefined' ? window.getSelection() : null
    if (!node || !selection) return
    const range = document.createRange()
    range.selectNodeContents(node)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  /*
   * `navigator.clipboard` is unavailable on an insecure origin and can be
   * refused outright by the browser, so the failure path is real rather than a
   * silent no-op: the address is selected in place and the toast says to press
   * Ctrl+C.
   */
  const copyEmail = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(profile.email)
      setCopied(true)
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Copied to clipboard', description: profile.email, tone: 'positive' })
    } catch {
      selectEmail()
      toast({
        title: 'Copy it by hand',
        description:
          'The browser refused clipboard access, so the address is selected — press Ctrl or Cmd + C.',
        tone: 'warning',
        duration: 7000,
      })
    }
  }, [selectEmail, toast])

  /* -- the mailto composer ---------------------------------------------- */

  const [subject, setSubject] = useState(`Hello ${firstName}`)
  const [message, setMessage] = useState('')
  const [touchedSubject, setTouchedSubject] = useState(false)
  const [touchedMessage, setTouchedMessage] = useState(false)

  const subjectError =
    subject.trim().length < MIN_SUBJECT ? 'Give the email a subject line.' : undefined
  const messageError =
    message.trim().length < MIN_MESSAGE
      ? 'Write at least a sentence — this becomes the body of the email.'
      : undefined
  const valid = !subjectError && !messageError

  const composedHref = useMemo(
    () =>
      `mailto:${profile.email}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(
        message.trim(),
      )}`,
    [subject, message],
  )

  const quickHref = `mailto:${profile.email}?subject=${encodeURIComponent(
    `Hello ${firstName} — from your portfolio`,
  )}`

  /*
   * There is no backend, and there is not going to be one: this is a static
   * site on GitHub Pages. So the button does the one honest thing available —
   * it hands the typed subject and body to whatever mail client the machine
   * has, and says so on the label.
   */
  function handOffToMailClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouchedSubject(true)
    setTouchedMessage(true)
    if (!valid) return

    window.location.href = composedHref
    toast({
      title: 'Opening your mail app',
      description: 'Nothing was sent from this page — check the draft, then send it yourself.',
      tone: 'info',
      duration: 6000,
    })
  }

  const emailIsPlaceholder = /@example\.(com|org|net)$/i.test(profile.email)
  const socialsArePlaceholders = profile.socials.some((link) => /your-username/i.test(link.href))
  const unfinished = emailIsPlaceholder || socialsArePlaceholders

  const bandItems = [
    profile.location,
    profile.availability,
    ...profile.socials.filter((link) => link.id !== 'email').map((link) => link.label),
  ].filter((item): item is string => Boolean(item))

  return (
    <div>
      <section aria-labelledby="contact-title" className="pt-20 pb-16 sm:pt-32 sm:pb-24">
        <div className={CONTAINER}>
          <Parallax speed={-0.15}>
            <SectionNumber n={1} label="Contact" />
          </Parallax>

          <TextReveal
            as="h1"
            id="contact-title"
            type="chars"
            className="mt-6 font-display text-[clamp(3rem,11vw,10rem)] leading-[0.9] tracking-tight text-ink"
          >
            Let’s talk.
          </TextReveal>

          <Reveal
            as="p"
            delay={0.5}
            className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-muted"
          >
            Email is the front door. Everything else here goes to the same person, just more
            slowly.
          </Reveal>

          <Reveal delay={0.6} className="mt-10 flex flex-col items-start gap-5">
            <Magnetic strength={0.2}>
              <button
                type="button"
                onClick={() => {
                  void copyEmail()
                }}
                data-cursor="Copy"
                aria-label={`Copy ${profile.email} to the clipboard`}
                className={cn(
                  'group inline-flex max-w-full items-center gap-4 rounded-full border border-line-strong bg-surface py-2.5 pr-2.5 pl-5 text-left',
                  'transition-colors duration-200 hover:border-accent hover:bg-surface-hover sm:gap-6 sm:py-3 sm:pr-3 sm:pl-7',
                )}
              >
                <ObfuscatedEmail
                  ref={emailRef}
                  value={profile.email}
                  className="min-w-0 font-mono text-[clamp(1rem,2.6vw,1.5rem)] leading-tight tracking-tight break-all text-ink select-text"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink',
                    'transition-transform duration-300 ease-out group-hover:-rotate-[8deg] sm:size-12',
                  )}
                >
                  <Icon name={copied ? 'Check' : 'Copy'} size={18} />
                </span>
              </button>
            </Magnetic>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className={EYEBROW}>Usually replies within 24-48 hours</p>
              <p className={EYEBROW}>
                <span aria-hidden="true">·&nbsp;&nbsp;</span>
                Kharagpur <LocalClock className="text-ink" />
              </p>
            </div>

            <Magnetic strength={0.2}>
              <a href={quickHref} className={buttonClasses('secondary', 'lg')} data-cursor="Write">
                <Icon name="Mail" size={18} />
                Write an email
              </a>
            </Magnetic>
          </Reveal>

          {unfinished ? (
            <p className="mt-10 flex items-start gap-2.5 rounded-card border border-dashed border-warning/50 bg-warning-soft/30 px-4 py-3 text-sm leading-relaxed text-ink-muted">
              <Icon name="TriangleAlert" size={16} className="mt-0.5 text-warning" />
              <span>
                <strong className="font-semibold text-ink">Still on the template details.</strong>{' '}
                The address and handles on this page come from{' '}
                <code className="font-mono text-[13px] text-ink">src/data/profile.ts</code> and
                have not been replaced yet, so they will not reach anyone.
              </span>
            </p>
          ) : null}

          <Reveal delay={0.2} className="mt-16 sm:mt-20">
            <dl className="grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
              <div>
                <dt className={EYEBROW}>Based in</dt>
                <dd className="mt-2 text-[15px] text-ink">{profile.location}</dd>
              </div>
              <div>
                <dt className={EYEBROW}>Response time</dt>
                <dd className="mt-2 text-[15px] text-ink">
                  Within 24-48 hours — longer during exam weeks, and I would rather answer properly
                  than quickly.
                </dd>
              </div>
              <div>
                <dt className={EYEBROW}>Best for</dt>
                <dd className="mt-2 text-[15px] text-ink">
                  Internships, collaboration, or a question about anything on this site
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </section>

      <PersonalBand items={bandItems} />

      <section aria-labelledby="contact-elsewhere" className="py-16 sm:py-24">
        <div className={CONTAINER}>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4">
              <Parallax speed={-0.15}>
                <SectionNumber n={2} label="Elsewhere" />
              </Parallax>
              <TextReveal as="h2" id="contact-elsewhere" className={cn(SECTION_TITLE, 'mt-4')}>
                The same person, different front doors.
              </TextReveal>
            </div>

            <Stagger as="ul" className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
              {profile.socials.map((link) => (
                <li key={link.id} className="flex min-w-0">
                  <ContactCard
                    link={link}
                    copyValue={link.id === 'email' ? profile.email : undefined}
                    className="w-full"
                  />
                </li>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <section aria-labelledby="contact-compose" className="pb-24 sm:pb-36">
        <div className={CONTAINER}>
          <div className="grid gap-10 border-t border-line pt-16 lg:grid-cols-12 lg:gap-12 sm:pt-24">
            <div className="lg:col-span-5">
              <Parallax speed={-0.15}>
                <SectionNumber n={3} label="Draft" />
              </Parallax>
              <TextReveal as="h2" id="contact-compose" className={cn(SECTION_TITLE, 'mt-4')}>
                Or draft it here.
              </TextReveal>
              <Reveal
                as="p"
                delay={0.3}
                className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-muted"
              >
                This is a mailto builder, not a contact form. Nothing is submitted anywhere: the
                button hands the draft to your own mail app, and you press send.
              </Reveal>
              <Reveal
                as="p"
                delay={0.4}
                className="mt-6 flex max-w-md items-start gap-2 text-xs leading-relaxed text-ink-faint"
              >
                <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
                <span>
                  No mail app configured? Copy the address at the top of the page and write from
                  wherever you usually do.
                </span>
              </Reveal>
            </div>

            <Reveal delay={0.2} className="lg:col-span-7">
              <div className="surface-card p-6 sm:p-8 lg:p-10">
                <form onSubmit={handOffToMailClient} className="space-y-6" noValidate>
                  <Field
                    label="Subject"
                    required
                    error={touchedSubject ? subjectError : undefined}
                    hint="Prefilled — change it to whatever the email is actually about."
                  >
                    <Input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      onBlur={() => setTouchedSubject(true)}
                      autoComplete="off"
                      maxLength={120}
                    />
                  </Field>

                  <Field
                    label="Message"
                    required
                    error={touchedMessage ? messageError : undefined}
                    hint="Plain text. It becomes the body of the draft."
                  >
                    <Textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onBlur={() => setTouchedMessage(true)}
                      autoGrow
                      rows={6}
                      maxLength={2000}
                      placeholder="Who you are, and what you would like to talk about."
                    />
                  </Field>

                  <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
                    <Magnetic>
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        icon="Send"
                        disabled={!valid}
                        data-cursor="Send"
                      >
                        Open in my mail app
                      </Button>
                    </Magnetic>
                    <p className="text-xs leading-relaxed text-ink-faint" aria-live="polite">
                      {valid
                        ? `Opens a draft to ${profile.email}. Nothing leaves this page until you send it.`
                        : 'Fill in a subject and a message to enable this.'}
                    </p>
                  </div>
                </form>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  )
}
