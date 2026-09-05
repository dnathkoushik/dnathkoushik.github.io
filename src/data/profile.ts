/**
 * WHO YOU ARE. Edit this file first.
 *
 * Everything here is public and ships in the deployed bundle.
 *
 * TO ADD YOUR RESUME:
 *   1. Drop the current PDF into `public/` as `resume.pdf`
 *   2. Change `resumeUrl` below from `undefined` to `'resume.pdf'`
 * Until you do, every "Resume" button hides itself rather than linking to a
 * file that is not there.
 *
 * Your phone number is deliberately NOT here. It is fine on a PDF you hand to a
 * named recruiter; on a public page it is a magnet for scrapers. Add it to
 * `socials` below if you disagree.
 */

import type { Profile } from '@/types/portfolio'

/** Square image for the hero and the header. Pulled from your GitHub profile. */
const avatar: string | undefined = 'avatar.jpg'

/**
 * Your CV. Drop the PDF in `public/` and set this to `'resume.pdf'`.
 * See the note at the top of this file.
 */
const resumeUrl: string | undefined = undefined

export const profile = {
  name: 'Koushik Debnath',
  headline: 'Software engineer — backend systems, and the deterministic half of AI products',
  intro:
    'Electrical Engineering at IIT Kharagpur with a CS minor, currently the sole engineer on a production GTM platform at Insurge AI. I like the parts of a system that have to be right every time: schemas, scoring, and the code that decides whether a model was actually correct.',
  bio: [
    'I am a final-year B.Tech (Hons.) student at IIT Kharagpur, studying Electrical Engineering with a minor in Computer Science. Most of what I have built sits on the backend — FastAPI services, schema and migration design, and test suites large enough that I trust them to tell me when I have broken something.',
    'The through-line in my last two internships has been making non-deterministic systems answerable. At Salesforce I built a rendered-output evaluation pipeline so that a design-guidance agent was scored on the pixels it actually produced, not on text a linter could see — and made the metric trustworthy by recomputing scores from per-question weights instead of trusting the model to grade itself. At Insurge AI I separated extraction from scoring entirely: model calls emit facts with a source URL and a confidence, and the scoring on top of them is plain deterministic Python, so every score is reproducible and traceable back to a citation.',
    'Alongside that I compete. I am LeetCode Guardian at a 2300+ rating, roughly the top 0.5% worldwide, and Codeforces Expert. Twelve hundred problems has mostly taught me pattern recognition and the discipline of getting an approach right on paper before typing — which turns out to matter far more in a code review than in a contest.',
  ],
  location: 'Kharagpur, India',
  email: 'koushikcomhere@gmail.com',
  avatar,
  initials: 'KD',
  resumeUrl,
  /** Set to undefined to hide the availability pill entirely. */
  availability: 'Graduating May 2027 · open to new-grad software engineering roles',
  socials: [
    {
      id: 'github',
      label: 'GitHub',
      handle: '@dnathkoushik',
      href: 'https://github.com/dnathkoushik',
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      handle: 'in/dnathkoushik',
      href: 'https://www.linkedin.com/in/dnathkoushik/',
    },
    {
      id: 'leetcode',
      label: 'LeetCode',
      handle: '@dnathkoushik',
      href: 'https://leetcode.com/u/dnathkoushik/',
    },
    {
      id: 'codeforces',
      label: 'Codeforces',
      handle: 'kdisback',
      href: 'https://codeforces.com/profile/kdisback',
    },
    {
      id: 'email',
      label: 'Email',
      handle: 'koushikcomhere@gmail.com',
      href: 'mailto:koushikcomhere@gmail.com',
    },
  ],
} satisfies Profile
