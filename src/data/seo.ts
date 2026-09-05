/**
 * SEO. Feeds <title>, the meta description, Open Graph tags, the canonical
 * link and the generated sitemap.
 *
 * `siteUrl` must match the real deployed origin. This is a GitHub *user site*
 * (repo `dnathkoushik.github.io`), so it is served from the domain root and the
 * base path is "/". If you ever move to a project repo, the Actions workflow
 * derives the sub-path automatically — but this value still has to change.
 */

import type { SeoConfig } from '@/types/portfolio'

export const seo = {
  siteUrl: 'https://dnathkoushik.github.io',
  title: 'Koushik Debnath — Software Engineer',
  description:
    'Software engineer at IIT Kharagpur working on backend systems, evaluation pipelines and competitive programming. LeetCode Guardian, Codeforces Expert.',
  ogImage: 'og-image.svg',
  keywords: [
    'Koushik Debnath',
    'software engineer',
    'backend engineer',
    'IIT Kharagpur',
    'FastAPI',
    'Python',
    'TypeScript',
    'competitive programming',
    'LeetCode Guardian',
    'data structures and algorithms',
  ],
} satisfies SeoConfig
