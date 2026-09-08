import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Company, CompanyFact } from '@/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { formatDayLong, formatDayShort, toISODate } from '@/utils/date'
import { truncate } from '@/utils/format'

export interface FactListProps {
  company: Company
  className?: string
}

/** "acme.com" → "https://acme.com"; a value that already has a scheme is untouched. */
function withScheme(url: string): string {
  const value = url.trim()
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
}

/** The hostname of a source, without "www.", for the link label. */
function sourceLabel(url: string): string {
  try {
    return new URL(withScheme(url)).hostname.replace(/^www\./, '')
  } catch {
    return 'Source'
  }
}

function factDay(fact: CompanyFact): string | undefined {
  const parsed = new Date(fact.addedAt)
  if (Number.isNaN(parsed.getTime())) return undefined
  return toISODate(parsed)
}

/**
 * What is known about a company, each line with where it came from.
 *
 * A fact without a source is allowed — sometimes it is something a person
 * said — but the URL field sits right beside the text so citing is the easy
 * path. Removing a fact is undoable from the toast rather than gated behind a
 * confirmation: it is one line, and re-adding it is a click.
 */
export function FactList({ company, className }: FactListProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()

  const [text, setText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [urlError, setUrlError] = useState<string | undefined>(undefined)

  const canAdd = text.trim().length > 0

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canAdd) return

    const url = sourceUrl.trim()
    let normalised: string | undefined
    if (url) {
      normalised = withScheme(url)
      try {
        new URL(normalised)
      } catch {
        setUrlError('That does not look like a URL. Paste the full address or leave it empty.')
        return
      }
    }

    const fact = actions.addCompanyFact(company.id, text, normalised)
    setText('')
    setSourceUrl('')
    setUrlError(undefined)
    toast({
      title: 'Fact added',
      description: truncate(fact.text, 80),
      tone: 'positive',
      duration: 2500,
    })
  }

  function handleRemove(fact: CompanyFact) {
    actions.removeCompanyFact(company.id, fact.id)
    toast({
      title: 'Fact removed',
      description: truncate(fact.text, 80),
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          actions.addCompanyFact(company.id, fact.text, fact.sourceUrl)
        },
      },
    })
  }

  return (
    <div className={cn('space-y-4', className)}>
      {company.facts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface-muted/40 px-4 py-5 text-center text-sm leading-relaxed text-ink-muted">
          Nothing recorded yet. The first fact is usually the reason you shortlisted them — with
          the link that proves it.
        </p>
      ) : (
        <ul aria-label={`Facts about ${company.name}`} className="divide-y divide-line">
          {company.facts.map((fact) => {
            const day = factDay(fact)
            return (
              <li key={fact.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <Icon name="Dot" size={16} className="mt-1 shrink-0 text-ink-faint" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-ink">{fact.text}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-faint">
                    {fact.sourceUrl ? (
                      <a
                        href={withScheme(fact.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-sm text-ink-muted underline-offset-2 hover:text-accent hover:underline"
                      >
                        <Icon name="ExternalLink" size={12} />
                        {sourceLabel(fact.sourceUrl)}
                        <span className="sr-only"> (source, opens in a new tab)</span>
                      </a>
                    ) : (
                      <span>No source</span>
                    )}
                    {day ? (
                      <time dateTime={day} title={formatDayLong(day)} className="font-mono tabular-nums">
                        {formatDayShort(day)}
                      </time>
                    ) : null}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  icon="X"
                  aria-label={`Remove fact: ${truncate(fact.text, 60)}`}
                  onClick={() => handleRemove(fact)}
                  className="-mt-1 -mr-2 shrink-0"
                />
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} noValidate className="space-y-3 rounded-xl bg-surface-muted/60 p-3">
        <Field label="New fact" required>
          <Textarea
            autoGrow
            rows={2}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Hiring two backend interns for the winter cohort, per their careers page."
            className="bg-surface"
          />
        </Field>
        <Field
          label="Source URL"
          hint="Optional, but a fact with a link ages better."
          error={urlError}
        >
          <Input
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(event) => {
              setSourceUrl(event.target.value)
              if (urlError) setUrlError(undefined)
            }}
            placeholder="https://"
            autoComplete="off"
            className="bg-surface"
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" icon="Plus" disabled={!canAdd}>
            Add fact
          </Button>
        </div>
      </form>
    </div>
  )
}
