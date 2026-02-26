# Barf First Full Run — Error Analysis & Solutions

**Target Location:** `/home/daniel/Projects/barf/barf-ts/resources/plans/026-barf-log-error-analysis.md`

## Context

Analysis of 24 JSONL stream logs from barf's first full run on `tests/sample-project/`. Despite 199 tool errors across 3,684 events, **95.8% of issues reached COMPLETED/VERIFIED**. Barf is remarkably robust — errors are recoverable, not fatal.

**The question isn't "why does barf fail?" — it's "why does barf stumble so much before succeeding?"**

---

## Root Cause: Incomplete Prompt Context

The single biggest finding from deep analysis of the prompt templates, Claude invocation code, and decision chain traces in the logs:

**Barf tells Claude WHAT to do but not WHERE things are.**

### What Claude Actually Receives (from code review)

| Context Element | Plan/Build Phase | Audit Phase | Impact |
|----------------|------------------|-------------|--------|
| Working directory path | ❌ Not in prompt text | ❌ | Claude guesses paths |
| Issue file content | ❌ Must Read() it | Path only | Triggers tool errors |
| Plan file content | ❌ Must Read() it | ✅ Injected | Triggers tool errors |
| AGENTS.md content | ❌ Must Read() it | ❌ | Claude can't find it |
| Project rules (CLAUDE.md) | ❌ Not available | ✅ Injected | Claude invents patterns |
| Project file structure | ❌ Not documented | ❌ | Claude explores blindly |
| Test framework info | ❌ Not specified | N/A | Claude guesses |

**Key code locations:**
- `src/core/claude.ts:250-261` — SDK query passes `cwd` as option but NOT in prompt text
- `src/core/batch.ts:175-185` — Template injection: only `BARF_ISSUE_ID`, `BARF_ISSUE_FILE` (relative path), `ISSUES_DIR`, `PLAN_DIR`
- `src/core/claude.ts:253` — `settingSources: []` disables CLAUDE.md loading
- `src/prompts/PROMPT_plan.md` — Says "Read AGENTS.md" without specifying where

### What Happens in Practice (from log traces)

**Decision chain pattern (every error follows this):**
```
THINKING: "I need to read the issue file..." (assumes path)
   ↓
ACTION: Read('/root/repo/issues/003.md')  ← hallucinated from training data
   ↓
ERROR: EACCES permission denied
   ↓
THINKING: "Let me try /home/user/issues/003.md" ← another guess
   ↓
ERROR: File not found
   ↓
RECOVERY: ls ./ → discovers actual structure → Read('./issues/003.md') ✅
```

**This costs 5-39 extra events per issue** just to discover the working directory.

---

## Error Breakdown

| Error Type | Count | % | Root Cause | Recoverable? |
|-----------|-------|---|-----------|--------------|
| Sibling tool cascades | 121 | 60.8% | One Read() fails → all parallel reads fail | ✅ Yes |
| File not found | 35 | 17.6% | Claude guesses wrong paths | ✅ Yes |
| Permission denied | 25 | 12.6% | Claude tries /root/repo/ paths | ✅ Yes |
| Test/build failures | 9 | 4.5% | Tests run before exports exist; wrong biome flag | ✅ Yes |
| Other (EISDIR, etc.) | 9 | 4.5% | Claude reads directory as file | ✅ Yes |

**78% of errors (155/199) would be eliminated by telling Claude where files are.**

---

## Solutions

### Solution 1: Context Enrichment (Eliminates ~155 errors / 78%)

**Problem:** Claude has to discover the project structure through trial and error.

**Fix:** Preload essential context into the prompt before Claude starts working.

**Implementation in `src/core/batch.ts` (around line 175):**

```typescript
// Before calling injectTemplateVars, build context block
const cwd = process.cwd()
const agentsContent = await safeReadFile(join(cwd, 'AGENTS.md'))
const issueContent = await safeReadFile(join(cwd, config.issuesDir, `${issueId}.md`))
const planContent = await safeReadFile(join(cwd, config.planDir, `${issueId}.md`))

const contextBlock = `
# Environment

Working directory: ${cwd}
All paths below are relative to this directory.

## Project Structure
- Issue files: ./${config.issuesDir}/
- Plan files: ./${config.planDir}/
- Source code: ./src/
- Tests: ./tests/
- Conventions: ./AGENTS.md

