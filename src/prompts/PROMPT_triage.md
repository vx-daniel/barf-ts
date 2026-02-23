You are evaluating whether an issue is well-specified enough to plan and implement without further clarification.

Issue ID: $BARF_ISSUE_ID
Issue file: $BARF_ISSUE_FILE

Read the issue file carefully. Determine:
1. Is the acceptance criteria clear and testable?
2. Are there ambiguous edge cases that would block implementation?
3. Is the scope well-defined?

Output ONLY valid JSON (no markdown fences):
- If well-specified: {"needs_interview": false}
- If underspecified: {"needs_interview": true, "questions": [{"question": "...", "options": ["...", "..."]}]}

Keep questions to 3–5 maximum. Options are optional — only include when there are distinct valid choices.
