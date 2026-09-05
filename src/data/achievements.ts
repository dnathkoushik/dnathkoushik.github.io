/**
 * ACHIEVEMENTS. Grouped on the page by `kind`; `featured` lifts one into the
 * highlights row. `metric` is the headline figure and renders in mono.
 *
 * NOTE ON DATES: your resume states the facts but not always the month. Where a
 * date was not stated I used the month the thing is anchored to (exam dates,
 * end of internship, current standing). Adjust any that are wrong — the page
 * sorts and groups by them.
 */

import type { Achievement } from '@/types/portfolio'

export const achievements = [
  {
    id: 'leetcode-guardian',
    title: 'LeetCode Guardian',
    kind: 'competitive-programming',
    issuer: 'LeetCode',
    date: '2026-08-01',
    metric: '2300+ rating · top 0.5% worldwide',
    description:
      '1200+ problems solved. Best contest ranks of 35, 75 and 194 among 25,000+ participants.',
    url: 'https://leetcode.com/u/dnathkoushik/',
    featured: true,
  },
  {
    id: 'codeforces-expert',
    title: 'Codeforces Expert',
    kind: 'competitive-programming',
    issuer: 'Codeforces',
    date: '2026-08-01',
    metric: 'Peak rating 1800+',
    description:
      'Global rank 545 — top 3.5% — among 17,000+ participants in Round 1012 (Div. 2).',
    url: 'https://codeforces.com/profile/kdisback',
    featured: true,
  },
  {
    id: 'salesforce-ppo',
    title: 'Pre-placement offer, Software Engineer I',
    kind: 'milestone',
    issuer: 'Salesforce',
    date: '2026-07-01',
    metric: 'Only intern on the team',
    description:
      'Offered a full-time Software Engineer I role following the Design Intelligence internship, after shipping four reviewed pull requests into the production evaluation repository.',
    featured: true,
  },
  {
    id: 'jee-advanced-2023',
    title: 'All India Rank, JEE Advanced 2023',
    kind: 'academic',
    issuer: 'IIT / JEE Advanced',
    date: '2023-06-04',
    metric: '4-digit AIR',
    description: 'Among approximately 2.5 lakh candidates. Admitted to IIT Kharagpur.',
    featured: true,
  },
  {
    id: 'jee-main-2023',
    title: '99.34 percentile, JEE Main 2023',
    kind: 'academic',
    issuer: 'National Testing Agency',
    date: '2023-04-15',
    metric: '99.34 percentile',
    description: 'Among approximately 1.2 million applicants.',
    featured: false,
  },
  {
    id: 'grimoire-of-code',
    title: 'Associate Member, Grimoire of Code',
    kind: 'milestone',
    issuer: 'IIT Kharagpur',
    date: '2024-08-01',
    metric: '2,000+ students reached',
    description:
      'Organised competitive programming contests for the institute, ran DSA learning sessions, and helped run a mentor–mentee programme.',
    featured: false,
  },
] satisfies Achievement[]
