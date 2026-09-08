import { useId, useState } from 'react'
import type {
  Opportunity,
  OpportunitySource,
  OpportunityStage,
  OpportunityType,
  Priority,
} from '@/types'
import type { OpportunityInput } from '@/services/contracts'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { CompanyForm } from '@/components/outreach/CompanyForm'
import {
  useCompanies,
  useContacts,
  useOpportunityMap,
  useOutreachSettings,
} from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { SOURCE_META, STAGES, STAGE_META } from '@/utils/outreach'

export interface OpportunityFormProps {
  open: boolean
  onClose: () => void
  /** Present when editing; absent when creating. */
  opportunityId?: string
  /** Pre-filled fields for a new opportunity, e.g. `{ stage: 'applied' }` from a board column. */
  defaults?: Partial<OpportunityInput>
}

interface Values {
  companyId: string
  contactId: string
  title: string
  type: OpportunityType
  stage: OpportunityStage
  source: OpportunitySource
  priority: Priority
  jobUrl: string
  appliedAt: string
  resumeVersion: string
  compensation: string
  notes: string
}

interface Errors {
  companyId?: string
  title?: string
}

const TYPE_OPTIONS: { value: OpportunityType; label: string }[] = [
  { value: 'internship', label: 'Internship' },
  { value: 'full-time', label: 'Full-time' },
]

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const SOURCES = Object.keys(SOURCE_META) as OpportunitySource[]
const OPEN_STAGES = STAGES.filter((stage) => !STAGE_META[stage].terminal)
const CLOSED_STAGES = STAGES.filter((stage) => STAGE_META[stage].terminal)

function emptyValues(defaults: Partial<OpportunityInput> | undefined, resume: string): Values {
  return {
    companyId: defaults?.companyId ?? '',
    contactId: defaults?.contactId ?? '',
    title: defaults?.title ?? '',
    type: defaults?.type ?? 'internship',
    stage: defaults?.stage ?? 'researching',
    source: defaults?.source ?? 'cold',
    priority: defaults?.priority ?? 'medium',
    jobUrl: defaults?.jobUrl ?? '',
    appliedAt: defaults?.appliedAt ?? '',
    resumeVersion: defaults?.resumeVersion ?? resume,
    compensation: defaults?.compensation ?? '',
    notes: defaults?.notes ?? '',
  }
}

