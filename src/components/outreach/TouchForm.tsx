import { useId, useMemo, useState } from 'react'
import type {
  Opportunity,
  OpportunityStage,
  TouchChannel,
  TouchDirection,
  TouchOutcome,
} from '@/types'
import type { TouchInput } from '@/services/contracts'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { DIRECTION_META, OUTCOME_META } from '@/components/outreach/TouchRow'
import {
  isTerminalStage,
  useCompanies,
  useContactMap,
  useContacts,
  useOpportunities,
  useOpportunityMap,
  useTemplates,
} from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { fromISODate, nowClockTime, toISODate, todayISO } from '@/utils/date'
import { truncate } from '@/utils/format'
import { CHANNEL_META, STAGE_META } from '@/utils/outreach'

export interface TouchFormProps {
  open: boolean
  onClose: () => void
  /** Present when editing an existing touch. */
  touchId?: string
  /** Pre-fills a new touch, e.g. `{ opportunityId }` from an opportunity's detail. */
  defaults?: Partial<TouchInput>
}

interface Values {
  date: string
  time: string
  channel: TouchChannel
  direction: TouchDirection
  companyId: string
  contactId: string
  opportunityId: string
  summary: string
  templateId: string
  outcome: '' | TouchOutcome
}

interface Errors {
  date?: string
  time?: string
  summary?: string
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_RE = /^\d{2}:\d{2}$/

const CHANNELS = Object.keys(CHANNEL_META) as TouchChannel[]
const OUTCOMES = Object.keys(OUTCOME_META) as TouchOutcome[]

const DIRECTION_OPTIONS: { value: TouchDirection; label: string; icon: string }[] = [
  { value: 'outbound', label: DIRECTION_META.outbound.label, icon: DIRECTION_META.outbound.icon },
  { value: 'inbound', label: DIRECTION_META.inbound.label, icon: DIRECTION_META.inbound.icon },
]

/**
 * Mirrors the documented side effect of `addTouch`: an outbound touch while
 * 'researching' moves to 'contacted'; an inbound one while 'researching' or
 * 'contacted' moves to 'replied'. Terminal stages never move.
 */
function predictedStage(
  opportunity: Opportunity | undefined,
  direction: TouchDirection,
): OpportunityStage | null {
  if (!opportunity || isTerminalStage(opportunity.stage)) return null
  if (direction === 'outbound' && opportunity.stage === 'researching') return 'contacted'
  if (
    direction === 'inbound' &&
    (opportunity.stage === 'researching' || opportunity.stage === 'contacted')
  ) {
    return 'replied'
  }
  return null
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  const parsed = fromISODate(value)
  return !Number.isNaN(parsed.getTime()) && toISODate(parsed) === value
}

/**
 * Logs or edits one interaction.
 *
 * Picking an opportunity fills in its company; picking a contact does the same
 * when no company is chosen yet. The service infers the company anyway, so the
 * form is only making visible what will be stored.
 */
export function TouchForm({ open, onClose, touchId, defaults }: TouchFormProps) {
  const formId = `touch-form-${useId()}`
  const { db, actions } = usePersonalData()
  const { toast } = useToast()

  const companies = useCompanies(true)
  const contacts = useContacts()
  const contactMap = useContactMap()
  const opportunities = useOpportunities()
  const opportunityMap = useOpportunityMap()
  const templates = useTemplates(true)

  const existing = useMemo(
    () => (touchId ? db.touches.find((touch) => touch.id === touchId) : undefined),
    [db.touches, touchId],
  )

  const initialValues = (): Values => {
    if (existing) {
      return {
        date: existing.date,
        time: existing.time ?? '',
        channel: existing.channel,
        direction: existing.direction,
        companyId: existing.companyId ?? '',
        contactId: existing.contactId ?? '',
        opportunityId: existing.opportunityId ?? '',
        summary: existing.summary,
        templateId: existing.templateId ?? '',
        outcome: existing.outcome ?? '',
      }
    }
    const opportunity = defaults?.opportunityId
      ? opportunityMap.get(defaults.opportunityId)
      : undefined
    const contact = defaults?.contactId ? contactMap.get(defaults.contactId) : undefined
    return {
      date: defaults?.date ?? todayISO(),
      time: defaults?.time ?? nowClockTime(),
      channel: defaults?.channel ?? 'email',
      direction: defaults?.direction ?? 'outbound',
      companyId: defaults?.companyId ?? opportunity?.companyId ?? contact?.companyId ?? '',
      contactId: defaults?.contactId ?? '',
      opportunityId: defaults?.opportunityId ?? '',
      summary: defaults?.summary ?? '',
      templateId: defaults?.templateId ?? '',
      outcome: defaults?.outcome ?? '',
    }
  }

  const [values, setValues] = useState<Values>(initialValues)
  const [errors, setErrors] = useState<Errors>({})

  // Reset on the way in, keyed by which record is being edited — the dialog
  // stays mounted while it animates out, so the fields cannot reset on close.
  const session = open ? (touchId ?? 'new') : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setValues(initialValues())
      setErrors({})
    }
  }

  const patch = (next: Partial<Values>) => setValues((prev) => ({ ...prev, ...next }))

  const contactOptions = useMemo(
    () =>
      values.companyId
        ? contacts.filter(
            (contact) => contact.companyId === values.companyId || contact.id === values.contactId,
          )
        : contacts,
    [contacts, values.companyId, values.contactId],
  )

  const opportunityOptions = useMemo(
    () =>
      values.companyId
        ? opportunities.filter(
            (opportunity) =>
              opportunity.companyId === values.companyId ||
              opportunity.id === values.opportunityId,
          )
        : opportunities,
    [opportunities, values.companyId, values.opportunityId],
  )

  const companyNames = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  )

  const handleCompanyChange = (companyId: string) => {
    const contact = values.contactId ? contactMap.get(values.contactId) : undefined
    const opportunity = values.opportunityId
      ? opportunityMap.get(values.opportunityId)
      : undefined
    patch({
      companyId,
      contactId: !companyId || contact?.companyId === companyId ? values.contactId : '',
      opportunityId:
        !companyId || opportunity?.companyId === companyId ? values.opportunityId : '',
    })
  }

  const handleContactChange = (contactId: string) => {
    const contact = contactId ? contactMap.get(contactId) : undefined
    patch({ contactId, companyId: values.companyId || contact?.companyId || '' })
  }

  const handleOpportunityChange = (opportunityId: string) => {
    const opportunity = opportunityId ? opportunityMap.get(opportunityId) : undefined
    patch({ opportunityId, companyId: opportunity ? opportunity.companyId : values.companyId })
  }

  const handleSubmit = () => {
    const summary = values.summary.trim()
    const time = values.time.trim()
    const nextErrors: Errors = {}

    if (!summary) nextErrors.summary = 'Say what happened, in a line or two.'
    if (!isRealDate(values.date)) nextErrors.date = 'Pick a real calendar day.'
    if (time && !CLOCK_RE.test(time)) nextErrors.time = 'Use HH:mm, or leave it blank.'

    setErrors(nextErrors)
    if (nextErrors.summary || nextErrors.date || nextErrors.time) return

    const outbound = values.direction === 'outbound'
    const input: TouchInput = {
      date: values.date,
      time: time || undefined,
      channel: values.channel,
      direction: values.direction,
      companyId: values.companyId || undefined,
      contactId: values.contactId || undefined,
      opportunityId: values.opportunityId || undefined,
      summary,
      templateId: outbound && values.templateId ? values.templateId : undefined,
      outcome: values.outcome || undefined,
    }

    if (existing) {
      actions.updateTouch(existing.id, input)
      toast({ title: 'Touch updated', description: truncate(summary, 80) })
    } else {
      const opportunity = input.opportunityId
        ? opportunityMap.get(input.opportunityId)
        : undefined
      const moved = predictedStage(opportunity, input.direction)
      actions.addTouch(input)
      toast({
        title: 'Touch logged',
        description:
          moved && opportunity
            ? `${opportunity.title} moved to ${STAGE_META[moved].label}.`
            : `${CHANNEL_META[input.channel].label} · ${DIRECTION_META[input.direction].label.toLowerCase()} · ${truncate(summary, 60)}`,
        tone: 'positive',
      })
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? 'Edit touch' : 'Log a touch'}
      description="One interaction, either direction. Nothing is sent from here — this is the record of something that already happened."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="Check">
            {existing ? 'Save changes' : 'Log touch'}
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
          <Field label="Date" required error={errors.date}>
            <Input
              type="date"
              value={values.date}
              onChange={(event) => patch({ date: event.target.value })}
              className="font-mono tabular-nums"
            />
          </Field>
          <Field label="Time" hint="Optional. Keeps same-day touches in order." error={errors.time}>
            <Input
              type="time"
              value={values.time}
              onChange={(event) => patch({ time: event.target.value })}
              className="font-mono tabular-nums"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Direction</span>
            <SegmentedControl<TouchDirection>
              value={values.direction}
              onChange={(direction) => patch({ direction })}
              options={DIRECTION_OPTIONS}
              ariaLabel="Direction of the touch"
              className="w-full"
            />
          </div>
          <Field label="Channel">
            <Select
              value={values.channel}
              onChange={(event) => patch({ channel: event.target.value as TouchChannel })}
            >
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {CHANNEL_META[channel].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Company">
            <Select
              value={values.companyId}
              onChange={(event) => handleCompanyChange(event.target.value)}
            >
              <option value="">None</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                  {company.archived ? ' (archived)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Contact">
            <Select
              value={values.contactId}
              onChange={(event) => handleContactChange(event.target.value)}
            >
              <option value="">None</option>
              {contactOptions.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                  {!values.companyId && contact.companyId && companyNames.get(contact.companyId)
                    ? ` · ${companyNames.get(contact.companyId)}`
                    : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role" hint="Choosing one fills in the company.">
            <Select
              value={values.opportunityId}
              onChange={(event) => handleOpportunityChange(event.target.value)}
            >
              <option value="">None</option>
              {opportunityOptions.map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.title}
                  {!values.companyId && companyNames.get(opportunity.companyId)
                    ? ` · ${companyNames.get(opportunity.companyId)}`
                    : ''}
                  {` (${STAGE_META[opportunity.stage].label})`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="What happened" required error={errors.summary}>
          <Textarea
            autoGrow
            rows={2}
            value={values.summary}
            onChange={(event) => patch({ summary: event.target.value })}
            placeholder="Sent the cold email; mentioned their schema-migration post."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {values.direction === 'outbound' ? (
            <Field label="Template" hint="Response rates are measured per template.">
              <Select
                value={values.templateId}
                onChange={(event) => patch({ templateId: event.target.value })}
              >
                <option value="">None</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Outcome" hint="Set it later if you do not know yet.">
            <Select
              value={values.outcome}
              onChange={(event) => patch({ outcome: event.target.value as Values['outcome'] })}
            >
              <option value="">Not yet known</option>
              {OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {OUTCOME_META[outcome].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </Dialog>
  )
}
