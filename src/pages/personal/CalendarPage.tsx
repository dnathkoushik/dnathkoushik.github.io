import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PERSONAL_ROUTES } from '@/config/routes'
import type { ISODate, MonthKey } from '@/types'
import { heatmapData } from '@/utils/analytics'
import {
  durationLabel,
  formatMonthLabel,
  monthKeyOf,
  monthRange,
  shiftMonth,
  todayISO,
} from '@/utils/date'
import { usePersonalData } from '@/providers/personalDataContext'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { DaySummary } from '@/components/calendar/DaySummary'
import { MonthGrid, monthGridRange } from '@/components/calendar/MonthGrid'
import type { CalendarDay } from '@/components/calendar/MonthGrid'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Every year the user could plausibly want: recent, next, and any with data. */
function selectableYears(dates: ISODate[], focused: MonthKey): number[] {
  const current = new Date().getFullYear()
  const years = new Set<number>()
  for (let year = current - 2; year <= current + 1; year += 1) years.add(year)
  for (const date of dates) {
    const year = Number(date.slice(0, 4))
    if (Number.isFinite(year) && year > 1970) years.add(year)
  }
  years.add(Number(focused.slice(0, 4)))
  return [...years].sort((a, b) => a - b)
}

/**
 * Browse any day of any month.
 *
 * The selected day lives in the URL (`?date=`), which is what makes every
 * "open this day" link elsewhere in the dashboard — and the browser's own back
 * button — land exactly where you expect.
 */
