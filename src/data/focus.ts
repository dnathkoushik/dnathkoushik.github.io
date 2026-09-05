/**
 * WHAT YOU ARE WORKING ON, AND HOW YOU THINK.
 *
 * `currentFocus` renders as the "Currently working on" strip on the home page.
 * Keep it to 3-5 items and rewrite it whenever your focus genuinely changes —
 * a stale focus list is worse than none.
 *
 * `philosophy` renders on /about. Rewrite these in your own words when you have
 * a spare ten minutes; they are drawn from how you actually describe your work,
 * but they should sound like you.
 */

import type { FocusItem, Philosophy } from '@/types/portfolio'

export const currentFocus = [
  {
    label: 'Backend systems at Insurge AI',
    detail:
      'Sole engineer on a production GTM platform — schema, API surface, migrations and a 514-case test suite.',
  },
  {
    label: 'Making model output measurable',
    detail:
      'Evaluation harnesses and deterministic scoring: if a system is non-deterministic, the thing judging it should not be.',
  },
  {
    label: 'Competitive programming',
    detail: 'LeetCode Guardian and Codeforces Expert. Contests most weeks, graphs and DP most days.',
  },
  {
    label: 'System design',
    detail:
      'Reading case studies, then re-drawing them from memory until I can defend the trade-offs rather than recite them.',
  },
] satisfies FocusItem[]

export const philosophy = [
  {
    title: 'Keep the deterministic part deterministic',
    body: 'The most useful thing I did at Insurge AI was refuse to let a model do two jobs at once. Extraction is allowed to be fuzzy — it emits facts with a source URL and a confidence. Scoring on top of those facts is plain Python with no model in the loop, so every number is reproducible, traceable to a citation, and re-tunable without paying to re-run research. Most "AI is unpredictable" problems are really "we let the unpredictable part leak too far downstream" problems.',
  },
  {
    title: 'Do not let the thing grade its own homework',
    body: 'Building the evaluation pipeline at Salesforce taught me that a metric is only as trustworthy as its worst incentive. Asking a model for a score gets you a number that drifts; recomputing it yourself from per-question weights gets you one you can defend. The same instinct applies to a failed run — scoring it zero silently punishes infrastructure flakiness, so a neutral 0.5 keeps the aggregate honest.',
  },
  {
    title: 'Understand one layer below the one you are using',
    body: 'I wrote a Huffman compressor that packs bits by hand and a metro planner that implements Dijkstra rather than importing it, because I wanted the algorithms to be something I could reconstruct rather than something I could call. That habit pays off in every debugging session where the library is doing exactly what it said it would, just not what I assumed.',
  },
] satisfies Philosophy[]
