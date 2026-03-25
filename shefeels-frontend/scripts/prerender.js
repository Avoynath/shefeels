/*
  scripts/prerender.js

  Playwright-based prerender script (runs after `vite build`).

  What it does:
  - Starts a temporary `vite preview` server on port 4173
  - Visits an allow-list of public routes with Chromium
  - Waits for `#root` to exist and `networkidle` to finish
  - Saves `document.documentElement.outerHTML` to `dist/<route>/index.html`

  Constraints satisfied:
  - Runs only at build time (this is a standalone Node script)
  - Does NOT modify app code or routes
  - Skips admin/auth routes (configure `routes` array)

  Edit the `routes` array below to add/remove routes you want snapshot.
*/

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'
import net from 'net'

const DIST_DIR = path.resolve(process.cwd(), 'dist')
const DEFAULT_PREVIEW_PORT = Number(process.env.PRERENDER_PORT || 4173)
let CURRENT_PREVIEW_URL = null

// ======= EDIT THIS ALLOW-LIST =======
// Statically include important public routes. Keep leading slash on routes.
// The script will also attempt to fetch and parse /sitemap.xml from the
// preview server to discover additional public pages automatically.
const manualRoutes = [
  '/',
  '/pricing',
  '/characters',
  '/orders',
  '/ai-girlfriend',
  '/ai-boyfriend',
  '/ai-transgender',
  '/help-center',
  // Legal hub + policy pages (use exact routes from src/App.tsx)
  '/legal',
  '/terms-of-service',
  '/refund-policy',
  '/privacy-policy',
  '/cookies-notice',
  '/dmca-policy',
  '/community-guidelines',
  '/blocked-content-policy',
  '/content-removal-policy',
  '/complaint-policy',
  '/affiliate-terms',
  '/underage-policy',
  '/2257-exemption',
  '/kyc-policy',
  // Contact / help
  '/contact-center',
]

// Exclude patterns: any route that contains one of these substrings will be
// skipped from prerendering. Add more patterns as needed for your app.
const excludeIfContains = ['/admin', '/user', '/profile', '/account', '/login', '/settings', '/checkout']
// ====================================

async function findFreePort(preferred) {
  function tryListen(port) {
    return new Promise((resolve) => {
      const server = net.createServer()
      server.unref()
      server.on('error', () => {
        try {
          server.close()
        } catch (e) {}
        resolve(false)
      })
      server.listen(port, '127.0.0.1', () => {
        const p = server.address().port
        server.close(() => resolve(p))
      })
    })
  }

  // Try preferred first
  const ok = await tryListen(preferred)
  if (ok && ok !== false) return ok
  // Ask OS for a free port
  const any = await tryListen(0)
  if (any && any !== false) return any
  throw new Error('Could not find a free port')
}

async function spawnPreview() {
  // Windows and some CI environments cannot spawn npm shims directly.
  // Use the system shell to run the preview command so this is robust on
  // Windows (PowerShell/CMD) and Unix CI images.
  // The command intentionally uses `npx` so we don't add a permanent server
  // dependency. `shell: true` allows the underlying OS to resolve the
  // executable correctly (npx.cmd on Windows).
  const port = await findFreePort(DEFAULT_PREVIEW_PORT)
  CURRENT_PREVIEW_URL = `http://127.0.0.1:${port}`
  const cmd = `npx vite preview --port ${port} --strictPort`
  const proc = spawn(cmd, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  })

  proc.on('error', (err) => {
    console.error('Failed to start preview server:', err)
  })

  proc.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.warn(`Preview server exited with code ${code}`)
    } else if (signal) {
      console.warn(`Preview server killed with signal ${signal}`)
    }
  })

  return proc
}

async function waitForServer(url, timeout = 30000, interval = 250) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: 'GET' })
      if (res && res.status < 500) return
    } catch (e) {
      // ignore, server not ready yet
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error(`Timed out waiting for preview server at ${url}`)
}

