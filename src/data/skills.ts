/**
 * SKILLS, grouped into categories.
 *
 * `level` is one of 'strong' | 'working' | 'learning'. The UI shows the level
 * as both a 3-segment meter and a word, so it never relies on colour alone.
 * Be honest here — it is more useful to you in an interview than an inflated
 * list is.
 *
 * `icon` must be a name from the curated set in src/components/ui/Icon.tsx.
 */

import type { SkillCategory } from '@/types/portfolio'

export const skillCategories = [
  {
    id: 'languages',
    title: 'Languages',
    icon: 'Code',
    description: 'What I reach for, and how comfortably.',
    skills: [
      { name: 'C++', level: 'strong', note: 'Primary language for competitive programming and DSA' },
      { name: 'Python', level: 'strong', note: 'Backend services and data work' },
      { name: 'TypeScript', level: 'strong', note: 'Evaluation tooling at Salesforce, and this site' },
      { name: 'JavaScript', level: 'strong' },
      { name: 'SQL', level: 'working' },
      { name: 'C', level: 'working' },
      { name: 'HTML/CSS', level: 'working' },
    ],
  },
  {
    id: 'backend',
    title: 'Backend & Data',
    icon: 'Server',
    description: 'Where most of my professional work has been.',
    skills: [
      { name: 'FastAPI', level: 'strong', note: 'Production GTM platform at Insurge AI' },
      { name: 'SQLAlchemy', level: 'strong', note: 'Schema design and query layer' },
      { name: 'REST API design', level: 'strong' },
      { name: 'Alembic', level: 'working', note: 'Migrations on a live schema' },
      { name: 'Node.js', level: 'working' },
      { name: 'Express.js', level: 'working' },
      { name: 'PyMuPDF', level: 'working', note: 'Vector text-layer extraction for document parsing' },
    ],
  },
  {
    id: 'fundamentals',
    title: 'CS Fundamentals',
    icon: 'Brain',
    description: 'The coursework and the contest practice behind it.',
    skills: [
      { name: 'Data Structures & Algorithms', level: 'strong', note: '1200+ problems solved; LeetCode Guardian' },
      { name: 'Object-Oriented Programming', level: 'strong' },
      { name: 'Graph Algorithms', level: 'strong', note: 'BFS, Dijkstra — used in the metro planners' },
      { name: 'Operating Systems', level: 'working', note: 'Process scheduling simulator in C++' },
      { name: 'Probability & Statistics', level: 'working' },
      { name: 'Linear Algebra', level: 'working' },
      { name: 'System Design', level: 'learning' },
    ],
  },
  {
    id: 'tooling',
    title: 'Frontend, Tooling & AI Evaluation',
    icon: 'Wrench',
    description: 'How I build, test and measure things.',
    skills: [
      { name: 'Playwright', level: 'strong', note: 'Headless rendering harnesses for evaluation pipelines' },
      { name: 'LLM/VLM evaluation & rubric design', level: 'strong', note: 'Salesforce Design Intelligence' },
      { name: 'React', level: 'working' },
      { name: 'Next.js', level: 'working' },
      { name: 'Tailwind CSS', level: 'working' },
      { name: 'Git & GitHub', level: 'working' },
      { name: 'MCP and agent skills', level: 'working' },
    ],
  },
] satisfies SkillCategory[]
