# Split Phase — Issue $BARF_ISSUE_ID

The context window is nearly full. Split issue **$BARF_ISSUE_ID** into smaller child issues.

## Context

- Issue file: `$BARF_ISSUE_FILE`
- Implementation plan: `$PLAN_DIR/$BARF_ISSUE_ID.md`

## Instructions

1. Review the original issue and identify logical sub-tasks that can be completed independently
2. Create child issue files in `$ISSUES_DIR/`:
   - Names: `$BARF_ISSUE_ID-1.md`, `$BARF_ISSUE_ID-2.md`, etc.
   - Each child must have complete frontmatter:
     ```
     ---
     id=$BARF_ISSUE_ID-1
     title=<descriptive title>
     state=NEW
     parent=$BARF_ISSUE_ID
     children=
     split_count=0
     ---
     ```
3. Update the parent issue:
   - Set `children=$BARF_ISSUE_ID-1,$BARF_ISSUE_ID-2,...`
   - Set `state=SPLIT`
4. Commit all changes
