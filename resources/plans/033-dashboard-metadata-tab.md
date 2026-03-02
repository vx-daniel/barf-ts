# Dashboard Metadata Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Metadata" tab to the dashboard editor panel that displays all issue frontmatter fields as syntax-highlighted JSON.

**Architecture:** Extend the existing three-panel editor (Preview/Edit) with a third "Metadata" tab. When activated, extract frontmatter from the Issue object (excluding body), format as pretty-printed JSON, apply syntax highlighting via regex, and render safely using the existing `safeRenderHTML` helper.

**Tech Stack:** TypeScript, vanilla JS DOM manipulation, CSS (no external libraries)

---

## Task 1: Add Metadata Container and Tab Button to HTML

**Files:**
- Modify: `tools/dashboard/frontend/index.html:49-56`

**Step 1: Add metadata tab button**

In `index.html`, add the metadata tab button after the Edit tab button:

```html
<div id="editor-tabs">
  <button class="editor-tab active" data-tab="preview">Preview</button>
  <button class="editor-tab" data-tab="edit">Edit</button>
  <button class="editor-tab" data-tab="metadata">Metadata</button>
</div>
```

**Step 2: Add metadata content container**

In the `#editor-content` section, add the metadata viewer div after `#editor-cm`:

```html
<div id="editor-content">
  <div id="editor-preview"></div>
  <div id="editor-cm"></div>
  <div id="editor-metadata"></div>
</div>
```

**Step 3: Verify HTML changes**

Open `tools/dashboard/frontend/index.html` and confirm:
- Line ~51: Three tab buttons exist
- Line ~54-56: Three content divs exist

**Step 4: Commit**

```bash
git add tools/dashboard/frontend/index.html
git commit -m "feat(dashboard): add metadata tab button and container"
```

---

## Task 2: Add CSS Styles for Metadata Viewer

**Files:**
- Modify: `tools/dashboard/frontend/styles/editor.css` (append to end)

**Step 1: Add metadata viewer base styles**

Append to `editor.css`:

```css
/* Metadata tab viewer */
#editor-metadata {
  display: none;
  height: 100%;
  overflow: auto;
}

.metadata-viewer {
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  padding: 16px;
  overflow: auto;
  height: 100%;
  margin: 0;
  line-height: 1.5;
}

/* JSON syntax highlighting */
.json-key {
  color: #9cdcfe;  /* Light blue for keys */
}

.json-string {
  color: #ce9178;  /* Orange for string values */
}

.json-number {
  color: #b5cea8;  /* Light green for numbers */
}

.json-boolean {
  color: #569cd6;  /* Blue for true/false */
}

.json-null {
  color: #808080;  /* Gray for null */
}
```

**Step 2: Verify CSS addition**

Open `tools/dashboard/frontend/styles/editor.css` and confirm the styles are appended at the end.

**Step 3: Commit**

```bash
git add tools/dashboard/frontend/styles/editor.css
git commit -m "feat(dashboard): add metadata viewer CSS styles"
```

---

## Task 3: Implement renderMetadataJSON Function

**Files:**
- Modify: `tools/dashboard/frontend/panels/editor.ts:67` (after safeRenderHTML function)

**Step 1: Add renderMetadataJSON function**

Insert after the `safeRenderHTML` function (around line 67):

```typescript
/**
 * Renders issue frontmatter (excluding body) as syntax-highlighted JSON.
 * Uses regex-based syntax highlighting for keys, strings, numbers, booleans, and null.
 * Returns HTML string meant to be rendered via safeRenderHTML.
 */
function renderMetadataJSON(issue: Issue): string {
  // Extract frontmatter, exclude body field
  const { body, ...frontmatter } = issue

  // Pretty-print JSON with 2-space indentation
  const json = JSON.stringify(frontmatter, null, 2)

  // Apply syntax highlighting via regex replacements
  const highlighted = json
    // Keys: "fieldName":
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1":</span>')
    // String values: "value"
    .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
    // Numbers: 123
    .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
    // Booleans: true/false
    .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
    // Null values
    .replace(/: null/g, ': <span class="json-null">null</span>')

  return `<pre class="metadata-viewer">${highlighted}</pre>`
}
```

**Step 2: Verify function addition**

Open `tools/dashboard/frontend/panels/editor.ts` and confirm:
- Function exists after `safeRenderHTML`
- TSDoc comment is present
- All regex replacements are included

**Step 3: Commit**

```bash
git add tools/dashboard/frontend/panels/editor.ts
git commit -m "feat(dashboard): add renderMetadataJSON function"
```

---

## Task 4: Wire Up Metadata Tab in Tab Switcher

**Files:**
- Modify: `tools/dashboard/frontend/panels/editor.ts:85-105` (tab click handler)

**Step 1: Update tab click handler logic**

Replace the existing tab click handler (lines 85-105) with this updated version that includes metadata handling:

```typescript
document.getElementById('editor-tabs')?.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (!target.classList.contains('editor-tab')) return
  const tab = target.dataset.tab
  document
    .querySelectorAll('.editor-tab')
    .forEach((t) => t.classList.remove('active'))
  target.classList.add('active')

  const cm = document.getElementById('editor-cm')!
  const preview = document.getElementById('editor-preview')!
  const metadata = document.getElementById('editor-metadata')!

  if (tab === 'edit') {
    if (!editorView) mountCodeMirror(currentBody)
    cm.style.display = ''
    preview.style.display = 'none'
    metadata.style.display = 'none'
  } else if (tab === 'metadata') {
    cm.style.display = 'none'
    preview.style.display = 'none'
    metadata.style.display = 'block'
    // Render metadata using safe HTML rendering
    const issues = callbacks?.getIssues() ?? []
    const currentIssue = issues.find(i => i.id === currentIssueId)
    if (currentIssue) {
      const htmlString = renderMetadataJSON(currentIssue)
      safeRenderHTML(metadata, htmlString)
    }
  } else {
    // Preview tab
    cm.style.display = 'none'
    preview.style.display = 'block'
    metadata.style.display = 'none'
    updatePreview()
  }
})
```

**Step 2: Update default tab initialization in openIssue**

In the `openIssue` function (around line 243-252), update the default tab setup to hide metadata:

```typescript
// Default to preview tab
document
  .querySelector('.editor-tab[data-tab="edit"]')
  ?.classList.remove('active')
document
  .querySelector('.editor-tab[data-tab="metadata"]')
  ?.classList.remove('active')
document
  .querySelector('.editor-tab[data-tab="preview"]')
  ?.classList.add('active')
document.getElementById('editor-cm')!.style.display = 'none'
document.getElementById('editor-preview')!.style.display = 'block'
document.getElementById('editor-metadata')!.style.display = 'none'
updatePreview()
```

**Step 3: Verify changes**

Open `tools/dashboard/frontend/panels/editor.ts` and confirm:
- Tab handler includes metadata case
- Metadata uses `safeRenderHTML` (NOT direct innerHTML assignment)
- Metadata container is hidden/shown appropriately
- renderMetadataJSON is called when metadata tab is activated
- Default tab initialization hides metadata div

**Step 4: Commit**

```bash
git add tools/dashboard/frontend/panels/editor.ts
git commit -m "feat(dashboard): wire up metadata tab switching logic"
```

---

## Task 5: Build and Test Dashboard

**Step 1: Build the dashboard**

```bash
cd tools/dashboard
bun run build
```

Expected output: Build completes successfully, no TypeScript errors

**Step 2: Start the dashboard server**

```bash
bun run dashboard
```

Expected output: Server starts on http://localhost:3000

**Step 3: Manual verification checklist**

Open http://localhost:3000 in browser and test:

1. **Tab visibility:**
   - [ ] Metadata tab button appears next to Preview/Edit
   - [ ] All three tabs are visible in the editor panel

2. **Tab switching:**
   - [ ] Click an issue card to open editor
   - [ ] Click Preview tab → body preview shows
   - [ ] Click Edit tab → CodeMirror editor shows
   - [ ] Click Metadata tab → JSON viewer shows
   - [ ] Active tab indicator moves correctly

3. **JSON rendering:**
   - [ ] All frontmatter fields display (id, title, state, parent, children, split_count, etc.)
   - [ ] `body` field is NOT shown
   - [ ] JSON is pretty-printed with 2-space indentation
   - [ ] Syntax highlighting works:
     - Keys are light blue
     - Strings are orange
     - Numbers are light green
     - Booleans (true/false) are blue
     - null values are gray

4. **Edge cases:**
   - [ ] Empty children array shows as `[]`
   - [ ] Optional fields (context_usage_percent, needs_interview) show when present
   - [ ] Optional fields are omitted when undefined
   - [ ] Long token counts are readable

5. **Visual check:**
   - [ ] Dark theme background matches editor (#1e1e1e)
   - [ ] Monospace font renders correctly
   - [ ] Scrolling works for long metadata
   - [ ] Padding and spacing look clean

6. **Different issue types:**
   - [ ] NEW issue with needs_interview=true
   - [ ] GROOMED issue with context_usage_percent
   - [ ] BUILT issue with verify_count
   - [ ] Issue with parent/children relationships

**Step 4: Record any issues found**

If issues found, create follow-up tasks. Otherwise, proceed to final commit.

---

## Task 6: Final Commit and Cleanup

**Step 1: Verify all changes are committed**

```bash
git status
```

Expected: Working tree clean, or only untracked build artifacts

**Step 2: Review commit history**

```bash
git log --oneline -5
```

Expected output should show 4 commits:
1. feat(dashboard): add metadata tab button and container
2. feat(dashboard): add metadata viewer CSS styles
3. feat(dashboard): add renderMetadataJSON function
4. feat(dashboard): wire up metadata tab switching logic

**Step 3: Push if working in a branch**

If working in a feature branch:
```bash
git push origin HEAD
```

**Step 4: Document completion**

Create a completion note if needed, or mark task as done in project tracker.

---

## Success Criteria

- ✓ Metadata tab appears alongside Preview and Edit
- ✓ All frontmatter fields (except body) display as JSON
- ✓ JSON is syntax-highlighted with appropriate colors
- ✓ Tab switching works smoothly across all three tabs
- ✓ Styling matches dashboard dark theme
- ✓ No external dependencies added
- ✓ No TypeScript compilation errors
- ✓ Manual verification checklist complete
- ✓ Uses `safeRenderHTML` (no direct innerHTML assignments)

---

## Notes

- No automated tests: Dashboard frontend has no test infrastructure
- Manual testing is standard for dashboard UI features
- All TypeScript types are inferred from existing Issue interface
- Regex-based syntax highlighting is sufficient for this use case (no JSON parser needed)
- Security: Uses existing `safeRenderHTML` helper to safely inject HTML content
