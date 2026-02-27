/**
 * Builds the dashboard frontend using Bun.build().
 *
 * Usage:
 *   bun tools/dashboard/build.ts           # single build
 *   bun tools/dashboard/build.ts --watch   # rebuild on frontend changes
 *
 * Outputs bundled JS + CSS to tools/dashboard/dist/.
 * The index.html is copied separately since Bun.build() doesn't process HTML.
 */

import { spawnSync } from 'bun'
import { mkdirSync, readFileSync, watch, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = import.meta.dir
const FRONTEND = join(ROOT, 'frontend')
const DIST = join(ROOT, 'dist')

async function build(): Promise<boolean> {
  mkdirSync(DIST, { recursive: true })

  // Bundle TypeScript
  const result = await Bun.build({
    entrypoints: [join(FRONTEND, 'main.tsx')],
    outdir: DIST,
    minify: true,
    sourcemap: 'external',
    target: 'browser',
    external: [],
  })

  if (!result.success) {
    console.error('Build failed:')
    for (const msg of result.logs) {
      console.error(msg)
    }
    return false
  }

  console.log('JS bundle:', result.outputs.map((o) => o.path).join(', '))

  // Build CSS via Tailwind CLI (handles @import chain + utility scanning + minification)
  const tw = spawnSync(
    [
      process.execPath,
      'x',
      '--bun',
      '@tailwindcss/cli',
      '-i',
      join(FRONTEND, 'styles', 'index.css'),
      '-o',
      join(DIST, 'styles.css'),
      '--minify',
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  )
  if (tw.exitCode !== 0) {
    console.error('Tailwind build failed')
    return false
  }
  console.log('CSS bundle: styles.css (Tailwind v4)')

  // Read source HTML and rewrite asset paths for dist
  let html = readFileSync(join(FRONTEND, 'index.html'), 'utf8')
  // Replace individual CSS links with single bundled stylesheet
  html = html.replace(
    /<link rel="stylesheet" href="\.\/styles\/[^"]+"\s*\/?>\n?/g,
    '',
  )
  html = html.replace(
    '</head>',
    '<link rel="stylesheet" href="/styles.css">\n</head>',
  )
  // Replace module script src
  html = html.replace('src="./main.tsx"', 'src="/main.js"')

  writeFileSync(join(DIST, 'index.html'), html)
  console.log('HTML: index.html')
  console.log('Build complete! Output:', DIST)
  return true
}

// Initial build
if (!(await build())) {
  if (!process.argv.includes('--watch')) process.exit(1)
}

// Watch mode: rebuild on frontend file changes
if (process.argv.includes('--watch')) {
  let debounce: ReturnType<typeof setTimeout> | null = null

  console.log('\nWatching frontend/ for changes...')
  watch(FRONTEND, { recursive: true }, (_event, filename) => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(async () => {
      console.log(
        `\n[${new Date().toLocaleTimeString()}] Change detected: ${filename}`,
      )
      await build()
    }, 150)
  })
}
