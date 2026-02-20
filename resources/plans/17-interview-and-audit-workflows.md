# 17-interview-and-audit-workflows

## Context

barf currently jumps directly from `NEW → PLANNED` without any requirements clarification. Complex or ambiguous issues often get planned incorrectly because the agent lacks context the user holds implicitly. The **interview workflow** inserts a human-in-the-loop clarification step before planning.

Similarly, once issues are `COMPLETED` there is no quality gate — no check that acceptance criteria are actually met, that code follows project rules, or that tests/lint/format pass. The **audit mode** adds an on-demand post-completion quality gate that creates new follow-up issues when problems are found.

---

## Feature 1: Interview Workflow

### State Machine Changes

**File**: `src/types/index.ts`

Add state:
```typescript
// IssueStateSchema
z.enum(['NEW', 'INTERVIEWING', 'PLANNED', 'IN_PROGRESS', 'STUCK', 'SPLIT', 'COMPLETED'])
```

Update `VALID_TRANSITIONS` in `src/core/issue/index.ts`:
```typescript
NEW: ['INTERVIEWING'],          // was ['PLANNED']
INTERVIEWING: ['PLANNED'],
// all other transitions unchanged
```

Add config keys to `ConfigSchema`:
```typescript
interviewModel: z.string().default('claude-sonnet-4-6'),
auditModel: z.string().default('claude-opus-4-6'),
```

### New Command: `src/cli/commands/interview.ts`

`barf interview [--issue <id>]`

Logic:
1. Auto-select a NEW issue if `--issue` not given (via `provider.autoSelect('interview')`)
2. Transition `NEW → INTERVIEWING`
3. Run `interviewLoop(issueId, config, provider)` — see below
4. On completion: transition `INTERVIEWING → PLANNED`

### Interview Loop: `src/core/interview.ts`

New module (parallel to `batch.ts` but simpler — no concurrency, no lock file).

```typescript
function interviewLoop(issueId, config, provider): ResultAsync<void, Error>
```

**Implementation**: File-based Q&A exchange. The interview prompt instructs Claude to write
JSON to `$BARF_QUESTIONS_FILE`. After each `runClaudeIteration` call, barf reads that file.

**Per turn**:
1. Call `runClaudeIteration(prompt, config.interviewModel, config, issueId)`
2. Check if `$BARF_QUESTIONS_FILE` was written by Claude
3. If `{"complete": true}`: break loop → done
4. If `{"questions": [...]}`: present each question in terminal, collect answers
5. Accumulate Q&A pairs, inject `$PRIOR_QA` into next turn's prompt

**Terminal interaction** (when questions received): for each question:
- Print question text
- If `options` present: print numbered list, read stdin choice (or free-text)
- If no options: read free-text from stdin
- Uses `readline.createInterface` for stdin reading

### New Prompt: `src/prompts/PROMPT_interview.md`

Variables: `$BARF_ISSUE_FILE`, `$BARF_ISSUE_ID`, `$PRIOR_QA`, `$BARF_QUESTIONS_FILE`

Claude writes questions or completion signal as JSON to `$BARF_QUESTIONS_FILE`.

### `auto.ts` Changes

Add interview phase before plan phase:
1. List `NEW` issues → transition to INTERVIEWING, run `interviewLoop`, transition to PLANNED
2. List `INTERVIEWING` issues — warn/skip (means a previous interview was interrupted)
3. Continue with existing plan/build loop (PLAN_STATES now = `['INTERVIEWING']`, BUILD_STATES = `['PLANNED', 'IN_PROGRESS']`)

### Q&A Written Back to Issue

After interview completes, append to issue body:
```markdown
## Interview Q&A

**Q: What is the target database?**
A: PostgreSQL

**Q: Should this support multi-tenancy?**
A: Yes, per-organization isolation
```

---

## Feature 2: Audit Mode

### New Command: `src/cli/commands/audit.ts`

`barf audit [--issue <id>] [--all]`

- Default: `--all` (audit all COMPLETED issues)
- `--issue <id>`: single issue

### Execution Flow

**Phase 1 — Deterministic checks** (via `execFileNoThrow`):
```typescript
const testResult  = config.testCommand ? await execFileNoThrow('sh', ['-c', config.testCommand]) : null;
const lintResult  = await execFileNoThrow('bun', ['run', 'lint']);
const fmtResult   = await execFileNoThrow('bun', ['run', 'format:check']);
```

**Phase 2 — AI audit** via `runClaudeIteration`:

Prompt includes issue file, plan file, phase 1 results, and CLAUDE.md + `.claude/rules/` content.
Claude either creates a new issue file (findings) or signals `AUDIT_PASS`.

**If problems found**: Claude creates a new issue file in `config.issuesDir/` with:
- Title: `"Audit findings: <original title>"`
- State: `NEW`
- Body: structured findings
- Parent: original issue ID

**Detection**: compare issueDir file listing before/after Claude run.

**If clean**: print `✓ Issue #<id> passes audit`

No state change to the original COMPLETED issue.

### New Prompt: `src/prompts/PROMPT_audit.md`

Variables: `$BARF_ISSUE_FILE`, `$BARF_ISSUE_ID`, `$PLAN_FILE`, `$ISSUES_DIR`, `$TEST_RESULTS`, `$LINT_RESULTS`, `$FORMAT_RESULTS`, `$RULES_CONTEXT`

---

## Critical Files

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `INTERVIEWING` state, add `interviewModel`/`auditModel` to `ConfigSchema` |
| `src/core/issue/index.ts` | Update `VALID_TRANSITIONS`: `NEW → INTERVIEWING`, `INTERVIEWING → PLANNED` |
| `src/core/issue/base.ts` | Add `'interview'` to `AutoSelectMode`, add `interview: ['NEW']` priority |
| `src/core/interview.ts` | New — interview loop logic |
| `src/cli/commands/interview.ts` | New — `barf interview` command |
| `src/cli/commands/audit.ts` | New — `barf audit` command |
| `src/prompts/PROMPT_interview.md` | New — interview prompt template |
| `src/prompts/PROMPT_audit.md` | New — audit prompt template |
| `src/cli/commands/auto.ts` | Add interview phase, update PLAN_STATES/BUILD_STATES |
| `src/index.ts` | Register `interview` and `audit` commands with commander |
| `src/cli/commands/index.ts` | Export new commands |
| `tests/unit/interview.test.ts` | New — unit tests |
| `tests/unit/audit.test.ts` | New — unit tests |
| `tests/unit/issue.test.ts` | Update transition tests for new state machine |
| `tests/unit/issue-providers/local.test.ts` | Update autoSelect and transition tests |
