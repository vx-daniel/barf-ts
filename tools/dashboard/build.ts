/**
 * Builds the dashboard frontend using Bun.build().
 *
 * Usage: bun tools/dashboard/build.ts
 *
 * Outputs bundled JS + CSS to tools/dashboard/dist/.
 * The index.html is copied separately since Bun.build() doesn't process HTML.
 */
import { join } from 'path'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

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

// Copy and concatenate CSS files
const cssFiles = ['base.css', 'kanban.css', 'editor.css', 'status.css', 'activity.css']
const cssContent = cssFiles
  .map((f) => readFileSync(join(FRONTEND, 'styles', f), 'utf8'))
  .join('\n')
writeFileSync(join(DIST, 'styles.css'), cssContent)
console.log('CSS bundle: styles.css')

// Read source HTML and rewrite asset paths for dist
let html = readFileSync(join(FRONTEND, 'index.html'), 'utf8')
// Replace individual CSS links with single bundled stylesheet
html = html.replace(/<link rel="stylesheet" href="\.\/styles\/[^"]+"\s*\/?>\n?/g, '')
html = html.replace('</head>', '<link rel="stylesheet" href="/styles.css">\n</head>')
// Replace module script src
html = html.replace('src="./main.ts"', 'src="/main.js"')

writeFileSync(join(DIST, 'index.html'), html)
console.log('HTML: index.html')
console.log('Build complete! Output:', DIST)
