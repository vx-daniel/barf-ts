You are auditing the completed work for issue $BARF_ISSUE_ID.

## Issue

$BARF_ISSUE_FILE

## Plan

$PLAN_FILE

## Automated Check Results

Tests:
$TEST_RESULTS

Lint:
$LINT_RESULTS

Format:
$FORMAT_RESULTS

## Project Rules

$RULES_CONTEXT

## Your Task

1. Check all acceptance criteria checkboxes — are they all marked complete?
2. Review whether the implementation actually fulfills each criterion
3. Verify code follows the project rules above
4. Assess production readiness (error handling, security, correctness)

## Output

Respond with a single JSON object matching one of these shapes:

If everything passes:
```json
{ "pass": true }
```

If you find issues:
```json
{
  "pass": false,
  "findings": [
    {
      "category": "failing_check | unmet_criteria | rule_violation | production_readiness",
      "severity": "error | warning",
      "title": "Short description of the finding",
      "detail": "Detailed explanation of the issue and how to fix it"
    }
  ]
}
```

Categories:
- `failing_check` — a deterministic check (test, lint, format) is failing
- `unmet_criteria` — an acceptance criterion is not fulfilled
- `rule_violation` — code violates a project rule listed above
- `production_readiness` — error handling, security, or correctness concern

Respond ONLY with the JSON object. No markdown fences, no explanation outside the JSON.
