Scan all barf issues that need interviews and conduct them interactively.

## Steps

1. **Find `.barfrc`**: Search in the current working directory and parent directories for `.barfrc`. Read it and find the `ISSUES_DIR` key (maps to the local `issuesDir` — defaults to `issues/` if not set).

2. **Glob issue files**: Find all `*.md` files in the issues directory.

3. **Filter**: Read each file and select those with `needs_interview=true` in the frontmatter (between `---` delimiters at the top of the file).

4. **If none found**: Report "No issues need interviews." and stop.

5. **For each flagged issue** (process one at a time):

   a. Parse the `## Interview Questions` section from the issue body — it contains a numbered list of questions. Each question may have sub-bullets starting with `- ` that are the answer options.

   b. Collect all questions from this issue and use `AskUserQuestion` to present them all at once (batch all questions for one issue into a single call with one question-per-item in the `questions` array). Map each question's sub-bullet options to the `options` array for that question item.

   c. Write a `## Interview Q&A` section to the issue file. Format each entry as:
      ```
      **Q: <question>**
      A: <answer>
      ```
      Separate pairs with a blank line. Append this section at the end of the issue body (after removing `## Interview Questions`).

   d. Remove the `## Interview Questions` section from the issue body entirely.

   e. In the frontmatter, replace `needs_interview=true` with `needs_interview=false` and replace `state=STUCK` with `state=NEW` (so the issue re-enters the pipeline).

   f. Write the updated file and confirm: "Updated issue {id}: {title}"

6. **Summary**: "Refined {N} issue(s). Run `barf auto` to proceed with planning."

## Notes

- Preserve all other frontmatter fields exactly as-is when writing.
- The frontmatter is the content between the first two `---` lines.
- Do not modify any issue files that don't have `needs_interview=true`.
- If an issue has `needs_interview=true` but no `## Interview Questions` section, ask the user: "Issue {id} needs interview but has no questions — skip?" and skip if confirmed.