## Current Issue (${issueId})
<file path="./${config.issuesDir}/${issueId}.md">
${issueContent}
</file>

${planContent ? `## Existing Plan
<file path="./${config.planDir}/${issueId}.md">
${planContent}
</file>` : ''}

## Project Conventions (AGENTS.md)
<file path="./AGENTS.md">
${agentsContent}
</file>

---

`
```

Then prepend `contextBlock` to the prompt before calling `query()`.

**Why this works:**
- Claude no longer needs to Read() common files → eliminates parallel Read failures
- Claude knows the exact working directory → no path guessing
- Claude has project conventions → follows patterns instead of inventing
- Fewer tool calls → fewer sibling cascade opportunities

**Files to modify:**
- `src/core/batch.ts:175-190` — Build context block and prepend to prompt
- `src/core/claude.ts:250-261` — Accept enriched prompt
- Add `safeReadFile()` utility (try/catch around readFile, return empty string on failure)

**Expected impact:**
- Eliminates 35 file-not-found + 25 permission-denied = 60 direct errors
- Eliminates ~95 sibling cascades triggered by those Read failures
- **Total: ~155 errors eliminated (78% reduction)**

---

### Solution 2: Rules Context in Plan/Build Phases (Quality improvement)

**Problem:** Only the audit phase receives `$RULES_CONTEXT` (project rules from CLAUDE.md + `.claude/rules/`). Plan and build phases get no project conventions, so Claude invents patterns.

**Fix:** Add `RULES_CONTEXT` injection to plan and build template variables.

**Implementation in `src/core/batch.ts`:**

```typescript
// Reuse the same rulesContext loading from audit.ts
import { loadRulesContext } from './audit-utils' // or wherever it lives

const rulesContext = await loadRulesContext(config)

// Add to template vars
const prompt = injectTemplateVars(
  resolvePromptTemplate(currentMode, config),
  {
    ...existingVars,
    RULES_CONTEXT: rulesContext, // NEW
  },
)
```

**And update prompt templates:**
- `PROMPT_plan.md` — Add `$RULES_CONTEXT` section
- `PROMPT_build.md` — Add `$RULES_CONTEXT` section

**Expected impact:** Better code quality, fewer convention violations, fewer verification failures.

---

### Solution 3: Fix Biome Command (Eliminates 1 error class)

**Problem:** `PROMPT_build.md` uses `biome format --check` which doesn't exist in biome v2.4.4.

**Fix:** Replace with `biome check` (runs format + lint + import sort).

**File:** `src/prompts/PROMPT_build.md`

**Change:**
```diff
- bun x biome format --check src/ tests/
+ bun x biome check src/ tests/
```

---

### Solution 4: Config Value Redaction in Logs (Security)

**Problem:** When Claude reads `.barfrc.github` or `.env`, the full contents (including tokens) get logged to JSONL unredacted.

**Fix:** Add a redaction layer in the stream logger.

**Implementation in `src/core/claude.ts` (log writing section):**

```typescript
const REDACT_PATTERNS = [
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /gho_[A-Za-z0-9]{36}/g,
  /sk-[A-Za-z0-9]{20,}/g,
]

function redactSecrets(json: string): string {
  let result = json
  for (const pattern of REDACT_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}

// In the logging line:
logStream?.write(`${redactSecrets(JSON.stringify(msg))}\n`)
```

**Expected impact:** Prevents future token leaks in stream logs.

---

### Solution 5: Pre-Validation Before Tests (Eliminates ~9 errors)

**Problem:** Barf runs `bun test` immediately after Claude's output, before validating that exports exist. Tests fail with `Export named 'X' not found`.

**Fix:** Add export validation before running tests in verification.

**Implementation in `src/core/verification.ts`:**

