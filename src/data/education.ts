/**
 * EDUCATION. Newest first.
 *
 * `score` is free text so any grading system fits.
 */

import type { Education } from '@/types/portfolio'

export const education = [
  {
    id: 'iit-kharagpur',
    institution: 'Indian Institute of Technology Kharagpur',
    degree: 'B.Tech. (Hons.)',
    field: 'Electrical Engineering, Minor in Computer Science & Engineering',
    startDate: '2023-07',
    endDate: '2027-05',
    location: 'Kharagpur, West Bengal',
    score: 'CGPA 8.42 / 10',
    highlights: [
      'Minor in Computer Science & Engineering alongside the core Electrical Engineering degree.',
      'Associate Member of Grimoire of Code, the institute’s competitive programming society — organised contests for 2,000+ students and ran DSA learning sessions and a mentor–mentee programme.',
    ],
    coursework: [
      'Data Structures & Algorithms',
      'Object-Oriented Programming',
      'Introduction to AI/ML',
      'Probability & Statistics',
      'Linear Algebra',
    ],
  },
] satisfies Education[]
