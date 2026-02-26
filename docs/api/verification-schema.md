[**barf**](README.md)

***

[barf](modules.md) / verification-schema

# verification-schema

Verification schemas — data structures for post-completion verification checks.

After an issue reaches COMPLETED, barf runs automated verification (build,
lint, test) to confirm the work is correct before transitioning to VERIFIED.
These schemas define the check definitions and their outcomes.

## Verification

### VerifyCheck

> **VerifyCheck** = `object`

Defined in: src/types/schema/verification-schema.ts:34

A single verification check definition. Derived from [VerifyCheckSchema](#verifycheckschema).

#### Type Declaration

##### args

> **args**: `string`[]

Arguments passed to the command (e.g. `['run', 'build']`).

##### command

> **command**: `string`

Executable command to run (e.g. `'bun'`).

##### name

> **name**: `string`

Human-readable name for this check (e.g. `'build'`, `'check'`, `'test'`).

***

### VerifyFailure

> **VerifyFailure** = `object`

Defined in: src/types/schema/verification-schema.ts:60

A single verification failure record. Derived from [VerifyFailureSchema](#verifyfailureschema).

#### Type Declaration

##### check

> **check**: `string`

Name of the check that failed.

##### exitCode

> **exitCode**: `number`

Process exit code (non-zero indicates failure).

##### stderr

> **stderr**: `string`

Standard error from the failed command.

##### stdout

> **stdout**: `string`

Standard output from the failed command.

***

### VerifyResult

> **VerifyResult** = \{ `passed`: `true`; \} \| \{ `failures`: `object`[]; `passed`: `false`; \}

Defined in: src/types/schema/verification-schema.ts:84

Verification outcome. Derived from [VerifyResultSchema](#verifyresultschema).

***

### VerifyCheckSchema

> `const` **VerifyCheckSchema**: `ZodObject`\<[`VerifyCheck`](#verifycheck)\>

Defined in: src/types/schema/verification-schema.ts:20

A single verification check to run.

Each check is a command with arguments that barf executes sequentially.
The default checks mirror the `/verify` command: build → format+lint → test suite.

***

### VerifyFailureSchema

> `const` **VerifyFailureSchema**: `ZodObject`\<[`VerifyFailure`](#verifyfailure)\>

Defined in: src/types/schema/verification-schema.ts:44

Result of a single failed verification check.

Captures the check name, stdout/stderr output, and exit code so that
fix sub-issues can include detailed failure information in their body.

***

### VerifyResultSchema

> `const` **VerifyResultSchema**: `ZodDiscriminatedUnion`\<[`VerifyResult`](#verifyresult)\>

Defined in: src/types/schema/verification-schema.ts:71

Outcome of running all verification checks.

Uses a discriminated union on the `passed` field:
- `{ passed: true }` — all checks succeeded, issue can transition to VERIFIED
- `{ passed: false, failures }` — one or more checks failed, with details
