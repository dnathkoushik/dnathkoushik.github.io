/**
 * ===========================================================================
 *  THE CONTENT OF THIS WEBSITE LIVES IN THIS FOLDER. NOTHING ELSE.
 *
 *  Every word on the public site comes from one of the files below. You never
 *  need to open a component to change what the site says — edit the data,
 *  commit, and the deploy picks it up.
 *
 *  WHICH FILE DO I OPEN?
 *
 *    Your name, headline, bio, avatar, resume, social links,
 *    the email on the contact page ........................ profile.ts
 *
 *    The "currently working on" strip on the home page,
 *    and the three philosophy notes on /about ............. focus.ts
 *
 *    Everything on /skills, and the skill summary
 *    on the home page .................................... skills.ts
 *
 *    Everything on /projects, the featured projects on
 *    the home page, and the technology filter ............ projects.ts
 *
 *    The role timeline on /experience .................... experience.ts
 *
 *    Degrees and schools on /about and /experience ....... education.ts
 *
 *    Contests, certifications and milestones
 *    on /achievements .................................... achievements.ts
 *
 *    Your GitHub handle, pinned repositories, and whether
 *    the page is allowed to call the GitHub API .......... github.ts
 *
 *    Page title, meta description, canonical site URL,
 *    Open Graph image, sitemap origin .................... seo.ts
 *
 *  BEFORE YOUR FIRST DEPLOY, replace every placeholder. They are easy to find:
 *
 *      grep -rn "your-username\|you@example.com\|replace me\|EXAMPLE ENTRY" src/data
 *
 *  experience.ts, education.ts and achievements.ts ship as clearly-labelled
 *  templates on purpose — they exist so the layouts have something to render,
 *  not as claims about anyone. Replace them with real entries, or set the
 *  arrays to `[]`; every page has a proper empty state.
 *
 *  Nothing in this folder is private. It is compiled into the public bundle
 *  and served to the world. The private dashboard's data never comes from
 *  here — it lives only in the visitor's own browser.
 * ===========================================================================
 */

export { profile } from '@/data/profile'
export { currentFocus, philosophy } from '@/data/focus'
export { skillCategories } from '@/data/skills'
export { projects } from '@/data/projects'
export { experience } from '@/data/experience'
export { education } from '@/data/education'
export { achievements } from '@/data/achievements'
export { githubConfig } from '@/data/github'
export { seo } from '@/data/seo'
export { photos, photosFor } from './photos'
