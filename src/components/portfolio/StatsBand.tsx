import { Counter, Stagger } from '@/motion'
import { cn } from '@/lib/cn'

interface Stat {
  value: number
  label: string
  note: string
  prefix?: string
  suffix?: string
  decimals?: number
}

/*
 * Display copy, not computed data. Each figure is stated in the content files
 * and repeated here as a number so it can count up:
 *   2300+ rating and 1200+ problems .... src/data/achievements.ts ('leetcode-guardian')
 *   #545 global rank ................... src/data/achievements.ts ('codeforces-expert')
 *   8.42 / 10 CGPA ..................... src/data/education.ts   ('iit-kharagpur')
 * If one of those changes, change it here too.
 */
const STATS: Stat[] = [
  {
    value: 2300,
    suffix: '+',
    label: 'LeetCode rating',
    note: 'Guardian · top 0.5% worldwide',
  },
  {
    value: 1200,
    suffix: '+',
    label: 'Problems solved',
    note: 'Best contest rank 35 of 25,000+',
  },
  {
    value: 8.42,
    decimals: 2,
    suffix: ' / 10',
    label: 'CGPA',
    note: 'B.Tech (Hons.), IIT Kharagpur',
  },
  {
    value: 545,
    prefix: '#',
    label: 'Codeforces global rank',
    note: 'Round 1012 (Div. 2) · top 3.5%',
  },
]

/**
 * Four numbers in a full-bleed band under the hero. Each counts up as the band
 * scrolls in; under reduced motion the final values are simply printed.
 *
 * The hairlines are computed per cell so the 2×2 layout on phones and the 1×4
 * layout on desktop both close cleanly — no border ever hangs in space.
 */
export function StatsBand() {
  return (
    <section aria-label="By the numbers" className="border-y border-line">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <Stagger as="dl" stagger={0.08} y={20} className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                'flex min-w-0 flex-col-reverse gap-5 py-10 sm:py-14',
                index % 2 === 0 ? 'pr-5 sm:pr-10' : 'border-l border-line pl-5 sm:pl-10',
                index >= 2 && 'border-t border-line lg:border-t-0',
                index > 0 && 'lg:border-l lg:pl-10',
                index < 3 && 'lg:pr-10',
              )}
            >
              <dt>
                <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                  {stat.label}
                </span>
                <span className="mt-1.5 block text-sm leading-snug text-ink-muted">{stat.note}</span>
              </dt>

              <dd className="flex items-baseline gap-1 font-display text-[clamp(2.75rem,6vw,5rem)] leading-none font-semibold tracking-tight text-ink">
                {stat.prefix ? (
                  <span className="text-[0.5em] text-ink-muted">{stat.prefix}</span>
                ) : null}
                <Counter
                  to={stat.value}
                  decimals={stat.decimals}
                  className="[&>span]:font-display"
                />
                {stat.suffix ? (
                  <span className="text-[0.5em] text-ink-muted">{stat.suffix.trim()}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
