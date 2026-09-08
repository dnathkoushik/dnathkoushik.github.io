import { Link } from 'react-router-dom'
import type {
  Company,
  Contact,
  MessageTemplate,
  Opportunity,
  Tone,
  Touch,
  TouchDirection,
  TouchOutcome,
} from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { formatDayShort } from '@/utils/date'
import { CHANNEL_META } from '@/utils/outreach'

/** Labels and tones for the outcome chip. Every outcome carries its text — never colour alone. */
// eslint-disable-next-line react-refresh/only-export-components
export const OUTCOME_META: Record<TouchOutcome, { label: string; tone: Tone }> = {
  'no-reply': { label: 'No reply', tone: 'neutral' },
  replied: { label: 'Replied', tone: 'info' },
  positive: { label: 'Positive', tone: 'positive' },
  negative: { label: 'Negative', tone: 'danger' },
  scheduled: { label: 'Scheduled', tone: 'accent' },
}

/**
 * Direction glyphs. `ArrowDownLeft` is not in the curated icon map, so inbound
 * uses the other diagonal; the visible "Sent" / "Received" text is what carries
 * the meaning.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const DIRECTION_META: Record<
  TouchDirection,
  { label: string; icon: string; className: string }
> = {
  outbound: { label: 'Sent', icon: 'ArrowUpRight', className: 'bg-accent-soft text-accent' },
  inbound: {
    label: 'Received',
    icon: 'ArrowDownRight',
    className: 'bg-positive-soft text-positive',
  },
}

export interface TouchRowProps {
  touch: Touch
  /** Resolved by the list so a hundred rows do not each build their own maps. */
  company?: Company
  contact?: Contact
  opportunity?: Opportunity
  template?: MessageTemplate
  /** Company · contact · role links under the summary. */
  showLinks?: boolean
  /** Hidden when the surrounding list is already grouped by day. */
  showDate?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

const LINK_CLASS =
  'inline-flex max-w-full items-center gap-1 truncate rounded-sm underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/**
 * One interaction. Renders as an `<li>`; `TouchList` owns the `<ul>`.
 *
 * The row reads left to right the way the question is asked: when, which way,
 * over what channel, what was said, and who it was with.
 */
export function TouchRow({
  touch,
  company,
  contact,
  opportunity,
  template,
  showLinks = false,
  showDate = true,
  onEdit,
  onDelete,
}: TouchRowProps) {
  const direction = DIRECTION_META[touch.direction]
  const channel = CHANNEL_META[touch.channel]
  const outcome = touch.outcome ? OUTCOME_META[touch.outcome] : undefined
  const templateName = template?.name ?? (touch.templateId ? '(deleted template)' : undefined)

  const menuItems: DropdownMenuItem[] = []
  if (onEdit) menuItems.push({ id: 'edit', label: 'Edit touch', icon: 'Pencil', onSelect: onEdit })
  if (onDelete) {
    menuItems.push({
      id: 'delete',
      label: 'Delete',
      icon: 'Trash',
      tone: 'danger',
      onSelect: onDelete,
    })
  }

  const hasLinks = showLinks && Boolean(company || contact || opportunity)

  return (
    <li className="flex items-start gap-3 px-3 py-3 sm:px-4">
      <div className="w-14 shrink-0 pt-0.5 font-mono text-[11px] leading-4 text-ink-faint tabular-nums sm:w-16">
        {showDate ? (
          <time dateTime={touch.date} className="block">
            {formatDayShort(touch.date)}
          </time>
        ) : null}
        {touch.time ? (
          <time dateTime={`${touch.date}T${touch.time}`} className="block">
            {touch.time}
          </time>
        ) : showDate ? null : (
          <span className="block" aria-hidden="true">
            —
          </span>
        )}
      </div>

      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          direction.className,
        )}
      >
        <Icon name={direction.icon} size={14} />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          <span className="font-medium text-ink">{direction.label}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Icon name={channel.icon} size={12} />
            {channel.label}
          </span>
          {outcome ? (
            <Badge tone={outcome.tone} size="sm">
              {outcome.label}
            </Badge>
          ) : null}
        </div>

        <p className="text-sm leading-relaxed text-ink">{touch.summary}</p>

        {hasLinks || templateName ? (
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-faint">
            {showLinks && company ? (
              <Link
                to={`${PERSONAL_ROUTES.outreachCompanies}?id=${encodeURIComponent(company.id)}`}
                className={LINK_CLASS}
              >
                <Icon name="Building2" size={12} />
                <span className="truncate">{company.name}</span>
              </Link>
            ) : null}
            {showLinks && contact ? (
              <Link
                to={`${PERSONAL_ROUTES.outreachContacts}?id=${encodeURIComponent(contact.id)}`}
                className={LINK_CLASS}
              >
                <Icon name="User" size={12} />
                <span className="truncate">{contact.name}</span>
              </Link>
            ) : null}
            {showLinks && opportunity ? (
              <Link
                to={`${PERSONAL_ROUTES.outreachPipeline}?id=${encodeURIComponent(opportunity.id)}`}
                className={LINK_CLASS}
              >
                <Icon name="Briefcase" size={12} />
                <span className="truncate">{opportunity.title}</span>
              </Link>
            ) : null}
            {templateName ? (
              <span className="inline-flex max-w-full items-center gap-1">
                <Icon name="MessageSquare" size={12} />
                <span className="truncate">via {templateName}</span>
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {menuItems.length > 0 ? (
        <DropdownMenu
          items={menuItems}
          label={`Actions for touch: ${touch.summary}`}
          align="end"
          className="-my-1 -mr-1"
        />
      ) : null}
    </li>
  )
}
