import { useId, useState } from 'react'
import type { Company, CompanyKind, CompanySize, Priority } from '@/types'
import type { CompanyInput } from '@/services/contracts'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { useCompany } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { KIND_META } from '@/utils/outreach'

export interface CompanyFormProps {
  open: boolean
  onClose: () => void
  /** Present when editing; absent when creating. */
  companyId?: string
  /** Called with the saved record's id, after the toast. */
  onSaved?: (id: string) => void
}

interface Values {
  name: string
  kind: CompanyKind
  size: CompanySize | ''
  stage: string
  industry: string
  location: string
  remote: boolean
  website: string
  careersUrl: string
  linkedinUrl: string
  priority: Priority
  /** Comma-separated while typing; split into an array on save. */
  tags: string
  why: string
}

interface Errors {
  name?: string
  website?: string
  careersUrl?: string
  linkedinUrl?: string
}

const KINDS: CompanyKind[] = ['startup', 'scaleup', 'mnc', 'other']
const SIZES: CompanySize[] = ['1-10', '11-50', '51-200', '201-1000', '1000+']
const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const EMPTY: Values = {
  name: '',
  kind: 'startup',
  size: '',
  stage: '',
  industry: '',
  location: '',
  remote: false,
  website: '',
  careersUrl: '',
  linkedinUrl: '',
  priority: 'medium',
  tags: '',
  why: '',
}

function valuesOf(company: Company): Values {
  return {
    name: company.name,
    kind: company.kind,
    size: company.size ?? '',
    stage: company.stage ?? '',
    industry: company.industry ?? '',
    location: company.location ?? '',
    remote: company.remote,
    website: company.website ?? '',
    careersUrl: company.careersUrl ?? '',
    linkedinUrl: company.linkedinUrl ?? '',
    priority: company.priority,
    tags: company.tags.join(', '),
    why: company.why ?? '',
  }
}

/** Trimmed text, or undefined so an emptied field clears the stored value. */
function optional(value: string): string | undefined {
  const text = value.trim()
  return text ? text : undefined
}

/**
 * "acme.com" becomes "https://acme.com". Returns `null` for something that is
 * not a URL at all, so the form can point at the field instead of storing junk.
 */
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

