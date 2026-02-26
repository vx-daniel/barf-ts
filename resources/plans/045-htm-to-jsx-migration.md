# 045 — htm/preact → JSX Migration

## Goal

Replace `htm/preact` tagged template literals with native Preact JSX (`.tsx`) in the dashboard frontend. This enables Tailwind IntelliSense, TypeScript prop checking, and cleaner component syntax.

## Scope

3 files that use `htm/preact`: `KanbanBoard.ts`, `StatusBar.ts`, `main.ts`.
Imperative panels stay as-is.

## Changes

### 1. tsconfig.json

Add:
```json
"jsx": "react-jsx",
"jsxImportSource": "preact"
```

### 2. File renames

- `components/KanbanBoard.ts` → `.tsx`
- `components/StatusBar.ts` → `.tsx`
- `main.ts` → `.tsx`

### 3. Syntax conversion (per file)

- Remove `import { html } from 'htm/preact'`
- `html\`...\`` → JSX
- `class=` → `className=`
- `onClick=${fn}` → `onClick={fn}`
- `style=${{ ... }}` → `style={{ ... }}`
- `<${Component} />` → `<Component />`
- `<//>` → `</>`

### 4. Dependencies

- Remove `htm` from `package.json`

### 5. Build

- Update entrypoint in `build.ts`: `main.ts` → `main.tsx`

## Out of scope

- CSS changes
- Imperative panel conversion
- New dependencies (no clsx needed yet)