function valuesOf(opportunity: Opportunity): Values {
  return {
    companyId: opportunity.companyId,
    contactId: opportunity.contactId ?? '',
    title: opportunity.title,
    type: opportunity.type,
    stage: opportunity.stage,
    source: opportunity.source,
    priority: opportunity.priority,
    jobUrl: opportunity.jobUrl ?? '',
    appliedAt: opportunity.appliedAt ?? '',
    resumeVersion: opportunity.resumeVersion ?? '',
    compensation: opportunity.compensation ?? '',
    notes: opportunity.notes ?? '',
  }
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Create or edit an opportunity — a role at a company.
 *
 * Company and title are the only required fields; everything else can be
 * filled in as the conversation develops. A stage picked here on an existing
 * record goes through `setOpportunityStage`, never a raw patch, so the stage
 * history stays honest. "New company" opens the company form on top of this
 * one and selects whatever it creates.
 */
export function OpportunityForm({ open, onClose, opportunityId, defaults }: OpportunityFormProps) {
  const formId = `opportunity-form-${useId()}`
  const { actions } = usePersonalData()
  const { toast } = useToast()
  const settings = useOutreachSettings()
  const companies = useCompanies(true)
  const editing = useOpportunityMap().get(opportunityId ?? '')

  const [values, setValues] = useState<Values>(() =>
    editing ? valuesOf(editing) : emptyValues(defaults, settings.defaultResumeVersion ?? ''),
  )
  const [errors, setErrors] = useState<Errors>({})
  const [companyFormOpen, setCompanyFormOpen] = useState(false)
  const [companyIdsBefore, setCompanyIdsBefore] = useState<Set<string> | null>(null)

  /*
   * The dialog stays mounted while it animates out, so the fields are reset on
   * the way in — keyed by which record is being edited, which also covers
   * opening the form for a second opportunity without closing it in between.
   */
  const session = open ? (opportunityId ?? 'new') : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setValues(
        editing ? valuesOf(editing) : emptyValues(defaults, settings.defaultResumeVersion ?? ''),
      )
      setErrors({})
    }
  }

  /*
   * `CompanyForm` has no "created" callback, so the company list is compared
   * before and after it closes: exactly one new id means it was just added
   * here, and it becomes the selection.
   */
  if (companyIdsBefore && !companyFormOpen) {
    const added = companies.filter((company) => !companyIdsBefore.has(company.id))
    setCompanyIdsBefore(null)
    if (added.length === 1) {
      setValues((prev) => ({ ...prev, companyId: added[0].id, contactId: '' }))
      setErrors((prev) => ({ ...prev, companyId: undefined }))
    }
  }

  const allContactsForCompany = useContacts(values.companyId || undefined)
  const contacts = values.companyId ? allContactsForCompany : []

  const patch = (next: Partial<Values>) => setValues((prev) => ({ ...prev, ...next }))

  const changeCompany = (companyId: string) => {
    setValues((prev) => ({ ...prev, companyId, contactId: '' }))
    if (errors.companyId) setErrors((prev) => ({ ...prev, companyId: undefined }))
  }

  const openCompanyForm = () => {
    setCompanyIdsBefore(new Set(companies.map((company) => company.id)))
    setCompanyFormOpen(true)
  }

  const handleSubmit = () => {
    const title = values.title.trim()
    const nextErrors: Errors = {}
    if (!values.companyId) nextErrors.companyId = 'Pick the company this role is at.'
    if (!title) nextErrors.title = 'Name the role — "Backend Intern" is enough.'
    setErrors(nextErrors)
    if (nextErrors.companyId || nextErrors.title) return

    const company = companies.find((item) => item.id === values.companyId)
    const companyName = company?.name ?? 'the company'
    const fields: Partial<OpportunityInput> = {
      companyId: values.companyId,
      contactId: values.contactId || undefined,
      title,
      type: values.type,
      source: values.source,
      priority: values.priority,
      jobUrl: blankToUndefined(values.jobUrl),
      appliedAt: values.appliedAt || undefined,
      resumeVersion: blankToUndefined(values.resumeVersion),
      compensation: blankToUndefined(values.compensation),
      notes: blankToUndefined(values.notes),
    }

    if (editing) {
      actions.updateOpportunity(editing.id, fields)
      if (values.stage !== editing.stage) actions.setOpportunityStage(editing.id, values.stage)
      toast({ title: 'Opportunity updated', description: `${title} · ${companyName}` })
      onClose()
      return
    }

    try {
      actions.addOpportunity({
        ...fields,
        companyId: values.companyId,
        title,
        stage: values.stage,
        nextAction: defaults?.nextAction,
        nextActionDue: defaults?.nextActionDue,
      })
    } catch (error) {
      toast({
        title: 'Could not add the opportunity',
        description: error instanceof Error ? error.message : 'Try again.',
        tone: 'danger',
      })
      return
    }
    toast({
      title: 'Opportunity added',
      description: `${title} at ${companyName} — ${STAGE_META[values.stage].label}`,
      tone: 'positive',
    })
    onClose()
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={editing ? 'Edit opportunity' : 'New opportunity'}
        description={
          editing
            ? 'Change the facts about this role. Stage changes are recorded in its history.'
            : 'A role you are pursuing at one of your companies. Only the company and the title are needed to start.'
        }
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={formId} icon="Check">
              {editing ? 'Save changes' : 'Add opportunity'}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <Field label="Company" required error={errors.companyId}>
              <Select value={values.companyId} onChange={(event) => changeCompany(event.target.value)}>
                <option value="">Select a company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                    {company.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" icon="Plus" onClick={openCompanyForm} className="sm:mt-[26px]">
              New company
            </Button>
          </div>

          <Field label="Role" required error={errors.title}>
            <Input
              value={values.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="Backend Engineering Intern"
              autoComplete="off"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Type</span>
              <SegmentedControl<OpportunityType>
                value={values.type}
                onChange={(type) => patch({ type })}
                options={TYPE_OPTIONS}
                ariaLabel="Opportunity type"
                className="w-full"
              />
            </div>

            <Field
              label="Contact"
              hint={
                values.companyId
                  ? contacts.length === 0
                    ? 'No contacts at this company yet. Add one from Contacts.'
                    : 'The person this is being pursued through.'
                  : 'Pick a company first.'
              }
            >
              <Select
                value={values.contactId}
                onChange={(event) => patch({ contactId: event.target.value })}
                disabled={!values.companyId || contacts.length === 0}
              >
                <option value="">No contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                    {contact.role ? ` — ${contact.role}` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Stage">
              <Select
                value={values.stage}
                onChange={(event) => patch({ stage: event.target.value as OpportunityStage })}
              >
                <optgroup label="Open">
                  {OPEN_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {STAGE_META[stage].label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Closed">
                  {CLOSED_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {STAGE_META[stage].label}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>

            <Field label="Source">
              <Select
                value={values.source}
                onChange={(event) => patch({ source: event.target.value as OpportunitySource })}
              >
                {SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_META[source].label}
                  </option>
                ))}
              </Select>
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

            <Field label="Applied on" hint="Set automatically the first time the stage reaches Applied.">
              <Input
                type="date"
                value={values.appliedAt}
                onChange={(event) => patch({ appliedAt: event.target.value })}
              />
            </Field>

            <Field label="Job posting URL">
              <Input
                type="url"
                inputMode="url"
                value={values.jobUrl}
                onChange={(event) => patch({ jobUrl: event.target.value })}
                placeholder="https://…"
                autoComplete="off"
              />
            </Field>

            <Field
              label="Resume version"
              hint={
                settings.defaultResumeVersion
                  ? `Defaults to "${settings.defaultResumeVersion}" from Outreach settings.`
                  : 'Which variant went in, e.g. backend-v3.'
              }
            >
              <Input
                value={values.resumeVersion}
                onChange={(event) => patch({ resumeVersion: event.target.value })}
                placeholder={settings.defaultResumeVersion ?? 'backend-v3'}
                autoComplete="off"
              />
            </Field>

            <Field label="Compensation" hint="Whatever you know, in your own words.">
              <Input
                value={values.compensation}
                onChange={(event) => patch({ compensation: event.target.value })}
                placeholder="₹60k/month stipend · 18 LPA full-time"
                autoComplete="off"
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              autoGrow
              rows={3}
              value={values.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              placeholder="Team, interview format, who referred you, what they said."
            />
          </Field>
        </form>
      </Dialog>

      <CompanyForm open={companyFormOpen} onClose={() => setCompanyFormOpen(false)} />
    </>
  )
}
