import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { WeeklyReview, WeekKey } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stat } from '@/components/ui/Stat'
import { ReviewField } from '@/components/review/ReviewField'
import { WeekPicker } from '@/components/review/WeekPicker'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { cn } from '@/lib/cn'
import { usePersonalData } from '@/providers/personalDataContext'
import { habitAdherence, isGoalReached, rangeStats } from '@/utils/analytics'
import {
  durationLabel,
  formatWeekLabel,
  isFutureDay,
  shiftWeek,
  todayISO,
  weekKeyOf,
  weekRange,
} from '@/utils/date'
import { percent, pluralize } from '@/utils/format'

const WEEK_KEY_RE = /^\d{4}-W\d{1,2}$/

/** How many weeks the "recent weeks" strip goes back. */
const RECENT_WEEKS = 8

type ReviewKey =
  | 'wentWell'
  | 'wentWrong'
  | 'learned'
  | 'improve'
  | 'biggestAchievement'
  | 'biggestMistake'
  | 'nextWeekFocus'

interface FieldSpec {
  key: ReviewKey
  label: string
  prompt: string
  icon: string
  placeholder: string
  rows?: number
}

const FIELDS: FieldSpec[] = [
  {
    key: 'wentWell',
    label: 'What went well',
    prompt: 'The things worth repeating. Name them so they stop being luck.',
    icon: 'ThumbsUp',
    placeholder: 'Shipped the retry logic on Tuesday and it held all week…',
  },
  {
    key: 'wentWrong',
    label: 'What went wrong',
    prompt: 'Be concrete. "Lost Wednesday evening to Slack" beats "was unfocused".',
    icon: 'TriangleAlert',
    placeholder: 'Lost most of Wednesday re-reading the same spec…',
  },
  {
    key: 'learned',
    label: 'What did I learn',
    prompt: 'One idea, technique or fact you did not have on Monday.',
    icon: 'Lightbulb',
    placeholder: 'Union-find with path compression is the right shape for…',
  },
  {
    key: 'improve',
    label: 'What should I improve',
    prompt: 'Something you can actually change in the next seven days.',
    icon: 'TrendingUp',
    placeholder: 'Start the hard task first, before opening anything else…',
  },
  {
    key: 'biggestAchievement',
    label: 'Biggest achievement',
    prompt: 'The one thing you would mention if somebody asked about this week.',
    icon: 'Trophy',
    placeholder: 'Finished the graph module and scored 8/10 on the mock…',
    rows: 2,
  },
  {
    key: 'biggestMistake',
    label: 'Biggest mistake',
    prompt: 'Written down once, so it only ever costs you once.',
    icon: 'CircleAlert',
    placeholder: 'Rewrote the parser before writing a single test…',
    rows: 2,
  },
  {
    key: 'nextWeekFocus',
    label: "Next week's focus",
    prompt: 'The single thread to pull on from Monday morning.',
    icon: 'Target',
    placeholder: 'Dynamic programming, one hour every morning before work…',
    rows: 2,
  },
]

const RATINGS = [1, 2, 3, 4, 5]
const RATING_LABELS: Record<number, string> = {
  1: 'Lost week',
  2: 'Below par',
  3: 'Solid',
  4: 'Strong',
  5: 'Exceptional',
}

function hasContent(review: WeeklyReview | undefined): boolean {
  if (!review) return false
  return FIELDS.some((field) => review[field.key].trim().length > 0) || Boolean(review.rating)
}

