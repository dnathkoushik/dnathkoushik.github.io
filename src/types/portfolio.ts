/**
 * Types for the PUBLIC portfolio.
 *
 * Everything described here is compiled into the deployed bundle and is
 * therefore world-readable. Never put anything you would not publish on a
 * billboard into a value typed by this file.
 */

/** A month-precision date, e.g. "2024-07". Used for timeline entries. */
export type YearMonth = string

export interface SocialLink {
  /** Stable key used to pick the icon, e.g. "github" | "linkedin" | "email". */
  id: string
  label: string
  /** Text shown next to the icon, e.g. the handle or address. */
  handle: string
  href: string
}

export interface Profile {
  name: string
  /** Short professional headline shown under the name in the hero. */
  headline: string
  /** One or two sentences. Rendered in the hero. */
  intro: string
  /** Longer biography, one paragraph per array entry. Rendered on /about. */
  bio: string[]
  location: string
  /** Public email address. Rendered obfuscated to slow down naive scrapers. */
  email: string
  /** Path (relative to the site base) or absolute URL of the avatar image. */
  avatar?: string
  /** Initials fallback when no avatar is set. */
  initials: string
  /** Path or URL of the resume PDF. */
  resumeUrl?: string
  /** Availability banner, e.g. "Open to SDE internships". Hidden when absent. */
  availability?: string
  socials: SocialLink[]
}

export interface FocusItem {
  label: string
  /** Optional one-line elaboration shown on hover / below the label. */
  detail?: string
}

export interface Philosophy {
  title: string
  body: string
}

export interface Project {
  id: string
  name: string
  /** One-line summary used in cards and search results. */
  summary: string
  /** Longer description, shown in the expanded project view. */
  description: string
  /** Technology names. Also drives the technology filter on /projects. */
  technologies: string[]
  githubUrl?: string
  liveUrl?: string
  /** Path or URL of a cover image. A generated gradient is used when absent. */
  image?: string
  featured: boolean
  /** ISO date the project started or shipped, e.g. "2025-03-14". */
  date: string
  status: 'shipped' | 'in-progress' | 'archived'
  keyFeatures: string[]
}

export interface Experience {
  id: string
  company: string
  position: string
  /** "2025-06" — month precision is enough for a CV timeline. */
  startDate: YearMonth
  /** Omit for a role you currently hold; the UI renders "Present". */
  endDate?: YearMonth
  location?: string
  type: 'internship' | 'full-time' | 'part-time' | 'freelance' | 'open-source'
  description: string
  achievements: string[]
  technologies: string[]
  url?: string
}

export interface Education {
  id: string
  institution: string
  degree: string
  field?: string
  startDate: YearMonth
  endDate?: YearMonth
  location?: string
  /** e.g. "CGPA 8.7 / 10" — free text so any grading system fits. */
  score?: string
  highlights: string[]
  coursework?: string[]
}

export type SkillLevel = 'learning' | 'working' | 'strong'

export interface Skill {
  name: string
  level: SkillLevel
  /** Optional note, e.g. "primary language for DSA". */
  note?: string
}

export interface SkillCategory {
  id: string
  title: string
  /** Lucide icon name, resolved by `resolveIcon` in components/ui/Icon.tsx. */
  icon: string
  description?: string
  skills: Skill[]
}

export type AchievementKind =
  | 'competitive-programming'
  | 'certification'
  | 'hackathon'
  | 'award'
  | 'academic'
  | 'milestone'
  | 'open-source'

export interface Achievement {
  id: string
  title: string
  kind: AchievementKind
  /** Issuing body, contest name, or institution. */
  issuer?: string
  /** ISO date, e.g. "2025-11-02". */
  date: string
  description?: string
  /** Headline figure, e.g. "Rank 412 / 18,000". */
  metric?: string
  url?: string
  featured: boolean
}

/**
 * Static description of the GitHub profile. Live stats are fetched at runtime by
 * `services/github.ts`; this is what renders when the API is unavailable, rate
 * limited, or deliberately disabled.
 */
export interface GithubConfig {
  username: string
  profileUrl: string
  /** Repositories to spotlight, by "owner/name". Order is preserved. */
  pinnedRepos: string[]
  /** Set false to skip all network calls and render the static fallback only. */
  liveStatsEnabled: boolean
}

export interface SeoConfig {
  /** Canonical origin of the deployed site, e.g. "https://user.github.io". */
  siteUrl: string
  title: string
  description: string
  /** Path to the Open Graph image, relative to the site base. */
  ogImage: string
  twitterHandle?: string
  keywords: string[]
}

/**
 * A real photograph of the owner. These are what stop the site reading as a
 * template: keep captions factual (where, roughly when) and alt text literal —
 * a screen reader user should get the same picture a sighted one does.
 */
export interface Photo {
  id: string
  /** Path under `public/photos/`, e.g. "skywalk.webp". A "-480" variant must exist too. */
  src: string
  /** Intrinsic pixel size of the main file, so layout never shifts. */
  width: number
  height: number
  /** Literal description of what is in the frame. */
  alt: string
  /** Short editorial caption shown under the frame. */
  caption: string
  /** Place, in mono, e.g. "Hyderabad". */
  place: string
  /** "2026-06" style; rendered as "Jun 2026". Optional when you genuinely do not know. */
  date?: YearMonth
  /** Which experience entry this belongs to, if any — used by the experience page. */
  experienceId?: string
}
