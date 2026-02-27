# Triage System

**Source:** `src/core/triage/`

Triage is a one-shot Claude evaluation of NEW issues. It determines whether an issue has enough information to plan immediately, or needs clarifying questions first.

## Flow

```mermaid
flowchart TD
    A([triageIssue]) --> AA{needs_interview\nalready set?}
    AA -- yes --> AB([skip — already triaged])
    AA -- no --> B[Fetch issue — must be NEW]
    B --> C[Resolve PROMPT_triage.md\ninject issue path + id]
    C --> D["Call claude CLI subprocess\n--model triageModel\n--output-format json"]
    D --> E[parseTriageResponse]
    E --> F{needs_interview?}
    F -- false --> G[Set needs_interview=false\nTransition NEW → GROOMED]
    F -- true --> H[Set needs_interview=true\nAppend questions to body]
    G --> I[Persist issue]
    H --> I
    I --> J([done])
```

## Why CLI Subprocess?

Triage uses `claude -p <prompt> --model <model> --output-format json` instead of the Claude Agent SDK. This is deliberate:
- One-shot call (no multi-turn iteration needed)
- Simpler — no stream consumer, no token tracking, no overflow handling
- Fast startup — haiku model completes in <10 seconds

## Output

Claude returns JSON. `parseTriageResponse()` handles common edge cases (markdown fences, surrounding prose):

```json
{ "needs_interview": false }

{
  "needs_interview": true,
  "questions": [
    { "question": "What authentication method should be used?", "options": ["JWT", "OAuth2"] },
    { "question": "Should sessions persist across browser restarts?" }
  ]
}
```

## needs_interview Flag

```
undefined   issue hasn't been triaged yet (triage will run)
false       ready to plan — no clarification needed
true        questions appended to issue body, waits for human answers
```

In `auto` mode, triage runs on all NEW issues where `needs_interview === undefined`. Issues with `needs_interview=true` are skipped for planning — they need interview answers first.

## Interview Flow

When triage sets `needs_interview=true`:

```mermaid
flowchart TD
    A["Issue: needs_interview=true\nquestions appended to body"] --> B{How to answer?}
    B -- "CLI / file" --> C[Human edits issue markdown\nanswers questions inline]
    C --> D[Set needs_interview=false manually\nor re-run triage]
    B -- "/barf-interview" --> E[Claude Code slash command\ninteractive Q&A]
    E --> F["interview_eval prompt evaluates\nmay ask 2-3 follow-ups"]
    F --> G{Satisfied?}
    G -- yes --> H[Set needs_interview=false\nTransition to GROOMED]
    G -- no --> F
    B -- Dashboard --> I[Interview modal in web UI\nWebSocket subprocess]
    I --> J["Server evaluates via\ninterview_eval prompt"]
    J --> H
    D --> K[Next auto run picks up GROOMED issue]
    H --> K
```

## Questions Format

Questions are appended as a dedicated section in the issue body by `formatQuestionsSection()`:

```markdown
## Interview Questions

1. What authentication method should be used?
   - JWT
   - OAuth2
2. Should sessions persist across browser restarts?
```

## Key Files

| File | Purpose |
|------|---------|
| `triage/triage.ts` | `triageIssue()` entry point |
| `triage/parse.ts` | `parseTriageResponse()`, `formatQuestionsSection()` |
| `prompts/PROMPT_triage.md` | Triage prompt template |
| `prompts/PROMPT_interview.md` | Interactive interview prompt (planned, not yet integrated) |
| `prompts/PROMPT_interview_eval.md` | Interview answer evaluation prompt |
