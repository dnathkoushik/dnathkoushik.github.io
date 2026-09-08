import { useMemo } from 'react'
import type { Opportunity, OpportunityStage, OpportunityType, Priority } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { StageBadge } from '@/components/outreach/StageBadge'
import { useCompany, useContactMap } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { relativeDay, todayISO } from '@/utils/date'
import { STAGES, STAGE_META, daysSince, isTerminal, lastTouch } from '@/utils/outreach'

export interface OpportunityCardProps {
  opportunity: Opportunity
  /** Called with the opportunity id when the title is activated. */
  onOpen: (id: string) => void
  /** Board mode: no stage chip (the column already says it) and tighter padding. */
  compact?: boolean
  className?: string
}

const TYPE_LABEL: Record<OpportunityType, string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const PRIORITY_DOT: Record<Priority, string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-ink-faint',
}

/** The seven stages an opportunity can still move between, in pipeline order. */
const OPEN_STAGES: OpportunityStage[] = STAGES.filter((stage) => !isTerminal(stage))

function quietLabel(days: number | null): string {
  if (days === null) return 'no touches yet'
  if (days <= 0) return 'touched today'
  return `${days}d quiet`
}

/**
 * One opportunity, on the board or in a list.
 *
 * The card looks its company and contact up itself, so a page can hand it the
 * bare record. Stage moves live here too — a menu with every stage and a pair
 * of previous/next buttons — because that is the one thing you do to a card
 * without opening it. No drag-and-drop: buttons work with a keyboard, a screen
 * reader and a thumb, which HTML5 drag never has.
 */
export function OpportunityCard({
  opportunity,
  onOpen,
  compact = false,
  className,
}: OpportunityCardProps) {
  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const company = useCompany(opportunity.companyId)
  const contacts = useContactMap()
  const contact = opportunity.contactId ? contacts.get(opportunity.contactId) : undefined
  const companyName = company?.name ?? 'Unknown company'
  const today = todayISO()

  const last = useMemo(
    () => lastTouch(db, { opportunityId: opportunity.id }),
    [db, opportunity.id],
  )
  const quietDays = last ? daysSince(last.date, today) : null

  const terminal = isTerminal(opportunity.stage)
  const index = OPEN_STAGES.indexOf(opportunity.stage)
  const previous = index > 0 ? OPEN_STAGES[index - 1] : undefined
  const next = index >= 0 && index < OPEN_STAGES.length - 1 ? OPEN_STAGES[index + 1] : undefined

  const due = opportunity.nextActionDue
  const overdue = due !== undefined && due < today

  const move = (stage: OpportunityStage) => {
    if (stage === opportunity.stage) return
    actions.setOpportunityStage(opportunity.id, stage)
    toast({
      title: `Moved to ${STAGE_META[stage].label}`,
      description: `${companyName} · ${opportunity.title}`,
      tone: stage === 'offer' || stage === 'accepted' ? 'positive' : 'neutral',
    })
  }

  const menuItems: DropdownMenuItem[] = [
    {
      id: 'open',
      label: 'Open details',
      icon: 'ArrowUpRight',
      onSelect: () => onOpen(opportunity.id),
    },
    ...STAGES.map((stage): DropdownMenuItem => {
      const meta = STAGE_META[stage]
      const verb = meta.terminal ? 'Close as' : terminal ? 'Reopen as' : 'Move to'
      return {
        id: `stage-${stage}`,
        label: `${verb} ${meta.label}`,
        disabled: stage === opportunity.stage,
        onSelect: () => move(stage),
      }
    }),
  ]

  return (
    <Card
      interactive
      className={cn('h-full', compact ? 'gap-2 p-3' : 'gap-2.5 p-4', className)}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => onOpen(opportunity.id)}
          className="min-w-0 flex-1 rounded-sm text-left outline-accent focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              title={`${PRIORITY_LABEL[opportunity.priority]} priority`}
              className={cn(
                'inline-block size-2 shrink-0 rounded-full',
                PRIORITY_DOT[opportunity.priority],
              )}
            />
            <span className="sr-only">{PRIORITY_LABEL[opportunity.priority]} priority.</span>
            <span className="truncate text-sm font-semibold text-ink">{companyName}</span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-muted">{opportunity.title}</span>
        </button>

        <DropdownMenu
          items={menuItems}
          label={`Actions for ${opportunity.title} at ${companyName}`}
          className="-mt-1.5 -mr-1.5"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge size="sm" tone={opportunity.type === 'internship' ? 'info' : 'accent'}>
          {TYPE_LABEL[opportunity.type]}
        </Badge>
        {!compact ? <StageBadge stage={opportunity.stage} size="sm" /> : null}
        {contact ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-ink-muted">
            <Icon name="User" size={12} />
            <span className="truncate">{contact.name}</span>
          </span>
        ) : null}
      </div>

      {opportunity.nextAction || due ? (
        <p
          className={cn(
            'flex items-center gap-1.5 text-xs',
            overdue ? 'text-danger' : 'text-ink-muted',
          )}
        >
          <Icon name={overdue ? 'TriangleAlert' : 'CalendarClock'} size={13} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{opportunity.nextAction ?? 'Follow up'}</span>
          {due ? (
            <span className="shrink-0 font-mono tabular-nums">
              {overdue ? `overdue · ${relativeDay(due)}` : relativeDay(due)}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="font-mono text-[11px] tabular-nums text-ink-faint">
          {quietLabel(quietDays)}
        </span>

        {terminal ? (
          compact ? (
            <StageBadge stage={opportunity.stage} size="sm" />
          ) : opportunity.closedAt ? (
            <span className="font-mono text-[11px] tabular-nums text-ink-faint">
              closed {relativeDay(new Date(opportunity.closedAt)).toLowerCase()}
            </span>
          ) : null
        ) : (
          <div className="-mr-1 flex items-center">
            <Button
              size="icon"
              variant="ghost"
              icon="ArrowLeft"
              disabled={!previous}
              aria-label={
                previous
                  ? `Move back to ${STAGE_META[previous].label}`
                  : 'Already at the first stage'
              }
              onClick={() => previous && move(previous)}
              className="size-8"
            />
            <Button
              size="icon"
              variant="ghost"
              icon="ArrowRight"
              disabled={!next}
              aria-label={
                next ? `Move forward to ${STAGE_META[next].label}` : 'Already at the last open stage'
              }
              onClick={() => next && move(next)}
              className="size-8"
            />
          </div>
        )}
      </div>
    </Card>
  )
}
