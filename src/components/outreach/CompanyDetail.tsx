import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Opportunity, OpportunityType, Priority, Touch } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { CompanyForm } from '@/components/outreach/CompanyForm'
import { ContactDetail } from '@/components/outreach/ContactDetail'
import { ContactForm } from '@/components/outreach/ContactForm'
import { FactList } from '@/components/outreach/FactList'
import { FitEditor } from '@/components/outreach/FitEditor'
import { FitScore } from '@/components/outreach/FitScore'
import { OpportunityForm } from '@/components/outreach/OpportunityForm'
import { ResearchLinks } from '@/components/outreach/ResearchLinks'
import { StageBadge } from '@/components/outreach/StageBadge'
import { TouchForm } from '@/components/outreach/TouchForm'
import { TouchList } from '@/components/outreach/TouchList'
import { WarmthBadge } from '@/components/outreach/WarmthBadge'
import { useCompany } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { relativeDay } from '@/utils/date'
import { pluralize, priorityTone } from '@/utils/format'
import { isTerminal, KIND_META } from '@/utils/outreach'

export interface CompanyDetailProps {
  companyId: string | null
  onClose: () => void
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const TYPE_LABEL: Record<OpportunityType, string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
}

/** How many touches the dialog shows before pointing at the Activity page. */
const RECENT_TOUCHES = 6

function newestFirst(a: Touch, b: Touch): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.time ?? '').localeCompare(a.time ?? '') ||
    b.createdAt.localeCompare(a.createdAt)
  )
}

