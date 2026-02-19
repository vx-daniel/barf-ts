# Plan: Add TypeDoc Comment Requirements to hard-requirements.md

## Context

The codebase uses TypeDoc for API documentation generation (`bun run docs`) with plugins for Zod, Mermaid, and MDN links. Core modules (issue.ts, batch.ts, claude.ts, context.ts, base.ts) already have strong JSDoc comments, but there's no **enforced rule** requiring them. This plan adds a non-negotiable TypeDoc section to `.claude/rules/hard-requirements.md` that codifies the patterns already in use.

## What Exists Already

From codebase exploration (`docs/plans/05-typedoc-and-jsdoc.md` was already a plan, meaning this has been worked on):

- `typedoc.json` with `validation: { notExported: true, invalidLink: true }` — TypeDoc already validates links
- Existing good patterns: `{@link}` inline references, `@param` for non-obvious args, `@returns` for `Result`/`ResultAsync`, narrative descriptions explaining WHY not just WHAT
- **Not used**: `@example`, `@throws` (codebase uses neverthrow, so no thrown errors)
- Undocumented areas: CLI commands (`src/cli/commands/`), factory module

## Plan

### File to modify

`.claude/rules/hard-requirements.md`

### Insertion point

Add a new `## TypeDoc Comments` section before the existing `## Violation Response` section.

### Section content

The section follows the established pattern (Rule → Enforcement → CORRECT/WRONG examples):

**Rules to enforce:**
1. All exported symbols must have a block comment (`/** */`)
2. `@param` required when the parameter's purpose is non-obvious from name + type
3. `@returns` required for `Result`/`ResultAsync` return types (document both arms)
4. `{@link}` for cross-references to related types/functions in this codebase
5. Comments explain WHY/context, not just restate the signature

**`@example` required on abstract methods** (e.g., `IssueProvider` abstract methods) to show call-site usage. Optional elsewhere.

**Explicitly NOT required:**
- `@throws` (no thrown errors — neverthrow pattern)
- `@internal` markers

## Verification

After editing:
1. Read the file to confirm the section renders correctly
2. Confirm it appears before `## Violation Response`
3. No build/format changes needed — this is a markdown rules file

## Post-implementation

Per CLAUDE.md convention, rename this plan file:
```
docs/plans/ancient-frolicking-babbage.md → docs/plans/13-typedoc-comment-requirements.md
```
