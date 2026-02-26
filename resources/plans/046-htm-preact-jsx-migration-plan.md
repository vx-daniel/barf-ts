# htm/preact → JSX Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `htm/preact` tagged templates with native Preact JSX in 3 dashboard frontend files.

**Architecture:** Mechanical syntax conversion — no behavior changes. Bun.build() handles JSX natively with tsconfig settings.

**Tech Stack:** Preact, TypeScript JSX, Bun

---

### Task 1: Configure TypeScript for JSX

**Files:**
- Modify: `tsconfig.json`

**Step 1: Add JSX compiler options**

Add to `compilerOptions`:
```json
"jsx": "react-jsx",
"jsxImportSource": "preact"
```

**Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "feat(dashboard): enable Preact JSX in tsconfig"
```

---

### Task 2: Convert KanbanBoard to JSX

**Files:**
- Rename: `tools/dashboard/frontend/components/KanbanBoard.ts` → `KanbanBoard.tsx`
- Reference: `tools/dashboard/frontend/lib/constants.ts` (CMD_ACTIONS, CMD_CLASS types)

**Step 1: Rename file**

```bash
git mv tools/dashboard/frontend/components/KanbanBoard.ts tools/dashboard/frontend/components/KanbanBoard.tsx
```

**Step 2: Convert syntax**

Key transformations:
- Remove `import { html } from 'htm/preact'`
- Remove `import { Fragment } from 'preact'` (JSX `<>` handles fragments)
- All `html\`...\`` → JSX
- `class=` → `className=`
- `class=${expr}` → `className={expr}`
- `onClick=${fn}` → `onClick={fn}`
- `style=${{ ... }}` → `style={{ ... }}`
- `<${Component} prop=${val} />` → `<Component prop={val} />`
- `<${Fragment}>...<//>` → `<>...</>`
- `key=${x}` → `key={x}`
- Conditional rendering: `${cond && html\`...\`}` → `{cond && (...)}`
- Map: `${arr.map(x => html\`...\`)}` → `{arr.map(x => (...))}`

**Step 3: Verify no `html\`` remains in the file**

**Step 4: Commit**

```bash
git add tools/dashboard/frontend/components/KanbanBoard.tsx
git commit -m "feat(dashboard): convert KanbanBoard to JSX"
```

---

### Task 3: Convert StatusBar to JSX

**Files:**
- Rename: `tools/dashboard/frontend/components/StatusBar.ts` → `StatusBar.tsx`

**Step 1: Rename file**

```bash
git mv tools/dashboard/frontend/components/StatusBar.ts tools/dashboard/frontend/components/StatusBar.tsx
```

**Step 2: Convert syntax**

Same transformations as Task 2. StatusBar has 3 `html\`` calls.
- The `<${Fragment}>` wrapper → `<>...</>`
- Inline `${}` interpolations → `{}` JSX expressions

**Step 3: Commit**

```bash
git add tools/dashboard/frontend/components/StatusBar.tsx
git commit -m "feat(dashboard): convert StatusBar to JSX"
```

---

### Task 4: Convert main.ts to JSX + update build

**Files:**
- Rename: `tools/dashboard/frontend/main.ts` → `main.tsx`
- Modify: `tools/dashboard/build.ts` (entrypoint path)

**Step 1: Rename main.ts**

```bash
git mv tools/dashboard/frontend/main.ts tools/dashboard/frontend/main.tsx
```

**Step 2: Convert the 2 render calls**

```tsx
// Before:
import { html } from 'htm/preact'
render(html`<${KanbanBoard} />`, getEl('board'))
render(html`<${StatusBar} />`, getEl('statusbar'))

// After:
render(<KanbanBoard />, getEl('board'))
render(<StatusBar />, getEl('statusbar'))
```

Remove the `htm/preact` import.

**Step 3: Update build.ts entrypoint**

In `tools/dashboard/build.ts`, change:
```ts
entrypoints: [join(FRONTEND, 'main.ts')],
// →
entrypoints: [join(FRONTEND, 'main.tsx')],
```

**Step 4: Commit**

```bash
git add tools/dashboard/frontend/main.tsx tools/dashboard/build.ts
git commit -m "feat(dashboard): convert main to JSX, update build entrypoint"
```

---

### Task 5: Remove htm dependency

**Files:**
- Modify: `package.json`

**Step 1: Remove htm**

```bash
bun remove htm
```

**Step 2: Verify no remaining htm imports**

```bash
grep -r "htm/preact\|htm'" tools/dashboard/frontend/
```

Expected: no matches.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: remove htm dependency"
```

---

### Task 6: Build + verify

**Step 1: Run the build**

```bash
bun tools/dashboard/build.ts
```

Expected: JS bundle + CSS bundle + HTML output, no errors.

**Step 2: Type check**

```bash
bunx tsc --noEmit
```

Expected: no errors (or only pre-existing ones unrelated to dashboard).

**Step 3: Verify the index.html references main.js (not main.ts)**

The build.ts already rewrites `src="./main.ts"` → `src="/main.js"` — the `.tsx` source extension doesn't appear in HTML. But verify the regex still matches: the source HTML has `src="./main.ts"` which is now `main.tsx` on disk. **The regex in build.ts reads `index.html` which still has `src="./main.ts"`** — this is the HTML template, not the TS source. Check if index.html needs updating.

**Step 4: Update index.html and build.ts regex**

`tools/dashboard/frontend/index.html:104` has `<script type="module" src="./main.ts">`. Change to `src="./main.tsx"`.

In `tools/dashboard/build.ts`, update the regex:
```ts
html = html.replace('src="./main.ts"', 'src="/main.js"')
// →
html = html.replace('src="./main.tsx"', 'src="/main.js"')
```

**Step 5: Rebuild and confirm**

```bash
bun tools/dashboard/build.ts
```
