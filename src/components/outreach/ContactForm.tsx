import { useId, useState } from 'react'
import type { Contact, ContactWarmth } from '@/types'
import type { ContactInput } from '@/services/contracts'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { useCompanies, useContactMap } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { WARMTH_META } from '@/utils/outreach'

export interface ContactFormProps {
  open: boolean
  onClose: () => void
  /** Present when editing; absent when creating. */
  contactId?: string
  /** Pre-fills a new contact, e.g. `{ companyId }` from a company's page. */
  defaults?: Partial<ContactInput>
  /** Called with the saved record's id, after the toast. */
  onSaved?: (id: string) => void
}

interface Values {
  name: string
  /** '' means no company. */
  companyId: string
  role: string
  email: string
  linkedinUrl: string
  warmth: ContactWarmth
  notes: string
}

interface Errors {
  name?: string
  email?: string
  linkedinUrl?: string
}

const WARMTHS: ContactWarmth[] = ['cold', 'warm', 'referral', 'alumni']

function emptyValues(defaults?: Partial<ContactInput>): Values {
  return {
    name: defaults?.name ?? '',
    companyId: defaults?.companyId ?? '',
    role: defaults?.role ?? '',
    email: defaults?.email ?? '',
    linkedinUrl: defaults?.linkedinUrl ?? '',
    warmth: defaults?.warmth ?? 'cold',
    notes: defaults?.notes ?? '',
  }
}

function valuesOf(contact: Contact): Values {
  return {
    name: contact.name,
    companyId: contact.companyId ?? '',
    role: contact.role ?? '',
    email: contact.email ?? '',
    linkedinUrl: contact.linkedinUrl ?? '',
    warmth: contact.warmth,
    notes: contact.notes ?? '',
  }
}

function optional(value: string): string | undefined {
  const text = value.trim()
  return text ? text : undefined
}

/** Loose on purpose: one @, something either side. Typos are the owner's to catch. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normaliseUrl(value: string): string | undefined | null {
  const text = value.trim()
  if (!text) return undefined
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  try {
    const parsed = new URL(withScheme)
    if (!parsed.hostname.includes('.')) return null
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Create or edit a person. The company picker lists archived companies too —
 * a contact can outlive an account you have stopped pursuing.
 */
export function ContactForm({ open, onClose, contactId, defaults, onSaved }: ContactFormProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()
  const contact = useContactMap().get(contactId ?? '')
  const companies = useCompanies(true)
  const formId = `contact-form-${useId()}`

  const [values, setValues] = useState<Values>(() =>
    contact ? valuesOf(contact) : emptyValues(defaults),
  )
  const [errors, setErrors] = useState<Errors>({})

  const session = open ? (contact?.id ?? `new:${defaults?.companyId ?? ''}`) : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setValues(contact ? valuesOf(contact) : emptyValues(defaults))
      setErrors({})
    }
  }

  const patch = (next: Partial<Values>) => setValues((prev) => ({ ...prev, ...next }))

  const handleSubmit = () => {
    const name = values.name.trim()
    const email = values.email.trim()
    const nextErrors: Errors = {}

    if (!name) nextErrors.name = 'Who is this? A name is the one thing a contact needs.'
    if (email && !EMAIL_RE.test(email)) {
      nextErrors.email = 'That does not look like an email address.'
    }
    const linkedinUrl = normaliseUrl(values.linkedinUrl)
    if (linkedinUrl === null) {
      nextErrors.linkedinUrl = 'Paste the full profile URL, or leave it empty.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const input: ContactInput = {
      name,
      companyId: values.companyId || undefined,
      role: optional(values.role),
      email: email || undefined,
      linkedinUrl: linkedinUrl ?? undefined,
      warmth: values.warmth,
      notes: optional(values.notes),
    }

    if (contact) {
      actions.updateContact(contact.id, input)
      toast({ title: 'Contact updated', description: name })
      onClose()
      onSaved?.(contact.id)
      return
    }

    const created = actions.addContact(input)
    toast({
      title: 'Contact added',
      description: `${name} is in your list. Compose when you have a hook.`,
      tone: 'positive',
    })
    onClose()
    onSaved?.(created.id)
  }

  const warmthHint = WARMTH_META[values.warmth].hint

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={contact ? 'Edit contact' : 'New contact'}
      description={
        contact
          ? 'Keep the record current — warmth changes as the conversation does.'
          : 'A person at (or near) a company you are pursuing.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="Check">
            {contact ? 'Save changes' : 'Add contact'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
        className="flex flex-col gap-4 pb-1"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name}>
            <Input
              value={values.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="Priya Raman"
              autoComplete="off"
            />
          </Field>

          <Field label="Role">
            <Input
              value={values.role}
              onChange={(event) => patch({ role: event.target.value })}
              placeholder="Engineering Manager, Platform"
              autoComplete="organization-title"
            />
          </Field>
        </div>

        <Field label="Company" hint="Optional. Archived companies are listed too.">
          <Select
            value={values.companyId}
            onChange={(event) => patch({ companyId: event.target.value })}
          >
            <option value="">No company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
                {company.archived ? ' (archived)' : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Warmth" hint={warmthHint}>
          <SegmentedControl<ContactWarmth>
            ariaLabel="Warmth"
            value={values.warmth}
            onChange={(warmth) => patch({ warmth })}
            options={WARMTHS.map((warmth) => ({ value: warmth, label: WARMTH_META[warmth].label }))}
            className="w-full"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email}>
            <Input
              type="email"
              inputMode="email"
              value={values.email}
              onChange={(event) => patch({ email: event.target.value })}
              placeholder="priya@northwind.example.com"
              autoComplete="off"
            />
          </Field>

          <Field label="LinkedIn" error={errors.linkedinUrl}>
            <Input
              type="url"
              inputMode="url"
              value={values.linkedinUrl}
              onChange={(event) => patch({ linkedinUrl: event.target.value })}
              placeholder="linkedin.com/in/…"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="Notes" hint="Where you met, what they care about, anything to reference next time.">
          <Textarea
            autoGrow
            rows={3}
            value={values.notes}
            onChange={(event) => patch({ notes: event.target.value })}
            placeholder="Spoke at the Bengaluru backend meetup about their migration tooling."
          />
        </Field>
      </form>
    </Dialog>
  )
}
