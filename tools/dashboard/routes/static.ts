/**
 * Static file server — serves bundled frontend from dist/.
 */
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

const DIST_DIR = join(import.meta.dir, '..', 'dist')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

export function serveStatic(pathname: string): Response | null {
  const filePath = pathname === '/' ? join(DIST_DIR, 'index.html') : join(DIST_DIR, pathname)

  if (!filePath.startsWith(DIST_DIR)) {
    return new Response('Forbidden', { status: 403 })
  }

  if (!existsSync(filePath)) return null

  const ext = filePath.slice(filePath.lastIndexOf('.'))
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'

  return new Response(readFileSync(filePath), {
    headers: { 'Content-Type': contentType },
  })
}
