/**
 * ROLES. Newest first — the timeline renders them in array order.
 *
 * `endDate` is optional: omit it for a role you currently hold and the UI
 * renders "Present".
 */

import type { Experience } from '@/types/portfolio'

export const experience = [
  {
    id: 'insurge-ai',
    company: 'Insurge AI',
    position: 'Software Engineer Intern',
    startDate: '2026-07',
    location: 'Remote',
    type: 'internship',
    description:
      'Funded early-stage B2B SaaS startup. Sole engineer on a production go-to-market automation platform, owning schema design, the API surface, migrations and the automated test suite.',
    achievements: [
      'Sole engineer on a production GTM automation platform serving 105 companies, 325 contacts and 2,056 source-cited facts; owned schema design, API surface, migrations and a 514-case automated test suite.',
      'Cut a four-call research stage to roughly one call of wall-clock time by parallelising four independent workers behind an identity-resolution barrier, with per-stage failure isolation so a single timeout degrades the result instead of failing the request.',
      'Separated non-deterministic extraction from scoring: model calls emit facts with a source URL and a confidence, while ICP scoring is pure deterministic Python over stored facts — making every score reproducible, auditable to a citation, and re-tunable without re-running research.',
      'Built an 8-stage document-structure engine that annotates every heading, bullet and sentence in a PDF or deck with exact bounding boxes derived from the vector text layer — fully deterministic, offline, no ML — at 7–62 ms per page across 46 tests with a headless-Chrome end-to-end harness.',
      'Enforced messaging constraints as a server-side gate returning HTTP 409, and shipped a near-duplicate detector that flagged 11 of 23 drafts as templated.',
      'Mentor 2 interns — scoping, code review and delivery timelines.',
    ],
    technologies: ['Python', 'FastAPI', 'SQLAlchemy', 'Alembic', 'Next.js', 'PyMuPDF'],
  },
  {
    id: 'salesforce',
    company: 'Salesforce',
    position: 'Software Engineering Intern (AMTS), Design Intelligence',
    startDate: '2026-05',
    endDate: '2026-07',
    location: 'Hyderabad, India',
    type: 'internship',
    description:
      'Only intern on the Design Intelligence team. Worked on the evaluation harness for `applying-slds`, an agent skill distributed to developer AI IDEs including Claude Code, Cursor and Windsurf. Received a pre-placement offer as Software Engineer I.',
    achievements: [
      'Shipped 4 reviewed pull requests into the production repository that evaluates applying-slds, an agent skill distributed to developer AI IDEs (Claude Code, Cursor, Windsurf).',
      'Built a rendered-output evaluation pipeline end to end — render, headless Playwright screenshot, vision model grounded on the same design guidance, weighted binary rubric — closing a gap where the existing linter and text-only scorers never saw the rendered pixels.',
      'Made the metric trustworthy by recomputing scores from per-question weights rather than the model’s self-reported number, and assigning failed runs a neutral 0.5 so infrastructure errors neither tanked nor inflated the aggregate.',
      'Blended linter, text and vision signals into a single 0–100 readiness score, then mined recurring failures across repeated runs to rewrite the design guidance — lifting mean readiness from 82 to 88 across 10 prompt suites, +24 points over the ungrounded baseline.',
      'Received a pre-placement offer as Software Engineer I.',
    ],
    technologies: ['TypeScript', 'Playwright', 'Node.js', 'Vision models', 'Rubric design'],
  },
] satisfies Experience[]