async function fetchSitemapRoutes(baseUrl) {
  const sitemapUrl = (baseUrl || CURRENT_PREVIEW_URL || `http://127.0.0.1:${DEFAULT_PREVIEW_PORT}`) + '/sitemap.xml'
  try {
    const res = await fetch(sitemapUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()

    // Extract <loc> values and return only pathnames (no queries, no origin checks).
    const paths = Array.from(text.matchAll(/<loc>(.*?)<\/loc>/g))
      .map((m) => m[1])
      .map((raw) => {
        try {
          const u = new URL(raw)
          return u.pathname
        } catch (e) {
          return null
        }
      })
      .filter(Boolean)

    console.log(`Sitemap: discovered ${paths.length} routes`)
    return paths
  } catch (err) {
    console.warn('Could not fetch/parse sitemap.xml:', err.message)
    return []
  }
}

async function writeHtmlForRoute(route, html) {
  const outPath = route === '/' ? path.join(DIST_DIR, 'index.html') : path.join(DIST_DIR, route.replace(/^\//, ''), 'index.html')
  const outDir = path.dirname(outPath)
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(outPath, html, 'utf8')
}

async function prerender() {
  if (!(await exists(DIST_DIR))) {
    throw new Error('dist directory not found — run `vite build` first')
  }

  const previewProc = await spawnPreview()

  try {
    const urlToWait = CURRENT_PREVIEW_URL || `http://127.0.0.1:${DEFAULT_PREVIEW_PORT}`
    await waitForServer(urlToWait)

    const browser = await chromium.launch()
    // Build final route list: manual routes + sitemap-derived routes (if any).
    const baseUrl = CURRENT_PREVIEW_URL || `http://127.0.0.1:${DEFAULT_PREVIEW_PORT}`

    const sitemapRoutes = await fetchSitemapRoutes(baseUrl).catch((e) => {
      console.warn('Failed to fetch sitemap.xml, continuing with manual routes only:', e.message)
      return []
    })

    const allRoutes = Array.from(new Set([...manualRoutes, ...sitemapRoutes])).filter((r) => {
      // Normalize
      if (!r.startsWith('/')) return false
      // Exclude dynamic/admin-like routes
      for (const pat of excludeIfContains) if (r.includes(pat)) return false
      return true
    })

    // Safety cap to avoid prerendering an excessive number of routes from
    // large sitemaps. Adjust `MAX_ROUTES` as needed for CI quotas.
    const MAX_ROUTES = process.env.PRERENDER_MAX_ROUTES ? Number(process.env.PRERENDER_MAX_ROUTES) : 100
    if (allRoutes.length > MAX_ROUTES) {
      console.warn(`Prerender route cap exceeded (${allRoutes.length}). Limiting to ${MAX_ROUTES}.`)
    }
    const finalRoutes = allRoutes.slice(0, MAX_ROUTES)

    for (const route of finalRoutes) {
      try {
        const page = await browser.newPage()
        const url = baseUrl + route
        console.log(`Prerender: visiting ${url}`)
        await page.goto(url, { waitUntil: 'networkidle' })

        // Wait for the app mount point to ensure the SPA rendered
        try {
          await page.waitForSelector('#root', { timeout: 5000 })
        } catch (e) {
          console.warn('Warning: #root not found for', route)
        }

        const html = await page.content()
        await writeHtmlForRoute(route, '<!doctype html>\n' + html)
        await page.close()
        console.log(`Prerender: wrote ${route}`)
      } catch (routeErr) {
        console.error(`Prerender error for route ${route}:`, routeErr)
      }
    }

    await browser.close()
  } finally {
    // Try to cleanly stop the preview server
    try {
      if (previewProc && !previewProc.killed) {
        previewProc.kill()
      }
    } catch (killErr) {
      // ignore
    }
  }
}

async function exists(p) {
  try {
    await fs.stat(p)
    return true
  } catch (e) {
    return false
  }
}

// Entrypoint
;(async () => {
  try {
    await prerender()
    console.log('Prerender complete')
    process.exit(0)
  } catch (err) {
    console.error('Prerender failed:', err)
    process.exit(2)
  }
})()
