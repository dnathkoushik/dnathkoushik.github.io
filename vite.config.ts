import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { PUBLIC_ROUTES, NOINDEX_PREFIX } from './src/config/routes.ts'

/**
 * Base path for GitHub Pages.
 *
 *  - User/organisation site (`<user>.github.io`)         -> "/"
 *  - Project site           (`<user>.github.io/<repo>/`) -> "/<repo>/"
 *
 * The GitHub Actions workflow derives this automatically and passes it in as
 * the BASE_PATH environment variable, so you normally never have to touch it.
 * For a manual build:  BASE_PATH=/my-repo/ npm run build
 */
const basePath = process.env.BASE_PATH ?? '/'

/** Canonical origin, used for the sitemap and robots.txt. */
const siteUrl = (process.env.VITE_SITE_URL ?? 'https://your-username.github.io').replace(/\/$/, '')

const distFile = (name: string) => fileURLToPath(new URL(`./dist/${name}`, import.meta.url))

/**
 * GitHub Pages has no server-side rewrite rules, so a hard refresh on a deep
 * link such as `/projects` would 404. Two things fix that:
 *
 *  1. Every PUBLIC route gets its own `<route>/index.html`. Pages then serves a
 *     real 200 for `/projects`, React Router reads the path and renders the
 *     right page, and the URL never changes. This matters beyond aesthetics —
 *     a 404 status keeps a page out of the search index no matter what the
 *     sitemap says, so without it only the home page would ever be indexed.
 *
 *  2. `404.html` catches everything else — mistyped URLs and the dashboard,
 *     which is deliberately left on the fallback because it must NOT be
 *     indexable. The app still renders; the status is just 404.
 *
 * No redirect hack, no query-string round trip, no flash of the wrong page.
 */
function spaFallback() {
  return {
    name: 'spa-github-pages-routes',
    closeBundle() {
      const index = distFile('index.html')
      if (!existsSync(index)) return

      copyFileSync(index, distFile('404.html'))

      for (const route of Object.values(PUBLIC_ROUTES)) {
        if (route === '/') continue
        const dir = fileURLToPath(new URL(`./dist${route}`, import.meta.url))
        mkdirSync(dir, { recursive: true })
        copyFileSync(index, `${dir}/index.html`)
      }
    },
  }
}

/**
 * Emits sitemap.xml and robots.txt from the route table, so adding a page never
 * means remembering to update three files. The private dashboard is excluded
 * from the sitemap and explicitly disallowed in robots.txt — it holds nothing
 * the owner wants indexed, and the data is local to the browser anyway.
 */
function seoFiles() {
  return {
    name: 'seo-files',
    closeBundle() {
      const prefix = basePath.replace(/\/$/, '')
      const today = new Date().toISOString().slice(0, 10)

      const urls = Object.values(PUBLIC_ROUTES).map((route) => {
        // The home entry keeps its trailing slash — `https://host/repo/` is the
        // canonical form of a directory URL, and `https://host/repo` is a
        // redirect to it.
        const path = route === '/' ? '/' : route
        return { loc: `${siteUrl}${prefix}${path}`, priority: route === '/' ? '1.0' : '0.7' }
      })

      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map(
          ({ loc, priority }) =>
            `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
        ),
        '</urlset>',
        '',
      ].join('\n')

      const robots = [
        'User-agent: *',
        'Allow: /',
        '',
        '# The personal dashboard is private working space, not portfolio content.',
        `Disallow: ${prefix}${NOINDEX_PREFIX}`,
        '',
        `Sitemap: ${siteUrl}${prefix}/sitemap.xml`,
        '',
      ].join('\n')

      writeFileSync(distFile('sitemap.xml'), sitemap, 'utf8')
      writeFileSync(distFile('robots.txt'), robots, 'utf8')
    },
  }
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), spaFallback(), seoFiles()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    // Pure logic tests run in node; UI smoke tests opt into jsdom with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
