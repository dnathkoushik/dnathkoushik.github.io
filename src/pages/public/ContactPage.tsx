import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { profile } from '@/data'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { Button, ButtonLink, buttonClasses } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { ContactCard } from '@/components/contact/ContactCard'

/**
 * The address, split across elements.
 *
 * The rendered text is exactly the address — it selects, copies and reads
 * correctly — but the markup a naive `mailto:|[\w.]+@[\w.]+` scraper walks is
 * broken up by element boundaries. It is a speed bump, not a wall, which is all
 * an address published on a portfolio can ever be.
 */
function ObfuscatedEmail({ value, className }: { value: string; className?: string }) {
  const at = value.indexOf('@')
  if (at < 0) return <span className={className}>{value}</span>

  return (
    <span className={className}>
      <span>{value.slice(0, at)}</span>
      <span>@</span>
      <span>{value.slice(at + 1)}</span>
    </span>
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

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <PageHeader
        eyebrow="Contact"
        title="Get in touch"
        description="Email is the front door. Everything else here goes to the same person, just more slowly."
        actions={
          <ButtonLink to={PUBLIC_ROUTES.projects} variant="secondary" icon="FolderGit2">
            See the projects
          </ButtonLink>
        }
      />

      {unfinished ? (
        <p className="mt-8 flex items-start gap-2.5 rounded-card border border-dashed border-warning/50 bg-warning-soft/30 px-4 py-3 text-sm leading-relaxed text-ink-muted">
          <Icon name="TriangleAlert" size={16} className="mt-0.5 text-warning" />
          <span>
            <strong className="font-semibold text-ink">Still on the template details.</strong> The
            address and handles below come from{' '}
            <code className="font-mono text-[13px] text-ink">src/data/profile.ts</code> and have not
            been replaced yet, so they will not reach anyone.
          </span>
        </p>
      ) : null}

      <section aria-labelledby="contact-email" className="mt-10 animate-rise">
        <Card>
          <CardHeader>
            <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
              <Icon name="Mail" size={20} />
            </span>
            <CardTitle as="h2" id="contact-email" className="pt-1">
              Email
            </CardTitle>
            <CardDescription>
              The best way to reach me. I read it every day and usually reply within a day or two —
              longer during exam weeks, and I would rather answer properly than quickly.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <ObfuscatedEmail
              value={profile.email}
              className="block font-mono text-lg font-medium break-all text-ink sm:text-xl"
            />

            <div className="flex flex-wrap items-center gap-3">
              <a href={quickHref} className={buttonClasses('primary', 'lg')}>
                <Icon name="Mail" size={18} />
                Write an email
              </a>
              <p className="text-xs text-ink-faint">
                Opens your own mail app with the subject filled in.
              </p>
            </div>

            <dl className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                  Response time
                </dt>
                <dd className="mt-1 text-sm text-ink-muted">Usually within 24-48 hours</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                  Based in
                </dt>
                <dd className="mt-1 text-sm text-ink-muted">{profile.location}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                  Best for
                </dt>
                <dd className="mt-1 text-sm text-ink-muted">
                  Internships, collaboration, or a question about anything on this site
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="contact-elsewhere" className="mt-14 animate-rise">
        <SectionHeading
          id="contact-elsewhere"
          title="Elsewhere"
          description="The same person, different front doors."
        />
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {profile.socials.map((link) => (
            <li key={link.id} className="flex">
              <ContactCard
                link={link}
                copyValue={link.id === 'email' ? profile.email : undefined}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="contact-compose" className="mt-14 animate-rise">
        <SectionHeading
          id="contact-compose"
          title="Or draft it here"
          description="This is a mailto builder, not a contact form. Nothing is submitted anywhere: the button hands the draft to your own mail app, and you press send."
        />

        <Card className="mt-6">
          <CardContent>
            <form onSubmit={handOffToMailClient} className="space-y-5" noValidate>
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
                  rows={5}
                  maxLength={2000}
                  placeholder="Who you are, and what you would like to talk about."
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary" icon="Send" disabled={!valid}>
                  Open in my mail app
                </Button>
                <p className="text-xs text-ink-faint" aria-live="polite">
                  {valid
                    ? `Opens a draft to ${profile.email}. Nothing leaves this page until you send it.`
                    : 'Fill in a subject and a message to enable this.'}
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
          <Icon name="Info" size={13} className="mt-0.5" />
          <span>
            No mail app configured? Copy the address from the card above and write from wherever you
            usually do.
          </span>
        </p>
      </section>
    </div>
  )
}
