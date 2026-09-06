/**
 * PHOTOS. Real ones, of you.
 *
 * Files live in `public/photos/` as WebP, each with a `-480` twin for small
 * screens (e.g. `skywalk.webp` + `skywalk-480.webp`). To add one: drop both
 * sizes in, add an entry here. Order matters — the home-page strip shows them
 * in this order, and the first one is the About page portrait.
 *
 * Keep captions to things that are true. A wrong place or date on a photo is
 * the fastest way to make a real site feel fake again.
 */

import type { Photo } from '@/types/portfolio'

export const photos = [
  {
    id: 'skywalk',
    src: 'skywalk.webp',
    width: 720,
    height: 1280,
    alt: 'Koushik leaning against a wooden handrail in a glass-walled skywalk, sunlight casting long diagonal shadows across a wood floor.',
    caption: 'Between buildings, between meetings.',
    place: 'Salesforce, Hyderabad',
    date: '2026-06',
    experienceId: 'salesforce',
  },
  {
    id: 'desk',
    src: 'desk.webp',
    width: 720,
    height: 1280,
    alt: 'Koushik standing at a height-adjustable desk, typing on a laptop next to an external monitor showing code.',
    caption: 'The standing desk phase. It lasted.',
    place: 'Salesforce, Hyderabad',
    date: '2026-06',
    experienceId: 'salesforce',
  },
  {
    id: 'salesforce-building',
    src: 'salesforce-building.webp',
    width: 960,
    height: 1280,
    alt: 'Koushik in a white shirt standing in the forecourt of the Salesforce Hyderabad office, the blue cloud logo on the building above him.',
    caption: 'Day one.',
    place: 'Salesforce, Hyderabad',
    date: '2026-05',
    experienceId: 'salesforce',
  },
  {
    id: 'innovation-centre',
    src: 'innovation-centre.webp',
    width: 1280,
    height: 960,
    alt: 'Koushik leaning against a wall lettered "Salesforce Innovation Centre", hands in pockets, looking off to the side.',
    caption: 'Where the evaluation pipeline was built.',
    place: 'Salesforce Innovation Centre',
    date: '2026-06',
    experienceId: 'salesforce',
  },
  {
    id: 'welcome-astro',
    src: 'welcome-astro.webp',
    width: 720,
    height: 1280,
    alt: 'Koushik beside a "Welcome to Salesforce Hyderabad" sign and a large statue of Astro, the Salesforce mascot.',
    caption: 'Obligatory.',
    place: 'Salesforce, Hyderabad',
    date: '2026-05',
    experienceId: 'salesforce',
  },
  {
    id: 'hyderabad-skyline',
    src: 'hyderabad-skyline.webp',
    width: 720,
    height: 1280,
    alt: 'Koushik standing on a wide road with glass office towers and trees rising behind him under a pale evening sky.',
    caption: 'Evening walks past the towers.',
    place: 'Hyderabad',
    date: '2026-06',
  },
] satisfies Photo[]

/** The photos attached to a role, in display order. */
export function photosFor(experienceId: string): Photo[] {
  return photos.filter((photo) => photo.experienceId === experienceId)
}
