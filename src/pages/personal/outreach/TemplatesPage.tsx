import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MessageTemplate, TemplatePurpose, Tone } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Progress } from '@/components/ui/Progress'
import { Stat } from '@/components/ui/Stat'
import { useToast } from '@/components/ui/Toast'
import { ComposeDialog } from '@/components/outreach/ComposeDialog'
import { OutreachTabs } from '@/components/outreach/OutreachTabs'
import { TemplateForm } from '@/components/outreach/TemplateForm'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useOpportunities, useTemplateMap, useTemplates } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { percent, pluralize } from '@/utils/format'
import { CHANNEL_META, PURPOSE_META, rateByTemplate } from '@/utils/outreach'
import type { TemplateRate } from '@/utils/outreach'
import { extractVariables } from '@/utils/templates'

const PURPOSES = Object.keys(PURPOSE_META) as TemplatePurpose[]

interface FormState {
  open: boolean
  templateId?: string
}

interface ComposeState {
  open: boolean
  templateId?: string
}

function rateTone(rate: number): Tone {
  if (rate >= 25) return 'positive'
  if (rate > 0) return 'accent'
  return 'neutral'
}

interface TemplateCardProps {
  template: MessageTemplate
  rate?: TemplateRate
  onCompose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onToggleArchive: () => void
  onDelete: () => void
}

