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

If you find issues: create a new issue file at $ISSUES_DIR/audit-$BARF_ISSUE_ID.md with:
  - Frontmatter: state=NEW, parent=$BARF_ISSUE_ID, title=Audit findings: <original title>
  - Body: detailed findings organized by category (failing checks, unmet criteria, rule violations)

If everything passes: output exactly this line with no surrounding text:

AUDIT_PASS