```typescript
// Before running tests, check if src/index.ts exports the expected symbols
async function validateExports(testFile: string, srcFile: string): Promise<boolean> {
  const testContent = await readFile(testFile, 'utf-8')
  const importMatch = testContent.match(/import\s*\{([^}]+)\}\s*from/)
  if (!importMatch) return true // No imports to validate

  const expectedExports = importMatch[1].split(',').map(s => s.trim())
  const srcContent = await readFile(srcFile, 'utf-8')

  return expectedExports.every(name =>
    srcContent.includes(`export function ${name}`) ||
    srcContent.includes(`export const ${name}`) ||
    srcContent.includes(`export { ${name}`)
  )
}
```

**Expected impact:** Prevents 9 premature test failures.

---

## Success Patterns to Preserve

From comparing successful vs failed issues:

| Pattern | Cleanest Issues (3-6 errors) | Messiest Issues (12-14 errors) |
|---------|------------------------------|-------------------------------|
| **Acceptance criteria** | Clear, testable, 3-4 items | Implicit, dependent on other issues |
| **Scope** | Single function implementation | Verification fix, multi-file changes |
| **Tool calls** | 8-10 reads, 7-10 bash | 30-50 reads, 30-45 bash |
| **Token usage** | 400-500 | 1,500-1,750 |
| **Messages** | ~24 user messages | 100-165 user messages |

**Key insight:** Simple, well-defined issues with clear acceptance criteria consistently have the fewest errors. The best way to reduce errors is to ensure issues are well-scoped before execution.

---

## Issue Completion Summary

| Issue | Errors | Final State | Notes |
|-------|--------|-------------|-------|
| 003 | 6 | VERIFIED | Simple function |
| 004 | 4 | VERIFIED | Simple function |
| 005 | 9 | VERIFIED | TDD pattern, export issues |
| 009-1 | 3 | VERIFIED | **Cleanest run** |
| 009-2 | 8 | VERIFIED | Medium complexity |
| 010 | 6 | SPLIT | Parent split into 4 children |
| 010-1 | 10 | VERIFIED | Split child |
| 010-2 | 14 | VERIFIED | Split child, most errors |
| 010-3 | 6 | VERIFIED | Split child |
| 010-4 | 10 | VERIFIED | Split child |
| 011 | 6 | VERIFIED | Medium complexity |
| 012 | 10 | VERIFIED | Medium complexity |
| 013 | 12 | COMPLETED | Verification fix |
| 014 | 14 | COMPLETED | Verification fix, **token leak** |
| 015 | 6 | VERIFIED | Medium complexity |
| 017 | 9 | VERIFIED | Medium complexity |
| 018 | 9 | VERIFIED | Medium complexity |
| 019 | 8 | VERIFIED | Medium complexity |
| 020 | 6 | VERIFIED | Medium complexity |
| 021 | 6 | VERIFIED | Medium complexity |
| 022 | 10 | VERIFIED | Higher complexity |
| 023 | 6 | VERIFIED | Medium complexity |
| 024 | 12 | COMPLETED | Complex issue |
| 025 | 9 | VERIFIED | Medium complexity |

**Success rate: 23/24 (95.8%) reached COMPLETED or VERIFIED**

---

## Implementation Priority

| # | Solution | Impact | Effort | Files |
|---|----------|--------|--------|-------|
| 1 | Context enrichment | 78% error reduction | Medium | batch.ts, claude.ts |
| 2 | Rules in plan/build | Quality improvement | Low | batch.ts, PROMPT_plan.md, PROMPT_build.md |
| 3 | Fix biome command | 1 error class | Trivial | PROMPT_build.md |
| 4 | Secret redaction | Security | Low | claude.ts |
| 5 | Pre-test validation | 4.5% error reduction | Medium | verification.ts |

**Expected total impact:** 199 errors → ~35 errors (82% reduction) while maintaining the 95.8% success rate.

---

## Verification

After implementing solutions, verify by:

1. **Re-run barf on sample-project:**
   ```bash
   rm -rf tests/sample-project/.log/local/*.jsonl
   bun run cli -- auto --cwd tests/sample-project
   ```

2. **Count errors:**
   ```bash
   grep -c '"is_error":true' tests/sample-project/.log/local/*.jsonl
   ```
   Expected: <40 total (vs 199 before)

3. **Check no path hallucinations:**
   ```bash
   grep -r '/root/repo' tests/sample-project/.log/local/
   grep -r '/home/user' tests/sample-project/.log/local/
   ```
   Expected: No matches

4. **Check no token leaks:**
   ```bash
   grep -r 'github_pat_' tests/sample-project/.log/local/
   ```
   Expected: No matches (or `[REDACTED]`)

5. **Check biome command:**
   ```bash
   grep 'biome format --check' tests/sample-project/.log/local/
   ```
   Expected: No matches
