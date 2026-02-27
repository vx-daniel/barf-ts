# 061 — Save Interview Answers Incrementally

## Context

When a user leaves the interview modal before completing all rounds, their responses are lost. Answers are held only in frontend state and only written to the issue file when Claude says `satisfied=true`. If the browser closes or the user cancels mid-interview, nothing is saved.

**Goal**: After each round of interviewing (each POST to `/api/issues/{id}/interview`), persist the accumulated Q&A to the issue file so partial progress survives.

## Changes

### 1. Backend: `tools/dashboard/routes/api.ts` — `handleInterview()`

**After Claude eval, regardless of satisfied/not-satisfied**, write accumulated Q&A to the issue body:

- **Both paths** (satisfied and more_questions): append/replace a `## Interview Q&A (In Progress)` section with answers so far
- **On satisfied**: rename section to `## Interview Q&A`, remove `## Interview Questions`, set `needs_interview=false`, transition to GROOMED (existing behavior)
- **On more_questions**: write the partial Q&A section but keep `needs_interview=true` and state as-is

Concrete changes to `handleInterview()` (lines 240-261):

```
// After line 239 (evalResult parsed), BEFORE the satisfied check:
// Always persist answers so far to the issue body
const partialQaSection = `\n\n## Interview Q&A (In Progress)\n\n${qaText}`
const bodyWithoutPartialQa = issue.body.replace(
  /\n\n## Interview Q&A \(In Progress\)\n\n[\s\S]*?(?=\n\n## |\s*$)/,
  '',
)

if (!evalResult.satisfied) {
  // Save partial answers to issue, keep state unchanged
  await svc.provider.writeIssue(id, {
    body: bodyWithoutPartialQa + partialQaSection,
  })
  return json({ status: 'more_questions', questions: evalResult.questions ?? [] })
}

// Satisfied — full update (existing logic, but also strip partial QA section)
const qaSection = `\n\n## Interview Q&A\n\n${qaText}`
const cleanBody = bodyWithoutPartialQa.replace(
  /\n\n## Interview Questions\n\n[\s\S]*$/,
  '',
)
const writeResult = await svc.provider.writeIssue(id, {
  needs_interview: false,
  state: 'GROOMED',
  body: cleanBody + qaSection,
})
```

### 2. Frontend: `tools/dashboard/frontend/components/InterviewModal.tsx`

When `more_questions` returns, **accumulate** answers instead of resetting:

- Line 150: Change `setAnswers([])` → `setAnswers(updated)` (keep previous round's answers)
- The next round's answers get appended, and the full `updated` + new answers array is sent on next submit

**Also**: on modal open, check if issue body has `## Interview Q&A (In Progress)` section and pre-populate the answers array from it, so reopening a partially-completed interview restores progress.

### 3. Frontend: Send cumulative answers

Currently only the current round's answers are sent. Change to send **all accumulated answers** across rounds. The backend already formats them all into `qaText`.

## Files to Modify

1. `tools/dashboard/routes/api.ts` — `handleInterview()` (~15 lines changed)
2. `tools/dashboard/frontend/components/InterviewModal.tsx` — answer accumulation + restore from body (~20 lines changed)

## Verification

1. Start dashboard, open an issue needing interview
2. Answer first round of questions, let Claude return `more_questions`
3. **Close the modal** — check issue file has `## Interview Q&A (In Progress)` with answers
4. **Reopen interview** — verify previous answers are restored
5. Complete the interview — verify final `## Interview Q&A` section (no "In Progress"), state=GROOMED