export default function ReviewPage() {
  useDocumentMeta({
    title: 'Weekly review',
    description: 'An end-of-week retrospective, stored privately in this browser.',
    noindex: true,
  })

  const { db, actions } = usePersonalData()
  const [params, setParams] = useSearchParams()
  const ratingRefs = useRef<(HTMLButtonElement | null)[]>([])

  const weekStartsOn = db.settings.weekStartsOn
  const today = todayISO()
  const currentWeek = weekKeyOf(today, weekStartsOn)
  const lastWeek = shiftWeek(currentWeek, -1, weekStartsOn)

  const weekParam = params.get('week')
  const weekKey: WeekKey = weekParam && WEEK_KEY_RE.test(weekParam) ? weekParam : currentWeek
  const week = weekRange(weekKey, weekStartsOn)
  const weekLabel = formatWeekLabel(weekKey, weekStartsOn)

  const selectWeek = (next: WeekKey) => {
    const draft = new URLSearchParams(params)
    draft.set('week', next)
    setParams(draft, { replace: true })
  }

  const reviewByWeek = useMemo(
    () => new Map(db.reviews.map((review) => [review.weekKey, review])),
    [db.reviews],
  )
  const review = reviewByWeek.get(weekKey)
  const written = hasContent(review)

  /* -- how the week actually went ---------------------------------------- */

  // Nothing has happened in the future, so a week still running is measured
  // only up to today. Otherwise every current-week review opens at 20 %.
  const measuredTo = isFutureDay(week.end) ? today : week.end
  const stats = useMemo(
    () => rangeStats(db, week.start, measuredTo),
    [db, week.start, measuredTo],
  )

  const habitSummary = useMemo(() => {
    let expected = 0
    let done = 0
    for (const habit of db.habits) {
      if (habit.archived) continue
      const adherence = habitAdherence(db, habit.id, week.start, measuredTo)
      expected += adherence.expected
      done += adherence.daysDone
    }
    return { expected, done, rate: Math.min(percent(done, expected), 100) }
  }, [db, week.start, measuredTo])

  const goalSummary = useMemo(() => {
    const goals = db.weeklyGoals.filter(
      (goal) => goal.weekKey === weekKey && goal.status !== 'archived',
    )
    return {
      total: goals.length,
      done: goals.filter(isGoalReached).length,
    }
  }, [db.weeklyGoals, weekKey])

  const recentWeeks = useMemo(
    () =>
      Array.from({ length: RECENT_WEEKS }, (_, index) =>
        shiftWeek(currentWeek, -index, weekStartsOn),
      ),
    [currentWeek, weekStartsOn],
  )

  /* -- writing ------------------------------------------------------------ */

  const saveField = (key: ReviewKey, next: string) => {
    const patch: Partial<WeeklyReview> = {}
    patch[key] = next
    actions.saveReview(weekKey, patch)
  }

  const rating = review?.rating
  const setRating = (value: number) => actions.saveReview(weekKey, { rating: value })

  const moveRating = (delta: number) => {
    const index = rating ? RATINGS.indexOf(rating) : -1
    const next = index === -1 ? 0 : (index + delta + RATINGS.length) % RATINGS.length
    setRating(RATINGS[next])
    ratingRefs.current[next]?.focus()
  }

  const [expanded, setExpanded] = useState(false)
  const visibleWeeks = expanded ? recentWeeks : recentWeeks.slice(0, 4)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={weekLabel}
        title="Weekly review"
        description="Read the numbers first, then write. Everything here saves as you type and never leaves this browser."
        actions={
          <>
            {weekKey !== lastWeek ? (
              <Button variant="secondary" icon="CalendarClock" onClick={() => selectWeek(lastWeek)}>
                Review last week
              </Button>
            ) : null}
            <Badge tone={written ? 'positive' : 'neutral'} icon={written ? 'Check' : 'PenLine'}>
              {written ? 'Written' : 'Not written yet'}
            </Badge>
          </>
        }
      />

      <WeekPicker
        weekKey={weekKey}
        weekStartsOn={weekStartsOn}
        onChange={selectWeek}
        className="justify-start"
      />

      <section aria-labelledby="week-facts-heading" className="space-y-3">
        <h2 id="week-facts-heading" className="text-lg font-semibold tracking-tight text-ink">
          How the week actually went
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Tasks completed"
            value={`${stats.tasksCompleted}/${stats.tasksTotal}`}
            sublabel={`${stats.completionRate}% of what you planned`}
            icon="ListTodo"
            tone={stats.completionRate >= 70 ? 'positive' : 'accent'}
          />
          <Stat
            label="Time logged"
            value={durationLabel(stats.loggedMinutes)}
            sublabel={`${pluralize(stats.activeDays, 'active day')} out of ${week.days.length}`}
            icon="Clock"
          />
          <Stat
            label="Habit adherence"
            value={`${habitSummary.rate}%`}
            sublabel={
              habitSummary.expected > 0
                ? `${habitSummary.done} of ${habitSummary.expected} target days met`
                : 'No habits were due this week'
            }
            icon="Flame"
            tone={habitSummary.rate >= 80 ? 'positive' : 'accent'}
          />
          <Stat
            label="Goals hit"
            value={`${goalSummary.done}/${goalSummary.total}`}
            sublabel={
              goalSummary.total > 0
                ? `${percent(goalSummary.done, goalSummary.total)}% of the goals you set`
                : 'No weekly goals were set'
            }
            icon="Target"
            tone={
              goalSummary.total > 0 && goalSummary.done === goalSummary.total ? 'positive' : 'accent'
            }
          />
        </div>

        <p className="text-sm leading-relaxed text-ink-muted">
          Longest run of productive days inside this week:{' '}
          <span className="font-mono font-medium text-ink tabular-nums">
            {pluralize(stats.bestStreak, 'day')}
          </span>
          . {stats.tasksTotal === 0 && stats.loggedMinutes === 0
            ? 'Nothing was recorded, so the prompts below are the whole record of the week.'
            : 'Write against these numbers rather than from memory.'}
        </p>
      </section>

      <Card className="animate-rise">
        <CardHeader>
          <CardTitle as="h2">Self rating</CardTitle>
          <p className="text-sm leading-relaxed text-ink-muted">
            One number for the whole week, decided before you start explaining it.
          </p>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Rate this week from 1 to 5"
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                moveRating(1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                moveRating(-1)
              }
            }}
            className="flex flex-wrap gap-2"
          >
            {RATINGS.map((value, index) => {
              const selected = rating === value
              return (
                <button
                  key={value}
                  ref={(node) => {
                    ratingRefs.current[index] = node
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${value} out of 5 — ${RATING_LABELS[value]}`}
                  tabIndex={selected || (rating === undefined && index === 0) ? 0 : -1}
                  onClick={() => setRating(value)}
                  className={cn(
                    'flex min-w-24 flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-3 transition-colors',
                    'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
                    selected
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface hover:bg-surface-hover',
                  )}
                >
                  <span
                    className={cn(
                      'font-mono text-lg font-semibold tabular-nums',
                      selected ? 'text-accent' : 'text-ink',
                    )}
                  >
                    {value}
                  </span>
                  <span
                    className={cn('text-xs', selected ? 'text-accent' : 'text-ink-faint')}
                    aria-hidden="true"
                  >
                    {RATING_LABELS[value]}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">The write-up</CardTitle>
          <p className="text-sm leading-relaxed text-ink-muted">
            Seven prompts for {weekLabel}. Each one saves on its own, as you type.
          </p>
        </CardHeader>
        <CardContent className="space-y-7">
          {FIELDS.map((field) => (
            <ReviewField
              // Remounting per week guarantees a pending draft is flushed and
              // the next week starts from its own stored text.
              key={`${weekKey}:${field.key}`}
              id={`review-${field.key}`}
              label={field.label}
              prompt={field.prompt}
              icon={field.icon}
              rows={field.rows}
              placeholder={field.placeholder}
              value={review?.[field.key] ?? ''}
              onCommit={(next) => saveField(field.key, next)}
            />
          ))}
        </CardContent>
      </Card>

      <section aria-labelledby="recent-weeks-heading" className="space-y-3">
        <h2 id="recent-weeks-heading" className="text-lg font-semibold tracking-tight text-ink">
          Recent weeks
        </h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          {`${recentWeeks.filter((key) => hasContent(reviewByWeek.get(key))).length} of the last ${RECENT_WEEKS} weeks have a review written.`}
        </p>

        <ul className="grid gap-2 sm:grid-cols-2">
          {visibleWeeks.map((key) => {
            const entry = reviewByWeek.get(key)
            const done = hasContent(entry)
            const active = key === weekKey
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => selectWeek(key)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                    'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface hover:bg-surface-hover',
                  )}
                >
                  <Icon
                    name={done ? 'CircleCheckBig' : 'CircleDashed'}
                    className={cn('size-4 shrink-0', done ? 'text-positive' : 'text-ink-faint')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[13px] font-medium text-ink tabular-nums">
                      {formatWeekLabel(key, weekStartsOn)}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {key === currentWeek
                        ? 'This week'
                        : key === lastWeek
                          ? 'Last week'
                          : done
                            ? 'Written'
                            : 'Not written'}
                    </span>
                  </span>
                  {entry?.rating ? (
                    <span className="shrink-0 font-mono text-xs text-ink-faint tabular-nums">
                      {entry.rating}/5
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>

        {recentWeeks.length > 4 ? (
          <Button
            variant="ghost"
            size="sm"
            icon={expanded ? 'ChevronUp' : 'ChevronDown'}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Show fewer weeks' : `Show all ${RECENT_WEEKS} weeks`}
          </Button>
        ) : null}
      </section>
    </div>
  )
}
