# 17-interview-and-audit-workflows

> **Note**: Rename this file to `17-interview-and-audit-workflows.md` before committing.

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

Update `VALID_TRANSITIONS`:
```typescript
NEW: ['INTERVIEWING'],          // was ['PLANNED']
INTERVIEWING: ['PLANNED'],
// all other transitions unchanged
```

Add config keys to `ConfigSchema`:
```typescript
interviewModel: z.string().default('claude-sonnet-4-6'),
```

### New Command: `src/cli/commands/interview.ts`

`barf interview [--issue <id>]`

Logic:
1. Auto-select a NEW issue if `--issue` not given (via `provider.autoSelect('interview')`)
2. Transition `NEW → INTERVIEWING`
3. Run `interviewLoop(issueId, config, provider)` — see below
4. On completion: append Q&A to issue body via `provider.writeIssue()`, transition `INTERVIEWING → PLANNED`

### Interview Loop: `src/core/interview.ts`

New module (parallel to `batch.ts` but simpler — no concurrency, no lock file).

```typescript
async function interviewLoop(issueId, config, provider): ResultAsync<void, Error>
```

**Per turn**:
1. Call `runClaudeIteration(prompt, config.interviewModel, config, issueId)` — reuse existing function from `src/core/claude.ts`
2. Stream events; watch for tool calls: `ask_user` or `interview_complete`
3. `interview_complete`: break loop → done
4. `ask_user({ questions: AskUserQuestion[] })`: present each question in terminal, collect answers
5. Accumulate Q&A pairs, build next turn's prompt with `$PRIOR_QA` injected

**Tool schemas** (defined in prompt, parsed from stream tool events):
```typescript
// ask_user input
{ questions: Array<{ question: string; options?: string[] }> }

// interview_complete input
{}  // no args
```

**Terminal interaction** (when `ask_user` fires): for each question:
- Print question text
- If `options` present: print numbered list, read stdin choice (or "other")
- If no options: read free-text from stdin
- Uses Bun's `process.stdin` readline (or `prompt()`)

### New Prompt: `src/prompts/PROMPT_interview.md`

Variables: `$BARF_ISSUE_FILE`, `$BARF_ISSUE_ID`, `$PRIOR_QA`

Template structure:
```
Study the issue at $BARF_ISSUE_FILE. Your goal is to identify any ambiguities,
missing context, or unstated requirements that would cause the planning agent
to make incorrect assumptions.

You have two tools:

1. ask_user(questions) — ask the user for clarifications. Each question may
   include options (multiple choice). Call once per turn with ALL current questions.

2. interview_complete() — call when all questions are answered or no questions
   are needed. Call immediately if the issue is already clear and complete.

Prior Q&A from this session:
$PRIOR_QA

Instructions:
- If no prior Q&A and issue is clear: call interview_complete() immediately
- Do not ask about implementation details — only ask about requirements and context
- Max 5 questions per turn
- After user answers, assess if you need more info or can call interview_complete()
```

### `auto.ts` Changes

Add interview phase before plan phase:
1. List `NEW` issues → run `interviewLoop` for each (sequential — interactive)
2. List `INTERVIEWING` issues — warn/skip (means a previous interview was interrupted)
3. Continue with existing plan/build loop

### Q&A Written Back to Issue

After interview completes, append to issue body:
```markdown
## Interview Q&A

**Q: What is the target database?**
A: PostgreSQL

**Q: Should this support multi-tenancy?**
A: Yes, per-organization isolation
```

Uses `provider.writeIssue(id, { body: updatedBody })`.

---

## Feature 2: Audit Mode

### New Config Key

**File**: `src/types/index.ts` — `ConfigSchema`:
```typescript
auditModel: z.string().default('claude-opus-4-6'),
```

### New Command: `src/cli/commands/audit.ts`

`barf audit [--issue <id>] [--all]`

- Default: `--all` (audit all COMPLETED issues)
- `--issue <id>`: single issue

### Execution Flow

**Phase 1 — Deterministic checks** (via `execFileNoThrow` from `src/utils/execFileNoThrow.ts`):
```typescript
const testResult  = config.testCommand ? await execFileNoThrow(config.testCommand) : null;
const lintResult  = await execFileNoThrow('bun', ['run', 'lint']);
const fmtResult   = await execFileNoThrow('bun', ['run', 'format:check']);
```

