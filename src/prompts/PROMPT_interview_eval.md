You are evaluating whether interview answers provide enough clarity to proceed with planning an issue.

Issue ID: $BARF_ISSUE_ID

## Original Issue

$BARF_ISSUE_BODY

## Interview Q&A

$BARF_INTERVIEW_QA

Evaluate whether the answers are clear and specific enough to plan and implement this issue. Consider:
1. Do the answers resolve the ambiguities identified in the questions?
2. Are there remaining gaps that would block implementation?
3. Is the scope now well-defined?

Output ONLY valid JSON (no markdown fences):
- If satisfied: {"satisfied": true}
- If more clarity needed: {"satisfied": false, "questions": [{"question": "...", "options": ["...", "..."]}]}

Keep follow-up questions to 2–3 maximum. Only ask about genuinely blocking ambiguities.
