[**barf**](README.md)

***

[barf](modules.md) / Verification

# Verification

Verification formatting — markdown body generation for fix sub-issues.

When verification fails, barf creates a child issue containing the failure
details. This module formats those details into a structured markdown body
with code-fenced output sections and acceptance criteria checkboxes.

## Verification

### buildFixBody()

> **buildFixBody**(`issueId`, `failures`): `string`

Defined in: src/core/verification/format.ts:24

Builds the markdown body for a fix sub-issue from verification failures.

Each failure becomes a `### checkName` section with code-fenced stdout/stderr.
The body includes context about why the fix issue was created and standard
acceptance criteria that the fix must satisfy.

#### Parameters

##### issueId

`string`

ID of the parent issue whose verification failed.

##### failures

`object`[]

List of failed verification checks with their output.

#### Returns

`string`

Markdown body string ready for the fix sub-issue.