Capture stdout/stderr + exit code for each. Pass as structured context to Phase 2.

**Phase 2 — AI audit** via `runClaudeIteration` (reuse from `src/core/claude.ts`):

Prompt includes:
- Issue file content
- Plan file content (from `config.planDir/<issueId>.md` if exists)
- Phase 1 results (pass/fail + output)
- CLAUDE.md and `.claude/rules/` content for rule context
- Instructions to evaluate acceptance criteria, production readiness, rule compliance

**If problems found**: Claude creates a new issue file in `config.issuesDir/` with:
- Title: `"Audit findings: <original title>"`
- State: `NEW`
- Body: structured findings (what failed, what needs fixing)
- Parent: original issue ID

**If clean**: print `✓ Issue #<id> passes audit`

No state change to the original COMPLETED issue.

### New Prompt: `src/prompts/PROMPT_audit.md`

Variables: `$BARF_ISSUE_FILE`, `$BARF_ISSUE_ID`, `$PLAN_FILE`, `$ISSUES_DIR`, `$TEST_RESULTS`, `$LINT_RESULTS`, `$FORMAT_RESULTS`, `$RULES_CONTEXT`

Template structure:
```
You are auditing the completed work for issue $BARF_ISSUE_ID.

## Issue
$BARF_ISSUE_FILE

## Plan
$PLAN_FILE

## Automated Check Results
Tests: $TEST_RESULTS
Lint:  $LINT_RESULTS
Format: $FORMAT_RESULTS

## Project Rules
$RULES_CONTEXT

Your task:
1. Check all acceptance criteria checkboxes — are they all marked complete?
2. Review whether the implementation actually fulfills each criterion
3. Verify code follows the rules above
4. Assess production readiness

If you find issues: create a new issue file at $ISSUES_DIR/audit-<id>.md with:
  - Frontmatter: state=NEW, parent=$BARF_ISSUE_ID, title="Audit findings: <original title>"
  - Body: detailed findings organized by category

If everything passes: output "AUDIT_PASS" on a single line.
```

---

## Critical Files

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `INTERVIEWING` state, update `VALID_TRANSITIONS`, add `interviewModel`/`auditModel` to `ConfigSchema` |
| `src/core/interview.ts` | New — interview loop logic |
| `src/cli/commands/interview.ts` | New — `barf interview` command |
| `src/cli/commands/audit.ts` | New — `barf audit` command |
| `src/prompts/PROMPT_interview.md` | New — interview prompt template |
| `src/prompts/PROMPT_audit.md` | New — audit prompt template |
| `src/cli/commands/auto.ts` | Add interview phase before plan phase |
| `src/index.ts` | Register `interview` and `audit` commands with commander |
| `tests/unit/interview.test.ts` | New — unit tests |
| `tests/unit/audit.test.ts` | New — unit tests |

## Reuse

- `runClaudeIteration()` — `src/core/claude.ts` — reused for both interview and audit Claude runs
- `execFileNoThrow()` — `src/utils/execFileNoThrow.ts` — reused for Phase 1 deterministic checks in audit
- `injectPromptVars()` — `src/core/batch.ts` — reused for prompt variable injection
- `provider.autoSelect()` — `src/core/issue-providers/base.ts` — reused for issue selection
- `provider.transition()` — `src/core/issue-providers/base.ts` — reused for state transitions
- `parseClaudeStream` / tool event parsing — `src/core/context.ts` — extended to detect `ask_user` / `interview_complete`

---

## Verification

```bash
# 1. Create a test issue
bun run dev init  # if needed
echo "---\nstate: NEW\ntitle: Test feature\n---\nBuild a widget" > issues/test-001.md

# 2. Run interview (should ask questions interactively)
bun run dev interview --issue test-001

# 3. Verify state changed to INTERVIEWING during run, then PLANNED
bun run dev status

# 4. Verify Q&A appended to issue file
cat issues/test-001.md

# 5. Run full auto workflow
bun run dev auto

# 6. After build completes, run audit
bun run dev audit --issue test-001

# 7. Verify new issue created if problems found
bun run dev status

# 8. Run tests
bun test

# 9. Check lint + format
bun run check
```