function TemplateCard({
  template,
  rate,
  onCompose,
  onEdit,
  onDuplicate,
  onToggleArchive,
  onDelete,
}: TemplateCardProps) {
  const variables = useMemo(
    () => extractVariables(`${template.subject ?? ''}\n${template.body}`),
    [template.subject, template.body],
  )
  const channel = CHANNEL_META[template.channel]

  const menuItems: DropdownMenuItem[] = [
    { id: 'edit', label: 'Edit template', icon: 'Pencil', onSelect: onEdit },
    { id: 'duplicate', label: 'Duplicate', icon: 'Copy', onSelect: onDuplicate },
    {
      id: 'archive',
      label: template.archived ? 'Restore' : 'Archive',
      icon: template.archived ? 'ArchiveRestore' : 'Archive',
      onSelect: onToggleArchive,
    },
    { id: 'delete', label: 'Delete', icon: 'Trash', tone: 'danger', onSelect: onDelete },
  ]

  return (
    <Card className="h-full w-full">
      <CardHeader actions={<DropdownMenu items={menuItems} label={`Actions for ${template.name}`} />}>
        <CardTitle as="h4" className="text-base">
          {template.name}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={template.channel === 'email' ? 'info' : 'accent'} size="sm" icon={channel.icon}>
            {channel.label}
          </Badge>
          {template.archived ? (
            <Badge tone="neutral" size="sm" icon="Archive">
              Archived
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {template.channel === 'email' ? (
          <p className="text-sm text-ink">
            <span className="text-ink-faint">Subject </span>
            {template.subject?.trim() ? (
              template.subject
            ) : (
              <span className="text-ink-faint">(none)</span>
            )}
          </p>
        ) : null}

        <p className="line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-ink-muted">
          {template.body}
        </p>

        {variables.length > 0 ? (
          <ul aria-label="Variables used" className="flex flex-wrap gap-1.5">
            {variables.map((name) => (
              <li
                key={name}
                className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
              >
                {`{{${name}}}`}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto pt-1">
          {rate && rate.sent > 0 ? (
            <Progress
              value={rate.rate}
              tone={rateTone(rate.rate)}
              size="sm"
              label={`${rate.replied} of ${pluralize(rate.sent, 'send')} replied`}
              showValue
            />
          ) : (
            <p className="text-xs text-ink-faint">Not sent yet — compose from it to start measuring.</p>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="primary" size="sm" icon="Send" onClick={onCompose}>
          Compose
        </Button>
        <Button variant="secondary" size="sm" icon="Pencil" onClick={onEdit}>
          Edit
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * Every reusable message, grouped by what it is for, with the response rate
 * each one has actually earned. Composing never sends anything: it opens the
 * user's own mail client pre-filled, or copies the message for LinkedIn.
 */
export default function TemplatesPage() {
  useDocumentMeta({ title: 'Templates', noindex: true })

  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const [showArchived, setShowArchived] = useState(false)
  const templateMap = useTemplateMap()
  const activeTemplates = useTemplates()
  const visibleTemplates = useTemplates(showArchived)
  const openOpportunities = useOpportunities({ open: true })

  const archivedCount = db.templates.length - activeTemplates.length

  const rates = useMemo(() => rateByTemplate(db), [db])
  const rateById = useMemo(() => new Map(rates.map((row) => [row.templateId, row])), [rates])

  const totals = useMemo(() => {
    let sent = 0
    let replied = 0
    for (const row of rates) {
      sent += row.sent
      replied += row.replied
    }
    return { sent, replied, rate: percent(replied, sent) }
  }, [rates])

  const best = useMemo(
    () =>
      rates
        .filter((row) => row.sent > 0 && templateMap.has(row.templateId))
        .sort((a, b) => b.rate - a.rate || b.sent - a.sent || a.name.localeCompare(b.name))
        .at(0),
    [rates, templateMap],
  )

  const deletedHistory = useMemo(
    () => rates.filter((row) => !templateMap.has(row.templateId)),
    [rates, templateMap],
  )

  const groups = useMemo(
    () =>
      PURPOSES.map((purpose) => ({
        purpose,
        templates: visibleTemplates.filter((template) => template.purpose === purpose),
      })).filter((group) => group.templates.length > 0),
    [visibleTemplates],
  )

  // `?id=` deep link opens that template's editor; the param is cleared on close.
  const idParam = params.get('id')
  const [form, setForm] = useState<FormState>(() =>
    idParam && templateMap.has(idParam) ? { open: true, templateId: idParam } : { open: false },
  )
  const [lastIdParam, setLastIdParam] = useState(idParam)
  if (idParam !== lastIdParam) {
    setLastIdParam(idParam)
    if (idParam && templateMap.has(idParam)) setForm({ open: true, templateId: idParam })
  }

  const [compose, setCompose] = useState<ComposeState>({ open: false })
  const [pendingDelete, setPendingDelete] = useState<MessageTemplate | null>(null)

  const closeForm = () => {
    setForm((prev) => ({ ...prev, open: false }))
    if (params.has('id')) {
      const next = new URLSearchParams(params)
      next.delete('id')
      setParams(next, { replace: true })
    }
  }

  const openCreate = () => setForm({ open: true, templateId: undefined })
  const openEdit = (template: MessageTemplate) => setForm({ open: true, templateId: template.id })

  const duplicate = (template: MessageTemplate) => {
    const copy = actions.addTemplate({
      name: `${template.name} (copy)`,
      channel: template.channel,
      purpose: template.purpose,
      subject: template.subject,
      body: template.body,
    })
    toast({
      title: 'Template duplicated',
      description: `"${copy.name}" starts with no send history of its own.`,
      tone: 'positive',
    })
  }

  const toggleArchive = (template: MessageTemplate) => {
    const archived = !template.archived
    actions.updateTemplate(template.id, { archived })
    toast({
      title: archived ? 'Template archived' : 'Template restored',
      description: archived
        ? `"${template.name}" is out of the compose picker. Its response history stays.`
        : `"${template.name}" is back in the compose picker.`,
      tone: archived ? 'neutral' : 'positive',
    })
  }

  const confirmDelete = () => {
    const template = pendingDelete
    setPendingDelete(null)
    if (!template) return
    actions.deleteTemplate(template.id)
    toast({
      title: 'Template deleted',
      description: `"${template.name}" is gone. Touches composed from it keep their response history.`,
    })
  }

  const pendingRate = pendingDelete ? rateById.get(pendingDelete.id) : undefined

  const counts = {
    [PERSONAL_ROUTES.outreachPipeline]: openOpportunities.length,
    [PERSONAL_ROUTES.outreachCompanies]: db.companies.filter((company) => !company.archived).length,
    [PERSONAL_ROUTES.outreachContacts]: db.contacts.length,
    [PERSONAL_ROUTES.outreachTemplates]: activeTemplates.length,
    [PERSONAL_ROUTES.outreachActivity]: db.touches.length,
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Outreach"
        title="Templates"
        description="Reusable messages with the blanks left in. Composing opens Gmail or your mail app pre-filled — nothing is sent from this site — and every send is measured per template."
        actions={
          <Button variant="primary" icon="Plus" onClick={openCreate}>
            New template
          </Button>
        }
      />

      <OutreachTabs counts={counts} />

      <section aria-label="Template statistics" className="space-y-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Templates"
            value={activeTemplates.length}
            sublabel={archivedCount > 0 ? `${pluralize(archivedCount, 'archived template')}` : 'None archived'}
            icon="MessageSquare"
            tone="accent"
          />
          <Stat
            label="Sent from templates"
            value={totals.sent}
            sublabel={
              totals.sent > 0
                ? `${totals.replied} replied · ${totals.rate}% overall`
                : 'Compose from a template to start counting'
            }
            icon="Send"
            tone={totals.sent > 0 ? 'info' : 'neutral'}
          />
          <Stat
            label="Best performing"
            value={best ? `${best.rate}%` : '—'}
            sublabel={
              best
                ? `${best.name} · ${best.replied}/${best.sent} replied`
                : 'Needs at least one send to compare'
            }
            icon="TrendingUp"
            tone={best ? rateTone(best.rate) : 'neutral'}
          />
        </div>
        {deletedHistory.length > 0 ? (
          <p className="text-xs leading-relaxed text-ink-faint">
            {pluralize(deletedHistory.length, 'deleted template')} still{' '}
            {deletedHistory.length === 1 ? 'carries' : 'carry'}{' '}
            {pluralize(
              deletedHistory.reduce((total, row) => total + row.sent, 0),
              'sent touch',
              'sent touches',
            )}{' '}
            of history, counted in the totals above.
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-ink">By purpose</h2>
        {archivedCount > 0 ? (
          <Checkbox
            checked={showArchived}
            onCheckedChange={setShowArchived}
            label={`Show ${pluralize(archivedCount, 'archived template')}`}
          />
        ) : null}
      </div>

      {db.templates.length === 0 ? (
        <EmptyState
          icon="MessageSquare"
          title="No templates yet"
          description="Write the message you send most, with {{name}}, {{company}}, {{role}}, {{hook}} and {{me}} left blank. Compose fills them in for each person."
          action={
            <Button variant="primary" icon="Plus" onClick={openCreate}>
              Write the first template
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="Archive"
          title="Everything is archived"
          description="Show archived templates to restore one, or write a fresh one."
          action={
            <>
              <Button variant="secondary" icon="ArchiveRestore" onClick={() => setShowArchived(true)}>
                Show archived
              </Button>
              <Button variant="primary" icon="Plus" onClick={openCreate}>
                New template
              </Button>
            </>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const headingId = `templates-${group.purpose}`
            return (
              <section key={group.purpose} aria-labelledby={headingId} className="space-y-3">
                <h3
                  id={headingId}
                  className="flex items-baseline gap-2 text-sm font-semibold tracking-wide text-ink-muted uppercase"
                >
                  {PURPOSE_META[group.purpose].label}
                  <span className="font-mono text-xs font-normal text-ink-faint tabular-nums">
                    {group.templates.length}
                  </span>
                </h3>
                <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {group.templates.map((template) => (
                    <li key={template.id} className="flex">
                      <TemplateCard
                        template={template}
                        rate={rateById.get(template.id)}
                        onCompose={() => setCompose({ open: true, templateId: template.id })}
                        onEdit={() => openEdit(template)}
                        onDuplicate={() => duplicate(template)}
                        onToggleArchive={() => toggleArchive(template)}
                        onDelete={() => setPendingDelete(template)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <TemplateForm open={form.open} onClose={closeForm} templateId={form.templateId} />

      <ComposeDialog
        open={compose.open}
        onClose={() => setCompose((prev) => ({ ...prev, open: false }))}
        templateId={compose.templateId}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        message={
          pendingRate && pendingRate.sent > 0
            ? `The template goes; the ${pluralize(pendingRate.sent, 'touch', 'touches')} composed from it keep their response history and show as "(deleted template)". Archive it instead if you might want it back.`
            : 'The template goes. Nothing has been sent from it, so no history is affected. Archive it instead if you might want it back.'
        }
        confirmLabel="Delete template"
        tone="danger"
      />
    </div>
  )
}