function parseTags(value: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of value.split(/[,;]/)) {
    const tag = part.trim()
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

const URL_ERROR = 'That does not look like a web address. Paste the full URL or leave it empty.'

/**
 * Create or edit a company. Every field the record has is here; the fit score
 * and facts are edited on the company itself because they change far more
 * often than the name does.
 */
export function CompanyForm({ open, onClose, companyId, onSaved }: CompanyFormProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()
  const company = useCompany(companyId)
  const formId = `company-form-${useId()}`

  const [values, setValues] = useState<Values>(() => (company ? valuesOf(company) : EMPTY))
  const [errors, setErrors] = useState<Errors>({})

  /*
   * The dialog stays mounted while it animates out, so the fields are reset on
   * the way in — keyed by which record is being edited, which also covers
   * opening "Edit" on a second company without closing in between.
   */
  const session = open ? (company?.id ?? 'new') : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setValues(company ? valuesOf(company) : EMPTY)
      setErrors({})
    }
  }

  const patch = (next: Partial<Values>) => setValues((prev) => ({ ...prev, ...next }))

  const handleSubmit = () => {
    const name = values.name.trim()
    const nextErrors: Errors = {}
    if (!name) nextErrors.name = 'Every company needs a name.'

    const website = normaliseUrl(values.website)
    if (website === null) nextErrors.website = URL_ERROR
    const careersUrl = normaliseUrl(values.careersUrl)
    if (careersUrl === null) nextErrors.careersUrl = URL_ERROR
    const linkedinUrl = normaliseUrl(values.linkedinUrl)
    if (linkedinUrl === null) nextErrors.linkedinUrl = URL_ERROR

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const input: CompanyInput = {
      name,
      kind: values.kind,
      size: values.size || undefined,
      stage: optional(values.stage),
      industry: optional(values.industry),
      location: optional(values.location),
      remote: values.remote,
      website: website ?? undefined,
      careersUrl: careersUrl ?? undefined,
      linkedinUrl: linkedinUrl ?? undefined,
      priority: values.priority,
      tags: parseTags(values.tags),
      why: optional(values.why),
    }

    if (company) {
      actions.updateCompany(company.id, input)
      toast({ title: 'Company updated', description: name })
      onClose()
      onSaved?.(company.id)
      return
    }

    const created = actions.addCompany(input)
    toast({
      title: 'Company added',
      description: `${name} is on the list. Score its fit and add a contact next.`,
      tone: 'positive',
    })
    onClose()
    onSaved?.(created.id)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={company ? 'Edit company' : 'New company'}
      description={
        company
          ? 'Change anything here; facts and fit are edited on the company itself.'
          : 'A target account. Only the name is required — fill the rest in as you learn it.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="Check">
            {company ? 'Save changes' : 'Add company'}
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
        <Field label="Company" required error={errors.name}>
          <Input
            value={values.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="Northwind Labs"
            autoComplete="organization"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kind">
            <Select
              value={values.kind}
              onChange={(event) => patch({ kind: event.target.value as CompanyKind })}
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_META[kind].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Size" hint="Headcount, roughly.">
            <Select
              value={values.size}
              onChange={(event) => patch({ size: event.target.value as CompanySize | '' })}
            >
              <option value="">Unknown</option>
              {SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Stage" hint="Series A, bootstrapped, public — whatever fits.">
            <Input
              value={values.stage}
              onChange={(event) => patch({ stage: event.target.value })}
              placeholder="Series A"
              autoComplete="off"
            />
          </Field>

          <Field label="Industry">
            <Input
              value={values.industry}
              onChange={(event) => patch({ industry: event.target.value })}
              placeholder="Developer tools"
              autoComplete="off"
            />
          </Field>

          <Field label="Location">
            <Input
              value={values.location}
              onChange={(event) => patch({ location: event.target.value })}
              placeholder="Bengaluru"
              autoComplete="off"
            />
          </Field>

          <Field label="Priority">
            <Select
              value={values.priority}
              onChange={(event) => patch({ priority: event.target.value as Priority })}
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Switch
          checked={values.remote}
          onCheckedChange={(remote) => patch({ remote })}
          label="Remote-friendly"
          description="They hire people who are not in the office."
          className="rounded-xl border border-line bg-surface-muted/50 px-3 py-2.5"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Website" error={errors.website} className="sm:col-span-2">
            <Input
              type="url"
              inputMode="url"
              value={values.website}
              onChange={(event) => patch({ website: event.target.value })}
              placeholder="northwind.example.com"
              autoComplete="url"
            />
          </Field>

          <Field label="Careers page" error={errors.careersUrl}>
            <Input
              type="url"
              inputMode="url"
              value={values.careersUrl}
              onChange={(event) => patch({ careersUrl: event.target.value })}
              placeholder="…/careers"
              autoComplete="off"
            />
          </Field>

          <Field label="LinkedIn page" error={errors.linkedinUrl}>
            <Input
              type="url"
              inputMode="url"
              value={values.linkedinUrl}
              onChange={(event) => patch({ linkedinUrl: event.target.value })}
              placeholder="linkedin.com/company/…"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="Tags" hint="Comma-separated. devtools, backend, warm-intro">
          <Input
            value={values.tags}
            onChange={(event) => patch({ tags: event.target.value })}
            placeholder="devtools, backend"
            autoComplete="off"
          />
        </Field>

        <Field label="Why them" hint="In your own words. This is what the cold email's hook comes from.">
          <Textarea
            autoGrow
            rows={3}
            value={values.why}
            onChange={(event) => patch({ why: event.target.value })}
            placeholder="Small backend team shipping a schema-migration product — the kind of work where correctness is the product."
          />
        </Field>
      </form>
    </Dialog>
  )
}