function byOpenThenRecent(a: Opportunity, b: Opportunity): number {
  const aOpen = isTerminal(a.stage) ? 1 : 0
  const bOpen = isTerminal(b.stage) ? 1 : 0
  return aOpen - bOpen || b.updatedAt.localeCompare(a.updatedAt)
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id={id} className="flex items-center gap-2 text-sm font-semibold text-ink">
          {title}
          {count !== undefined ? (
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums text-ink-faint">
              {count}
            </span>
          ) : null}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * One target account, end to end: what it is, why it is on the list, how well
 * it fits, what is known about it (with sources), who works there, which roles
 * are being pursued and the latest touches.
 *
 * The fit editor and fact list write straight to the record — there is no
 * Save button for them — while name-level edits go through `CompanyForm`.
 */
export function CompanyDetail({ companyId, onClose }: CompanyDetailProps) {
  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const company = useCompany(companyId ?? undefined)

  const [editOpen, setEditOpen] = useState(false)
  const [contactFormOpen, setContactFormOpen] = useState(false)
  const [contactDetailId, setContactDetailId] = useState<string | null>(null)
  const [opportunityFormOpen, setOpportunityFormOpen] = useState(false)
  const [touchFormOpen, setTouchFormOpen] = useState(false)
  const [editingTouchId, setEditingTouchId] = useState<string | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState(false)

  const contacts = useMemo(
    () =>
      company
        ? db.contacts
            .filter((c) => c.companyId === company.id)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [db.contacts, company],
  )
  const opportunities = useMemo(
    () =>
      company
        ? db.opportunities.filter((o) => o.companyId === company.id).sort(byOpenThenRecent)
        : [],
    [db.opportunities, company],
  )
  /*
   * A touch "belongs" to the company when it names the company, one of its
   * opportunities or one of its people — the same rule `lastTouch` uses, so
   * the list here agrees with the "Last touch" column on the Companies page.
   */
  const touches = useMemo(() => {
    if (!company) return []
    const opportunityIds = new Set(opportunities.map((o) => o.id))
    const contactIds = new Set(contacts.map((c) => c.id))
    return db.touches
      .filter(
        (touch) =>
          touch.companyId === company.id ||
          (touch.opportunityId !== undefined && opportunityIds.has(touch.opportunityId)) ||
          (touch.contactId !== undefined && contactIds.has(touch.contactId)),
      )
      .sort(newestFirst)
  }, [db.touches, company, opportunities, contacts])

  const openCount = opportunities.filter((o) => !isTerminal(o.stage)).length
  const footprint = pendingDelete && company ? actions.companyFootprint(company.id) : undefined

  const toggleArchived = () => {
    if (!company) return
    const archived = !company.archived
    actions.updateCompany(company.id, { archived })
    toast({
      title: archived ? 'Company archived' : 'Company restored',
      description: archived
        ? `${company.name} is hidden from the list. Its opportunities and contacts are untouched.`
        : `${company.name} is back on the list.`,
    })
  }

  const confirmDelete = () => {
    if (!company) return
    const name = company.name
    const removed = actions.deleteCompany(company.id)
    setPendingDelete(false)
    toast({
      title: 'Company deleted',
      description: `${name} removed, along with ${pluralize(removed.opportunities, 'opportunity', 'opportunities')} and ${pluralize(removed.touches, 'touch', 'touches')}. ${pluralize(removed.contacts, 'contact')} unlinked.`,
    })
    onClose()
  }

  const editTouch = (id: string) => {
    setEditingTouchId(id)
    setTouchFormOpen(true)
  }

  const logTouch = () => {
    setEditingTouchId(undefined)
    setTouchFormOpen(true)
  }

  const open = companyId !== null && company !== undefined

  const description = company
    ? [KIND_META[company.kind].label, company.industry, company.location]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={company?.name ?? 'Company'}
        description={description || undefined}
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              icon="Trash"
              onClick={() => setPendingDelete(true)}
              className="mr-auto text-danger hover:bg-danger-soft hover:text-danger"
            >
              Delete
            </Button>
            <Button
              variant="secondary"
              icon={company?.archived ? 'ArchiveRestore' : 'Archive'}
              onClick={toggleArchived}
            >
              {company?.archived ? 'Unarchive' : 'Archive'}
            </Button>
            <Button variant="primary" icon="Pencil" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </>
        }
      >
        {company ? (
          <div className="space-y-6 pb-2">
            {/* Meta */}
            <section aria-label="At a glance" className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral" icon="Building2">
                  {KIND_META[company.kind].label}
                </Badge>
                {company.size ? <Badge tone="neutral">{company.size} people</Badge> : null}
                {company.stage ? <Badge tone="neutral">{company.stage}</Badge> : null}
                {company.location ? (
                  <Badge tone="neutral" icon="MapPin">
                    {company.location}
                  </Badge>
                ) : null}
                {company.remote ? (
                  <Badge tone="info" icon="Globe">
                    Remote-friendly
                  </Badge>
                ) : null}
                <Badge tone={priorityTone(company.priority)}>{PRIORITY_LABEL[company.priority]}</Badge>
                {company.archived ? (
                  <Badge tone="warning" icon="Archive">
                    Archived
                  </Badge>
                ) : null}
              </div>

              {company.tags.length > 0 ? (
                <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
                  {company.tags.map((tag) => (
                    <li
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-ink-muted"
                    >
                      <Icon name="Hash" size={10} className="text-ink-faint" />
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}

              {company.website || company.careersUrl || company.linkedinUrl ? (
                <div className="flex flex-wrap gap-2">
                  {company.website ? (
                    <ButtonLink href={company.website} variant="secondary" size="sm" icon="Globe" iconRight="ArrowUpRight">
                      Website
                    </ButtonLink>
                  ) : null}
                  {company.careersUrl ? (
                    <ButtonLink href={company.careersUrl} variant="secondary" size="sm" icon="Briefcase" iconRight="ArrowUpRight">
                      Careers
                    </ButtonLink>
                  ) : null}
                  {company.linkedinUrl ? (
                    <ButtonLink href={company.linkedinUrl} variant="secondary" size="sm" icon="Link" iconRight="ArrowUpRight">
                      LinkedIn
                    </ButtonLink>
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* Why */}
            <Section title="Why them">
              {company.why ? (
                <p className="text-sm leading-relaxed text-ink-muted">{company.why}</p>
              ) : (
                <p className="text-sm text-ink-faint">
                  No note yet. Edit the company and write one line — it becomes the hook in your
                  first message.
                </p>
              )}
            </Section>

            {/* Fit */}
            <Section title="Fit">
              <div className="flex flex-col gap-5 rounded-xl border border-line p-4 sm:flex-row sm:items-start">
                <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-center">
                  <FitScore company={company} size="lg" showLabel />
                </div>
                <FitEditor company={company} className="min-w-0 flex-1" />
              </div>
            </Section>

            {/* Facts */}
            <Section title="What you know" count={company.facts.length}>
              <FactList company={company} />
            </Section>

            {/* Research */}
            <Section title="Research">
              <ResearchLinks company={company} />
            </Section>

            {/* Contacts */}
            <Section
              title="People here"
              count={contacts.length}
              action={
                <Button variant="ghost" size="sm" icon="Plus" onClick={() => setContactFormOpen(true)}>
                  Add contact
                </Button>
              }
            >
              {contacts.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  Nobody yet. Use the LinkedIn search above to find an engineer or hiring manager,
                  then add them here.
                </p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {contacts.map((contact) => (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => setContactDetailId(contact.id)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {contact.name}
                          </span>
                          {contact.role ? (
                            <span className="block truncate text-xs text-ink-faint">{contact.role}</span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <WarmthBadge warmth={contact.warmth} size="sm" />
                          <Icon name="ChevronRight" size={14} className="text-ink-faint" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Opportunities */}
            <Section
              title="Opportunities"
              count={opportunities.length}
              action={
                <Button variant="ghost" size="sm" icon="Plus" onClick={() => setOpportunityFormOpen(true)}>
                  New opportunity
                </Button>
              }
            >
              {opportunities.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  No role tracked yet. Add one when you find a posting or a team worth writing to.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {opportunities.map((opportunity) => (
                      <li
                        key={opportunity.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{opportunity.title}</p>
                          <p className="truncate text-xs text-ink-faint">
                            {TYPE_LABEL[opportunity.type]}
                            {opportunity.nextActionDue
                              ? ` · follow up ${relativeDay(opportunity.nextActionDue).toLowerCase()}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StageBadge stage={opportunity.stage} size="sm" />
                          <ButtonLink
                            to={`${PERSONAL_ROUTES.outreachPipeline}?id=${encodeURIComponent(opportunity.id)}`}
                            variant="ghost"
                            size="sm"
                            iconRight="ArrowRight"
                            aria-label={`Open ${opportunity.title} in the pipeline`}
                          >
                            Open
                          </ButtonLink>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {openCount < opportunities.length ? (
                    <p className="text-xs text-ink-faint">
                      {openCount} open · {opportunities.length - openCount} closed
                    </p>
                  ) : null}
                </>
              )}
            </Section>

            {/* Touches */}
            <Section
              title="Recent touches"
              count={touches.length}
              action={
                <Button variant="ghost" size="sm" icon="Plus" onClick={logTouch}>
                  Log touch
                </Button>
              }
            >
              {touches.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  Nothing logged yet. Every email, message and call goes here — response rates are
                  computed from it.
                </p>
              ) : (
                <>
                  <TouchList touches={touches} onEdit={editTouch} showLinks limit={RECENT_TOUCHES} />
                  {touches.length > RECENT_TOUCHES ? (
                    <ButtonLink
                      to={PERSONAL_ROUTES.outreachActivity}
                      variant="ghost"
                      size="sm"
                      iconRight="ArrowRight"
                    >
                      All {touches.length} in Activity
                    </ButtonLink>
                  ) : null}
                </>
              )}
            </Section>
          </div>
        ) : null}
      </Dialog>

      {/* Secondary dialogs are siblings, not children, of the main Dialog so its
          focus trap never intercepts their keystrokes. */}
      <CompanyForm open={editOpen} onClose={() => setEditOpen(false)} companyId={company?.id} />
      <ContactForm
        open={contactFormOpen}
        onClose={() => setContactFormOpen(false)}
        defaults={{ companyId: company?.id }}
      />
      <ContactDetail contactId={contactDetailId} onClose={() => setContactDetailId(null)} />
      <OpportunityForm
        open={opportunityFormOpen}
        onClose={() => setOpportunityFormOpen(false)}
        defaults={company ? { companyId: company.id } : undefined}
      />
      <TouchForm
        open={touchFormOpen}
        onClose={() => setTouchFormOpen(false)}
        touchId={editingTouchId}
        defaults={editingTouchId ? undefined : { companyId: company?.id, direction: 'outbound' }}
      />
      <ConfirmDialog
        open={pendingDelete}
        onCancel={() => setPendingDelete(false)}
        onConfirm={confirmDelete}
        title="Delete this company?"
        message={
          company && footprint
            ? `${company.name} will be removed from this device. This also removes ${pluralize(footprint.opportunities, 'opportunity', 'opportunities')} and ${pluralize(footprint.touches, 'touch', 'touches')}; ${pluralize(footprint.contacts, 'contact')} will be kept and unlinked. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete company"
        tone="danger"
      />
    </>
  )
}
