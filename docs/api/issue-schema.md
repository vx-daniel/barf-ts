[**barf**](README.md)

***

[barf](modules.md) / issue-schema

# issue-schema

Issue model schemas — the core data structure of barf.

An issue represents a unit of work tracked by barf. Issues move through a
state machine ([IssueStateSchema](#issuestateschema)) from `NEW` to `VERIFIED`, with
side-states `STUCK` and `SPLIT` for exceptional flows.

All issue data is stored as frontmatter markdown files under `issuesDir`.
The `body` field holds everything after the closing `---` delimiter.

## Issue Model

### Issue

> **Issue** = `object`

Defined in: src/types/schema/issue-schema.ts:121

A validated barf work item. Derived from [IssueSchema](#issueschema).

#### Type Declaration

##### body

> **body**: `string`

##### children

> **children**: `string`[]

##### context\_usage\_percent?

> `optional` **context\_usage\_percent**: `number`

##### force\_split

> **force\_split**: `boolean`

##### id

> **id**: `string`

##### is\_verify\_fix?

> `optional` **is\_verify\_fix**: `boolean`

When `true`, this issue was created by `verifyIssue` to fix a parent's failures — skip re-verifying it.

##### needs\_interview?

> `optional` **needs\_interview**: `boolean`

Triage result set by `triageIssue`.
- `undefined` — not yet triaged
- `false` — triaged, no refinement needed (or interview complete)
- `true` — triaged, needs `/barf-interview` before planning

##### parent

> **parent**: `string`

##### run\_count

> **run\_count**: `number`

Number of runs/sessions executed on this issue.

##### split\_count

> **split\_count**: `number`

##### state

> **state**: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"` = `IssueStateSchema`

##### title

> **title**: `string`

##### total\_duration\_seconds

> **total\_duration\_seconds**: `number`

Cumulative wall-clock duration in seconds across all runs.

##### total\_input\_tokens

> **total\_input\_tokens**: `number`

Cumulative input tokens (base + cache) across all runs.

##### total\_iterations

> **total\_iterations**: `number`

Total iterations across all runs.

##### total\_output\_tokens

> **total\_output\_tokens**: `number`

Cumulative output tokens across all runs.

##### verify\_count

> **verify\_count**: `number`

Number of times verification has been attempted on this issue. Incremented on each failure.

##### verify\_exhausted?

> `optional` **verify\_exhausted**: `boolean`

When `true`, `verify_count` exceeded `maxVerifyRetries`; issue is left as COMPLETED without VERIFIED.

***

### IssueState

> **IssueState** = `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`

Defined in: src/types/schema/issue-schema.ts:56

A barf issue state string literal union.
Derived from [IssueStateSchema](#issuestateschema).

***

### IssueSchema

> `const` **IssueSchema**: `ZodObject`\<[`Issue`](#issue)\>

Defined in: src/types/schema/issue-schema.ts:80

A barf work item — the central data model of the system.

Stored as frontmatter markdown under `issuesDir`. The frontmatter fields
map directly to this schema's properties. The `body` field contains
everything after the closing `---` delimiter (the issue description,
acceptance criteria, session stats blocks, etc.).

Key fields for orchestration:
- `state` — current position in the [IssueStateSchema](#issuestateschema) state machine
- `split_count` — how many times this issue has been split (controls overflow decisions)
- `children` — IDs of sub-issues created by split operations
- `needs_interview` — triage flag; when `true`, issue is parked for `/barf-interview`

Key fields for observability:
- `total_input_tokens`, `total_output_tokens` — cumulative token usage across all runs
- `total_duration_seconds` — cumulative wall-clock time
- `run_count` — number of sessions executed on this issue

***

### IssueStateSchema

> `const` **IssueStateSchema**: `ZodEnum`\<[`IssueState`](#issuestate-1)\>

Defined in: src/types/schema/issue-schema.ts:39

All valid states an issue can occupy.

The state machine enforces this progression:
```
NEW → PLANNED → IN_PROGRESS → COMPLETED → VERIFIED
                    ↘                         ↑
                     STUCK ←→ SPLIT    (via fix sub-issues)
```

- `NEW` — freshly created, may need triage (`needs_interview=true`)
- `PLANNED` — a plan file exists; ready for build
- `IN_PROGRESS` — Claude is actively working on this issue
- `COMPLETED` — Claude finished; pending automated verification
- `VERIFIED` — verification passed; true terminal state
- `STUCK` — Claude hit a blocker it cannot resolve alone
- `SPLIT` — issue was too large and was broken into children

Transitions are enforced by `validateTransition` in `core/issue/index.ts` —
never mutate `issue.state` directly.