export default function CalendarPage() {
  useDocumentMeta({
    title: 'Calendar',
    description: 'Browse any day of any month in your private dashboard.',
    noindex: true,
    canonicalPath: PERSONAL_ROUTES.calendar,
  })

  const { db } = usePersonalData()
  const [params, setParams] = useSearchParams()
  const isCompact = useMediaQuery('(max-width: 1023px)')

  const raw = params.get('date')
  const selected: ISODate = raw && ISO_DATE.test(raw) ? raw : todayISO()

  const [monthKey, setMonthKey] = useState<MonthKey>(() => monthKeyOf(selected))
  const [lastSelected, setLastSelected] = useState<ISODate>(selected)
  const summaryRef = useRef<HTMLDivElement>(null)
  const scrollAfterSelect = useRef(false)

  /*
   * Follow the selection across month boundaries, including deep links. Derived
   * during render — an effect would paint one frame of the wrong month first.
   * Paging with the arrows leaves `selected` alone, so the month stays put.
   */
  if (selected !== lastSelected) {
    setLastSelected(selected)
    setMonthKey(monthKeyOf(selected))
  }

  useEffect(() => {
    if (!scrollAfterSelect.current) return
    scrollAfterSelect.current = false
    if (!isCompact) return
    summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selected, isCompact])

  function selectDate(date: ISODate) {
    scrollAfterSelect.current = true
    setParams({ date }, { replace: true })
  }

  const weekStartsOn = db.settings.weekStartsOn

  const cells = useMemo<CalendarDay[]>(() => {
    const { start, end, days } = monthGridRange(monthKey, weekStartsOn)
    const heat = heatmapData(db, start, end)

    const noteCounts = new Map<ISODate, number>()
    for (const note of db.notes) {
      if (note.date < start || note.date > end) continue
      noteCounts.set(note.date, (noteCounts.get(note.date) ?? 0) + 1)
    }

    return days.map((date, index) => {
      const cell = heat[index]
      return {
        date,
        inMonth: date.slice(0, 7) === monthKey,
        score: cell.score,
        level: cell.level,
        tasksTotal: cell.tasksTotal,
        tasksCompleted: cell.tasksCompleted,
        loggedMinutes: cell.loggedMinutes,
        habitsDone: cell.habitsDone,
        notes: noteCounts.get(date) ?? 0,
        hasEntries: cell.hasEntries,
      }
    })
  }, [db, monthKey, weekStartsOn])

  const monthSummary = useMemo(() => {
    const inMonth = cells.filter((cell) => cell.inMonth)
    const active = inMonth.filter((cell) => cell.hasEntries)
    const tasksCompleted = inMonth.reduce((sum, cell) => sum + cell.tasksCompleted, 0)
    const tasksTotal = inMonth.reduce((sum, cell) => sum + cell.tasksTotal, 0)
    const minutes = inMonth.reduce((sum, cell) => sum + cell.loggedMinutes, 0)
    const score = active.length
      ? Math.round(active.reduce((sum, cell) => sum + cell.score, 0) / active.length)
      : 0
    return { days: inMonth.length, active: active.length, tasksCompleted, tasksTotal, minutes, score }
  }, [cells])

  const years = useMemo(
    () =>
      selectableYears(
        [
          ...db.tasks.map((task) => task.date),
          ...db.logs.map((entry) => entry.date),
          ...db.notes.map((note) => note.date),
          ...db.days.map((day) => day.date),
        ],
        monthKey,
      ),
    [db, monthKey],
  )

  const monthIndex = Number(monthKey.slice(5, 7)) - 1
  const year = Number(monthKey.slice(0, 4))
  const monthDays = monthRange(monthKey).days

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Calendar"
        title={formatMonthLabel(monthKey)}
        description={`${monthSummary.active} of ${monthSummary.days} days have something recorded · ${monthSummary.tasksCompleted}/${monthSummary.tasksTotal} tasks done · ${durationLabel(monthSummary.minutes)} logged`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="icon"
                icon="ChevronLeft"
                aria-label={`Go to ${formatMonthLabel(shiftMonth(monthKey, -1))}`}
                onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
              />
              <Button
                variant="secondary"
                size="icon"
                icon="ChevronRight"
                aria-label={`Go to ${formatMonthLabel(shiftMonth(monthKey, 1))}`}
                onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
              />
            </div>

            <Button variant="secondary" icon="CalendarCheck" onClick={() => selectDate(todayISO())}>
              Today
            </Button>

            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="calendar-month">
                Month
              </label>
              <Select
                id="calendar-month"
                value={String(monthIndex)}
                onChange={(event) =>
                  setMonthKey(`${year}-${String(Number(event.target.value) + 1).padStart(2, '0')}`)
                }
                className="h-9 w-32"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </Select>

              <label className="sr-only" htmlFor="calendar-year">
                Year
              </label>
              <Select
                id="calendar-year"
                value={String(year)}
                onChange={(event) =>
                  setMonthKey(`${event.target.value}-${String(monthIndex + 1).padStart(2, '0')}`)
                }
                className="h-9 w-24"
              >
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="calendar-grid-heading" className="min-w-0 space-y-3 animate-rise">
          <h2 id="calendar-grid-heading" className="sr-only">
            {formatMonthLabel(monthKey)} — {monthDays.length} days, average productivity{' '}
            {monthSummary.score} out of 100
          </h2>

          <Card>
            <CardContent className="px-2 pt-4 pb-4 sm:px-5 sm:pb-5">
              <MonthGrid
                monthKey={monthKey}
                days={cells}
                selected={selected}
                weekStartsOn={weekStartsOn}
                onSelect={selectDate}
                onMonthChange={setMonthKey}
                labelledBy="calendar-grid-heading"
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              Tasks
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-info" />
              Work log
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
              Notes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-ink-faint">Productivity</span>
              <span aria-hidden="true" className="flex items-center gap-0.5">
                <span className="h-1.5 w-3 rounded-full bg-accent/25" />
                <span className="h-1.5 w-3 rounded-full bg-accent/45" />
                <span className="h-1.5 w-3 rounded-full bg-accent/70" />
                <span className="h-1.5 w-3 rounded-full bg-accent" />
              </span>
              <span className="text-ink-faint">low to high</span>
            </span>
          </div>

          <p className="px-1 text-xs leading-relaxed text-ink-faint">
            Arrow keys move day by day, Page Up and Page Down move by month, Home and End jump to
            the ends of the week, and Enter opens the day.
          </p>
        </section>

        <div ref={summaryRef} className="min-w-0 scroll-mt-4">
          <DaySummary date={selected} db={db} />
        </div>
      </div>
    </div>
  )
}
