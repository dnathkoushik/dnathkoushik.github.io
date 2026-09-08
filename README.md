# Portfolio OS

A personal website that is two products in one:

1. **A public developer portfolio** — about, skills, projects, experience, achievements, GitHub and contact. Static, fast, SEO-friendly, deployed to GitHub Pages.
2. **A private productivity dashboard** — daily targets, work logs, weekly and monthly goals, habits, analytics, journal, weekly reviews and a calendar. It is local-first: the data lives in your own browser, and never in this repository.

Optionally, the dashboard **commits itself to a private GitHub repository** on every change — durable backup and multi-device sync with no backend at all. See [GitHub sync](#github-sync--the-dashboard-commits-itself).

The two halves share a design system and a search bar, but nothing else. The public site cannot read your private data.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Updating your portfolio content](#updating-your-portfolio-content)
- [How the personal dashboard works](#how-the-personal-dashboard-works)
- [Privacy: what is and is not private](#privacy-what-is-and-is-not-private)
- [Outreach — a personal GTM for internships and full-time roles](#outreach--a-personal-gtm-for-internships-and-full-time-roles)
- [The motion layer (public site only)](#the-motion-layer-public-site-only)
- [GitHub sync — the dashboard commits itself](#github-sync--the-dashboard-commits-itself)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [Environment variables](#environment-variables)
- [Connecting a real backend later](#connecting-a-real-backend-later)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Scripts](#scripts)
- [Extending it](#extending-it)

---

## Features

### Public portfolio

| Page | What it does |
| --- | --- |
| `/` | Hero, current focus, featured projects, highlights |
| `/about` | Biography, education timeline, technical interests, philosophy |
| `/skills` | Skills grouped by category with honest proficiency levels and a filter |
| `/projects` | Project showcase with a multi-select technology filter that is stored in the URL |
| `/experience` | Timeline of roles, achievements and technologies |
| `/achievements` | Contests, certifications, hackathons, awards and milestones, grouped by kind |
| `/github` | Live GitHub profile and repository stats, with a designed fallback when the API is unavailable |
| `/contact` | Email with copy-to-clipboard, social profiles, `mailto:` composer |

### Personal dashboard (`/dashboard`)

| Page | What it does |
| --- | --- |
| Overview | What to do today, whether you are on track this week, streaks, recent activity |
| Today | Day workspace — objective, daily targets, work log. Works for **any** date via `?date=YYYY-MM-DD` |
| Calendar | Month grid with productivity intensity per day; click a day for its full summary |
| Goals | Weekly and monthly goals with progress steppers and carry-over |
| Habits | Habit tracking plus a GitHub-style consistency heatmap; click any day to see what you did |
| Analytics | Trends, completion rates, hours logged and category breakdowns — all computed from your real data |
| Journal | Work-log history and freeform notes, searchable and filterable |
| Weekly review | A retrospective, prefaced by what the data says actually happened that week |
| Timeline | Everything you have done, newest first, grouped by day |
| Outreach | A personal GTM for the job hunt: target companies with fit scores, contacts, a stage pipeline, every touch logged, templates that open Gmail pre-filled, follow-ups that become tasks |
| Settings | Categories, preferences, backup/restore, GitHub sync, and the optional privacy lock |

### Throughout

- Light / dark / system themes, with dark mode designed rather than inverted
- `⌘K` / `Ctrl+K` command palette that searches portfolio **and** private data
- Fully keyboard navigable, semantic HTML, ARIA where it earns its place
- **Zero axe-core violations** (WCAG 2.1 A + AA) across all 18 routes in both themes
- Mobile-first: the dashboard has its own bottom tab bar and bottom sheets, not a shrunken desktop layout
- Toasts, empty states, loading states and error boundaries everywhere something can fail
- Optional GitHub-backed sync: every change becomes a commit, with conflict merging across devices

---

## Tech stack

| Concern | Choice | Why |
| --- | --- | --- |
| UI | React 19 + TypeScript (strict) | Types are the contract between the twelve or so feature areas |
| Build | Vite 8 | Fast dev server, tiny production output, first-class GitHub Pages support |
| Styling | Tailwind CSS v4 | CSS-first `@theme` tokens — no `tailwind.config.js` to keep in sync |
| Routing | React Router 7 | Nested layouts map exactly onto public vs private |
| Motion | GSAP 3 (ScrollTrigger, SplitText, ScrambleText) + Lenis | Scroll-driven choreography and smooth scroll on the public site only; the dashboard does not load either |
| Hero | hand-written WebGL2 shader | Domain-warped noise in the accent colours, mouse-reactive, no library, CSS fallback |
| Icons | lucide-react | Consistent stroke weight; brand marks are hand-inlined SVG |
| Charts | Recharts | Only loaded inside the lazily-imported dashboard |
| Dates | date-fns | Local-date correctness, tree-shakeable |
| Storage | IndexedDB → localStorage → memory | Progressive fallback so the app always works |
| Sync | GitHub Contents API | Commits are durable, diffable and revertible; no backend to run |
| Tests | Vitest | Covers date maths and analytics, where a bug would silently lie to you |

No UI component library is used. Every primitive in `src/components/ui/` is written here, which is why the whole thing stays small and behaves consistently.

### A note on the colour tokens

Several colours in `src/styles/index.css` are darker (light theme) or lighter (dark theme) than they intuitively "should" be. That is deliberate and measured, not taste: each one is used as **text on its own soft tint** — badges, chips, category labels — and that pairing sets the ceiling. The categorical palette is held at a near-uniform ~50% lightness for the same reason, which has the side benefit that no single category shouts louder than the others in a chart. If you retune a colour, check it against every `--color-*-soft` background before shipping it.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm run build        # type-check, then production build into dist/
npm run preview      # serve the production build locally
npm run lint         # ESLint
npm test             # Vitest
npm run typecheck    # tsc --noEmit
```

The first time you open `/dashboard` you will be offered a **sample dataset** so the app is not an empty shell. It is clearly labelled placeholder activity. Clear it from **Settings → Data** whenever you want to start for real.

---

## Project structure

```
.
├── .github/workflows/deploy.yml   Build + deploy to GitHub Pages on push to main
├── public/                        Static assets copied verbatim (favicon, OG image, manifest)
├── src/
│   ├── components/
│   │   ├── ui/                    Design-system primitives (Button, Card, Dialog, Toast, …)
│   │   ├── common/                App shell pieces (ErrorBoundary, ThemeToggle, brand icons)
│   │   ├── nav/                   Header, footer, sidebar, mobile tab bar, command palette
│   │   ├── portfolio/ projects/ achievements/ github/ contact/    Public feature components
│   │   └── tasks/ worklog/ goals/ habits/ calendar/ analytics/
│   │       journal/ timeline/ review/ settings/ personal/         Dashboard feature components
│   ├── config/
│   │   ├── app.ts                 Storage keys, base URL, schema version
│   │   └── routes.ts              Every route path + both navigation menus
│   ├── data/                      ← YOUR PUBLIC PORTFOLIO CONTENT LIVES HERE
│   ├── hooks/                     Reusable hooks + private-data selectors
│   ├── layouts/                   PublicLayout and PersonalLayout
│   ├── lib/cn.ts                  Class-name merge helper
│   ├── motion/                    Public-site motion layer (GSAP setup, smooth scroll, cursor,
│   │                              preloader, page transitions, WebGL hero, reveal primitives)
│   ├── pages/
│   │   ├── public/                One file per public page
│   │   └── personal/              One file per dashboard page
│   ├── providers/                 ThemeProvider, PersonalDataProvider
│   ├── services/                  Storage adapters, crypto, migrations, data service, GitHub API
│   ├── styles/index.css           All design tokens, in one place
│   ├── types/                     Domain types — the shared contract
│   ├── utils/                     Dates, formatting, analytics, search (pure functions)
│   ├── App.tsx                    Routes
│   └── main.tsx                   Entry point
├── index.html                     Document head, SEO tags, no-flash theme script
└── vite.config.ts                 Base path, SPA fallback, sitemap/robots generation
```

Two rules keep this from turning into a mess as it grows:

1. **Public and private never mix.** Public content is compiled into the bundle from `src/data/`. Private data is only ever reached through `usePersonalData()`. There is no code path from one to the other.
2. **Data does not live in components.** Portfolio content lives in `src/data/`, private data lives in the storage service, and derived numbers live in `src/utils/analytics.ts` as pure functions. Components render; they do not compute or store.

---

## Updating your portfolio content

Everything public is a plain TypeScript file in `src/data/`. Edit, commit, push — the site rebuilds and redeploys itself.

| File | Holds |
| --- | --- |
| `src/data/profile.ts` | Your name, headline, intro, bio, location, email, avatar, resume link, social links |
| `src/data/focus.ts` | The "currently focused on" strip, and your philosophy entries |
| `src/data/skills.ts` | Skill categories and levels |
| `src/data/projects.ts` | Projects, with tech, links, key features and the featured flag |
| `src/data/experience.ts` | Roles, dates, achievements, technologies |
| `src/data/education.ts` | Institutions, degrees, coursework, highlights |
| `src/data/achievements.ts` | Contests, certifications, hackathons, awards, milestones |
| `src/data/github.ts` | Your GitHub username and pinned repositories |
| `src/data/seo.ts` | Site URL, title, description, OG image, keywords |
| `src/data/photos.ts` | Your photographs — captions, places, dates, and which role each belongs to |

Each array is typed with `satisfies`, so a missing or misspelled field is a build error rather than a broken page.

### Placeholders you must replace before publishing

The repository ships with obvious placeholders so the layout is exercised on first run. Search for `your-username` and `example.com`, and specifically update:

- `src/data/profile.ts` — email, GitHub and LinkedIn URLs, avatar, resume
- `src/data/github.ts` — `username`, and set `liveStatsEnabled: true`
- `src/data/seo.ts` — `siteUrl` (must match your real Pages URL)
- `index.html` — `<title>`, description, `og:url`, `canonical`, and the JSON-LD `sameAs` links
- `src/data/experience.ts`, `education.ts`, `achievements.ts` — these ship as clearly-marked **example templates**, not as claims about you. Replace them with real entries or delete them; the pages render an honest empty state if you do.

Add your avatar and resume to `public/` (e.g. `public/avatar.jpg`, `public/resume.pdf`) and reference them as `/avatar.jpg`. Use the `asset()` helper from `src/config/app.ts` if you need to build such a path in code, so it stays correct under a project sub-path.

### Adding a photo

Photos are what stop the site reading as a template, so they get their own data file. To add one:

1. Export it as WebP twice — full size (≤ 1280 px on the long edge is plenty) and a 480 px-wide version — named `something.webp` and `something-480.webp`, and drop both in `public/photos/`.
2. Add an entry to `src/data/photos.ts` with the intrinsic `width`/`height` of the full file, a literal `alt` description, a short `caption`, the `place`, and optionally a `date` and the `experienceId` of the role it belongs to.

The first entry is the About-page portrait; the home-page strip shows them all in order; a role's photos appear as a small stack on its experience card. Keep captions to things that are true — a wrong place on a photo is the fastest way to make a real site feel fake again.

### Replacing the social preview image

`public/og-image.svg` is the source for the link preview. Most social platforms **do not render SVG** — export it to a 1200×630 PNG, save it as `public/og-image.png`, and point `og:image` / `twitter:image` in `index.html` at it.

---

## How the personal dashboard works

### Adding to it day to day

You never edit code to record a day. Everything is entered in the UI:

- **A task**: `/dashboard/today`, type in the always-focused quick-add box, press Enter. Inline shorthand is parsed out of the title — `!high`, `#dsa`, `~45m`.
- **Mark complete**: click the checkbox, or use the row menu for Start / Skip / Duplicate / Delete.
- **A work log entry**: the log section on the same page — time is prefilled with the current time.
- **Any other day**: `/dashboard/today?date=2026-09-01`, or click a day in the calendar or the habit heatmap.
- **Goals**: `/dashboard/goals` — the `−` / `+` steppers are the fast path; a goal auto-completes when it reaches its target.
- **Habits**: `/dashboard/habits` — tap a day in the 7-day strip.
- **A note**: `/dashboard/journal`.
- **A weekly review**: `/dashboard/review` — it autosaves as you type.

### Where the data actually goes

```
Component  →  usePersonalData().actions  →  PersonalDataService  →  StorageAdapter  →  IndexedDB
```

- One JSON document holds the whole database, so writes are atomic and a backup is a single file.
- Mutations apply to memory instantly and are flushed to storage on a short debounce, plus on tab hide and page unload.
- Adapters are tried in order: **IndexedDB** → **localStorage** → **in-memory**. The active one is shown in Settings, and the in-memory fallback says out loud that nothing is being saved.
- `src/services/migrations.ts` repairs and upgrades anything it loads, so an old export still imports cleanly.

### Backing it up

**Settings → Data → Export JSON.** This is your only backup. Clearing your browser's site data, using a different browser, or switching devices means the data is gone — there is no server holding a copy.

`.gitignore` already excludes `*backup*.json` so an export dropped in the project folder cannot be committed by accident.

---

## Privacy: what is and is not private

This deserves to be read carefully, because GitHub Pages is **static hosting** and it is easy to be misled about what that can guarantee.

### What is genuinely private

- Your tasks, work logs, goals, habits, notes and weekly reviews are stored in **your browser's IndexedDB**. With sync switched off they never leave the device at all.
- They are not in the deployed bundle, and not in *this* repository. Anyone who downloads the site's JavaScript gets the app, not your data.
- With **GitHub sync** on (see below) they are additionally committed to a repository **you choose**. Point it at a *private* repo and it stays private; point it at a public one and you have published your journal. The Settings panel checks which it is and warns you.
- Optionally, **Settings → Privacy lock** encrypts the stored database at rest with AES-GCM using a key derived from your passphrase (PBKDF2-SHA256, 310,000 iterations). This protects the data sitting in your browser's storage from someone poking around your device or your browser's developer tools.

### What is **not** private, and cannot be made private by this app

- **Everything in this repository and in `dist/` is public.** All of `src/data/`, all component code, all copy. If you type something into a data file, you have published it.
- **The privacy lock is not authentication.** There is no server, so there is nothing to authenticate against. Any client-side gate on a static site can be bypassed by reading the JavaScript. The lock protects *data at rest in your browser*; it does not protect *anything that has been deployed*.
- **The `/dashboard` URL itself is public.** Anyone can open it; on static hosting that is unavoidable. What they get is a locked door (see below), not your week — but the page code is part of the public bundle and always will be.
- **A forgotten passphrase is unrecoverable.** There is no reset. Export a backup before enabling the lock.

### The gate on `/dashboard`

A browser that has never used this dashboard sees a **"A private dashboard"** screen, not a dashboard. It offers two ways in:

- **Sign in with GitHub** — paste the token for your private data repo. Your data is loaded from there.
- **Take a look with sample data** — an explicitly-labelled demo, under a permanent banner saying the content is invented. Nothing is personalised to you.

A browser is let straight through when it already holds dashboard data, or has a sync token configured — so you are never locked out of your own device.

Be clear about what this is: it is **not** authentication, and it is not what keeps your data safe. Your data is safe because it is in a *private GitHub repository*, which needs a real GitHub credential to read. The gate exists so a stranger is never shown something that looks like your private week.

> An earlier version seeded demo data on first load. Nothing leaked — but an incognito window landed in a full dashboard greeting the owner by name, which is indistinguishable from a leak. Demo data is opt-in now.

### The honest summary

> Privacy here comes from where the data is kept, not from a login screen. Locally that means your browser profile; with sync on it means a private GitHub repository whose access control is GitHub's, not ours. There is no point at which this site's own JavaScript is what keeps someone out.

To keep search engines out of the dashboard, `robots.txt` disallows `/dashboard` and every dashboard page sets `<meta name="robots" content="noindex, nofollow">`. That stops indexing; it is not a security boundary.

**Never commit** API keys, tokens, passwords or personal notes. Anything prefixed `VITE_` is inlined into the public bundle by design.

---

## The motion layer (public site only)

The portfolio is built as a scroll-driven, cinematic site: a WebGL hero, a custom cursor, Lenis smooth scrolling, SplitText line-mask reveals, pinned horizontal and sticky-stack sections, a preloader and curtain page transitions. All of it lives in `src/motion/` and is only ever imported by `PublicLayout` and the public pages — **the dashboard bundle contains none of it**.

Two rules keep it from becoming a mess:

1. **Everything imports GSAP from `src/motion/gsap.ts`**, never from `gsap` directly. That file registers the plugins once, sets the house easing (`'house'`), and exposes `motionOK()`, `finePointer()` and `isDesktop()` — the three questions every component asks before it moves anything.
2. **Motion is a layer, not the content.** Every headline, paragraph and card is real, styled markup that is fully present without JavaScript; animations reveal it. So the site is complete with motion off, in a text browser, and in the jsdom smoke test.

### Reduced motion, touch and mobile

- `prefers-reduced-motion: reduce` → no smooth scroll, no cursor, no preloader, no scramble, no pinned sections; every reveal renders its final state immediately. The site is calm and fully usable.
- Touch / coarse pointer → no custom cursor, no magnetic buttons, no 3-D tilt (there is no hover to follow).
- Below `lg` → no pinned sections; the horizontal project rail becomes a native scroll-snap row and the sticky stack becomes a plain stack.

### The primitives

| Component | Use |
| --- | --- |
| `TextReveal` | SplitText masked reveal by lines / words / chars |
| `Reveal`, `Stagger` | Fade-up or clip-path wipe on enter; sequenced children |
| `Counter` | Counts a number up on enter (final value is always in the markup) |
| `Magnetic`, `TiltCard` | Pointer-following hover for buttons and cards |
| `Marquee` | Seamless loop; static wrapped row under reduced motion |
| `Parallax`, `SectionNumber` | Scrubbed drift; outlined section numerals |
| `StickyStack`, `HorizontalScroll` | Pinned scroll sections, desktop + motion only |
| `HeroCanvas` | The WebGL shader; falls back to CSS gradients |
| `SmoothScrollProvider`, `Cursor`, `Preloader`, `PageTransition`, `Grain`, `ScrollProgress` | Site-wide chrome, composed in `PublicLayout` |

Adding a new animated section is: write the plain markup, then wrap headings in `TextReveal` and groups in `Stagger`. If it looks right with motion off, it is done.

### Performance

GSAP core + ScrollTrigger + SplitText + ScrambleText adds roughly 75 kB gzipped to the public bundle; Lenis ~4 kB; the shader is hand-written and dependency-free. Everything animates transform, opacity or clip-path only. The canvas caps device-pixel-ratio at 1.5, pauses when off-screen or in a hidden tab, and drops to DPR 1 on phones.

### Two WebGL gotchas the hero is built around

- **A canvas hands back the same context object to every `getContext()` call.** If an effect calls `WEBGL_lose_context.loseContext()` in its cleanup and then re-runs on the same element — React StrictMode in dev, hot reload — the next mount inherits a dead context. Chrome composites a lost-context canvas as *opaque white*, straight over the hero text. So the cleanup releases the program and VAO but never loses the context.
- **A genuinely lost context (GPU reset, mobile Safari backgrounding) is hidden immediately**, giving the browser three seconds to restore it before the hero switches permanently to its CSS-gradient fallback. It never shows white.

---

## Outreach — a personal GTM for internships and full-time roles

`/dashboard/outreach`. The same shape as a sales CRM, pointed at you as the customer. It is private data like everything else in the dashboard: it lives in your browser and, with sync on, in your private repo.

| Record | What it is |
| --- | --- |
| **Company** | A target account. Facts with source URLs (so you know *why* you believe something), and a **fit score** — deterministic, 0–100, from criteria *you* weight in Settings → Outreach (hiring now, backend work, stack overlap, remote/India, a warm path in, …). Change a weight and every company re-scores instantly. |
| **Contact** | A person, with warmth: cold, warm, referral or alumni. |
| **Opportunity** | A role at a company, moving through stages: researching → contacted → replied → applied → screening → interviewing → offer → accepted / rejected / ghosted / withdrawn. |
| **Touch** | Every interaction — email, LinkedIn, call, referral, portal, event — outbound or inbound. The unit that reply rates and weekly velocity are computed from. |
| **Template** | A reusable message with `{{name}}`, `{{company}}`, `{{role}}`, `{{hook}}`, `{{me}}`. Four good defaults ship (cold email, follow-up, alumni referral ask, LinkedIn note). |

### How a week of it goes

1. **Companies** — add a target (or import a CSV of them), score its fit, add a fact or two with the URL you got it from, hit the research links (LinkedIn people search, careers page, news).
2. **Contacts** — add the person you'll write to. **Compose** picks a template, fills the variables from the records, shows a live preview, and opens **Gmail or your mail app pre-filled** — nothing is sent from this site; there is no server. Ticking "log this touch" records it.
3. **Pipeline** — the opportunity appears as *contacted* automatically (an outbound touch moves *researching* → *contacted*; an inbound reply moves it to *replied*). Move stages from the card menu or with ←/→; keyboard works; no drag-and-drop to fight with on a phone.
4. **Follow-ups** — "Schedule follow-up" suggests a date from your cadence (default 4 then 10 days after the last outbound touch) and creates a **real task on your Today page**, linked back to the opportunity.
5. **Overview** — what's due today and overdue, this week's outbound vs your weekly target, what's going stale, reply rate by channel and by template, and an 8-week velocity chart. The main dashboard Overview shows a compact version of the same.

Tune the weekly target, follow-up cadence, staleness threshold and fit criteria in **Settings → Outreach**. Import/export companies and contacts as CSV from their pages; the expected columns are shown in the import dialog.

Data note: this bumped the private database schema to **v2**. Existing databases and old exports migrate automatically (the new collections start empty, with the default templates and criteria).

---

## GitHub sync — the dashboard commits itself

The dashboard can commit its database to a GitHub repository on every change. That gives you durable backup and multi-device sync without a backend of any kind: every save is an ordinary commit you can read, diff, or roll back.

**Set it up in Settings → GitHub sync.**

### One-time setup

1. **Create a private repository** for the data — separate from this website repo. `dashboard-data` is a good name. It must be **private**: everything you write in the dashboard goes into it.
2. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new):
   - **Repository access** → *Only select repositories* → pick just that one repo
   - **Permissions → Repository permissions → Contents** → *Read and write*
   - Nothing else. Do not use a classic token with `repo` scope; it can reach everything you own.
3. Paste owner, repo and token into **Settings → GitHub sync**, choose *Use what is on this device* for the very first connection, and press **Connect and sync**.

On a second device, use the same repo and token but choose **Use what is on GitHub**.

### How it behaves

| When | What happens |
| --- | --- |
| You change something | A commit is queued and pushed after ~8 seconds of quiet, so a burst of typing is one commit, not thirty |
| You switch tabs or close the page | A pending change is flushed immediately, best effort |
| The tab is open and idle | It checks GitHub every 5 minutes for commits from your other devices |
| **Sync now** in Settings | Pulls, merges, pushes immediately |
| You are offline | Nothing breaks. The dashboard is local-first; it catches up when you are back |

The sidebar shows the current state, so you never have to open Settings to know whether today's work is saved.

### Conflicts

The database is one JSON document, and every write carries the blob `sha` it was based on:

- **Remote unchanged** → fast-forward. Your document is pushed wholesale, so deletions propagate correctly.
- **Remote changed** (another device committed) → the two are merged record by record, with the most recently edited version of each winning, and the result pushed.

The merge path cannot tell "deleted here" from "not seen here yet", so a record deleted on one device *while another was editing offline* can reappear. That is the one real trade of a single-document design, it only applies to genuinely concurrent edits, and the alternative — losing an edit — is worse.

### About the token

It is typed in by hand and kept in this browser's `localStorage`. It is **never** bundled, never committed, and deliberately excluded from the JSON export.

Be clear-eyed about what that means: a credential in a browser is readable by anyone with access to that browser profile, and by any script that runs on the page. This site has no third-party scripts and no user-generated content, which is why it is a reasonable trade here — but scope the token to the one repository, give it an expiry you are willing to renew, and revoke it on GitHub if you lose the device.

### If you would rather not use a token at all

Turn sync off and use **Settings → Data → Export JSON** as a manual backup. Everything else works identically.

---

## Deploying to GitHub Pages

### One-time setup

1. Push this project to a GitHub repository.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`.

`.github/workflows/deploy.yml` lints, type-checks, tests, builds and deploys on every push to `main`, and can be re-run by hand from the Actions tab.

### The base path — the one thing that usually breaks

GitHub Pages serves a repository named `<you>.github.io` from the domain root, and every other repository from `/<repo>/`. Vite must be told which, or you get a blank page and 404s on every asset.

The workflow derives it for you:

| Repository name | Site URL | `BASE_PATH` |
| --- | --- | --- |
| `your-username.github.io` | `https://your-username.github.io/` | `/` |
| `portfolio` | `https://your-username.github.io/portfolio/` | `/portfolio/` |

To reproduce a production build locally:

```bash
BASE_PATH=/portfolio/ npm run build && npm run preview
```

### Client-side routing

Pages cannot rewrite unknown paths to `index.html`, so a hard refresh on `/projects` would normally 404. The build copies `index.html` to `404.html`, which makes Pages serve the app shell for any unmatched path **with the URL intact** — React Router then renders the right page. No redirect hack, no flash, no hash URLs.

### Custom domain

Add a `CNAME` file containing your domain to `public/`, set the domain in **Settings → Pages**, and set the `SITE_URL` repository variable (**Settings → Secrets and variables → Actions → Variables**) so canonical URLs and the sitemap match.

### Generated at build time

`dist/sitemap.xml` and `dist/robots.txt` are generated from `src/config/routes.ts`, so adding a page updates both automatically. The dashboard is excluded from the sitemap and disallowed in robots.

---

## Environment variables

Copy `.env.example` to `.env`. **Anything starting with `VITE_` ends up in the public bundle — never put a secret there.**

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_SITE_URL` | app + sitemap | `https://your-username.github.io` | Canonical origin for SEO tags and the sitemap |
| `BASE_PATH` | build only | `/` | Sub-path the site is served from |

In CI, `BASE_PATH` is derived from the repository name and `VITE_SITE_URL` comes from the `SITE_URL` repository variable (falling back to `https://<owner>.github.io`).

There are **no API keys in this project.** The GitHub integration uses the unauthenticated public API and degrades gracefully when rate limited.

---

## Connecting a real backend later

The storage seam is deliberately tiny — one interface, in `src/types/personal.ts`:

```ts
export interface StorageAdapter {
  readonly name: string
  load(): Promise<PersonalDatabase | null>
  save(db: PersonalDatabase): Promise<void>
  clear(): Promise<void>
}
```

Every component already goes through `usePersonalData()`, so **no UI changes are needed** to move the data somewhere else.

### To add Supabase (or Firebase, or your own API)

1. Write `src/services/storage/supabase.ts` implementing `StorageAdapter` — one row per user holding the JSON document is enough to start.
2. Return it from `createStorageAdapter()` in `src/services/storage/index.ts` when a session exists, falling back to IndexedDB when signed out.
3. Add sign-in UI and gate `PersonalLayout` on the session instead of the local lock.
4. Move `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` into `.env` (the anon key is designed to be public — the security boundary is **Row Level Security**, which you must enable, not the key).

What that buys you and local storage cannot: real authentication, multi-device sync, and data that survives clearing your browser.

Once the document grows large, replace whole-document `save()` with per-collection writes. That is the one place the current design trades scale for simplicity, and it is contained entirely within the adapter.

---

## Keyboard shortcuts

| Shortcut | Does |
| --- | --- |
| `⌘K` / `Ctrl+K` | Open the command palette (searches portfolio and private data) |
| `↑` `↓` `Enter` | Move through and open search results |
| `Esc` | Close any dialog, sheet, menu or the palette |
| `←` `→` | Previous / next day on the Today page |
| Arrow keys | Move by day in the calendar grid; `PageUp` / `PageDown` change month |

Single-letter shortcuts never fire while you are typing in a field.

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then build to `dist/` (also emits `404.html`, `sitemap.xml`, `robots.txt`) |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | ESLint over the whole project |
| `npm run lint:fix` | ESLint with autofix |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

---

## Extending it

The architecture leaves room for these without a rewrite:

- **Cloud sync / auth** — new `StorageAdapter`, as above.
- **GitHub contribution graph** — `src/services/github.ts` is the single integration point. A scheduled Action could commit a stats JSON file to `public/` to avoid the anonymous rate limit entirely.
- **LeetCode / Codeforces stats** — same shape as `github.ts`; add a service, add a card.
- **A blog** — add a route in `src/config/routes.ts`, a page in `src/pages/public/`, and post data in `src/data/`. The nav and sitemap pick it up automatically.
- **A public progress page** — you already have the analytics functions; render a curated subset from data you explicitly opt into publishing.
- **Automatic weekly reports** — `buildActivityFeed()` and `rangeStats()` in `src/utils/analytics.ts` already produce everything a report needs.
- **Notifications / reminders** — the service worker slot is unused; a `Notification` permission prompt on the Today page is a small addition.
- **Resume generator** — `src/data/` is already structured CV data; a print stylesheet or a PDF route is mostly presentation work.

Deliberately **not** built: anything requiring a server, and anything that would make the privacy story less honest than it is above.

---

## Licence

Personal project. Reuse the code freely; replace the content with your own.
