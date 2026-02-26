/**
 * Builds the dashboard frontend using Bun.build().
 *
 * Usage: bun tools/dashboard/build.ts
 *
 * Outputs bundled JS + CSS to tools/dashboard/dist/.
 * The index.html is copied separately since Bun.build() doesn't process HTML.
 */
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { spawnSync } from 'bun'

const ROOT = import.meta.dir
const FRONTEND = join(ROOT, 'frontend')
const DIST = join(ROOT, 'dist')

mkdirSync(DIST, { recursive: true })

// Bundle TypeScript
const result = await Bun.build({
  entrypoints: [join(FRONTEND, 'main.ts')],
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
  process.exit(1)
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
  process.exit(1)
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
html = html.replace('src="./main.ts"', 'src="/main.js"')

writeFileSync(join(DIST, 'index.html'), html)
console.log('HTML: index.html')
console.log('Build complete! Output:', DIST)
