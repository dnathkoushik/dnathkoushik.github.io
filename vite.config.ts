import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
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
 * link such as `/projects` would 404. Copying `index.html` to `404.html` makes
 * Pages serve the SPA shell for any unknown path while keeping the URL intact,
 * which is the least intrusive way to support client-side routing.
 */
function spaFallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      if (existsSync(distFile('index.html'))) {
        copyFileSync(distFile('index.html'), distFile('404.html'))
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
