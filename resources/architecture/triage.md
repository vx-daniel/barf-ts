# Triage System

**Source:** `src/core/triage/`

Triage is a one-shot Claude evaluation of NEW issues. It determines whether an issue has enough information to plan immediately, or needs clarifying questions first.

## Flow

```mermaid
flowchart TD
    A([triageIssue]) --> B[Fetch issue\nmust be NEW]
    B --> C[Resolve PROMPT_triage.md\ninject issue body]
    C --> D[Call Claude one-shot\noutput-format json]
    D --> E[parseTriageResponse]
    E --> F{needs_interview?}
    F -- false --> G[Set needs_interview=false\nready to plan]
    F -- true --> H[Set needs_interview=true\nAppend questions to body]
    G --> I[Transition NEW → GROOMED]
    H --> I
    I --> J[Persist session stats]
    J --> K([done])
```

## Output

Claude returns JSON. The `parseTriageResponse` function handles both envelope formats (current array format and legacy object format):

```json
{ "needs_interview": false }

{ "needs_interview": true, "questions": [
    "What authentication method should be used?",
    "Should sessions be persistent across browser restarts?"
]}
```

## needs_interview Flag

```
undefined   issue hasn't been triaged yet (triage will run)
false       ready to plan — no clarification needed
true        questions appended to issue body, waits for human
```

In `auto` mode, triage runs on all NEW issues where `needs_interview === undefined` before any planning starts.

## Interview Flow (when needs_interview = true)

```mermaid
flowchart TD
    A[Issue: needs_interview=true] --> B{How?}
    B -- CLI / file --> C[Human edits issue markdown\nanswers questions inline]
    C --> D[Human sets needs_interview=false]
    B -- Dashboard --> E[Dashboard shows interview modal]
    E --> F[Human answers questions in UI]
    F --> G[Dashboard PUTs issue\nsets needs_interview=false]
    D --> H[Next auto run: triage skips\nplan picks up GROOMED issue]
    G --> H
```

## Questions Format

Questions are appended as a dedicated section in the issue body:

```markdown
## Interview Questions

Please answer the following questions to clarify requirements:

1. What authentication method should be used?
2. Should sessions be persistent across browser restarts?

---
```

## Triage Prompt

The `PROMPT_triage.md` template instructs Claude to:
- Read the issue title and body
- Determine if requirements are clear enough to plan
- Return JSON with `needs_interview` and optional `questions`

## Key Files

| File | Purpose |
|------|---------|
| `triage/triage.ts` | `triageIssue` entry point |
| `triage/parse.ts` | `parseTriageResponse`, `formatQuestionsSection` |
| `prompts/PROMPT_triage.md` | embedded triage prompt template |
