[**barf**](README.md)

***

[barf](modules.md) / Verification

# Verification

Verification checks — runs build/lint/test commands and collects results.

This module contains the pure verification runner that executes checks
sequentially and collects all failures before returning. It never throws —
verification failures are represented as data in the return value.

## Other

### ExecFn()

> **ExecFn** = (`file`, `args?`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](types/schema/exec-schema.md#execresult)\>

Defined in: src/core/verification/checks.ts:18

Injectable subprocess function — mirrors [execFileNoThrow](Utilities.md#execfilenothrow)'s signature.

#### Parameters

##### file

`string`

##### args?

`string`[]

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](types/schema/exec-schema.md#execresult)\>

***

### VerifyCheck

Re-exports [VerifyCheck](verification-schema.md#verifycheck)

***

### VerifyFailure

Re-exports [VerifyFailure](verification-schema.md#verifyfailure)

***

### VerifyResult

Re-exports [VerifyResult](verification-schema.md#verifyresult)

## Verification

### DEFAULT\_VERIFY\_CHECKS

> `const` **DEFAULT\_VERIFY\_CHECKS**: [`VerifyCheck`](verification-schema.md#verifycheck)[]

Defined in: src/core/verification/checks.ts:31

Default checks mirroring the `/verify` command:
build → format+lint → test suite.

These are the standard verification steps that every barf issue must pass
before it can transition from COMPLETED to VERIFIED.

***

### runVerification()

> **runVerification**(`checks?`, `execFn?`): [`ResultAsync`](#)\<\{ `passed`: `true`; \} \| \{ `failures`: `object`[]; `passed`: `false`; \}, `never`\>

Defined in: src/core/verification/checks.ts:50

Runs each check sequentially, collecting all failures before returning.

Never throws — verification failures are represented in the returned value.
This makes the function safe to call without try/catch; the caller can
inspect the result to decide what to do next.

#### Parameters

##### checks?

`object`[] = `DEFAULT_VERIFY_CHECKS`

List of checks to run; defaults to [DEFAULT\_VERIFY\_CHECKS](#default_verify_checks).

##### execFn?

[`ExecFn`](#execfn) = `execFileNoThrow`

Injectable shell executor (real or mock).

#### Returns

[`ResultAsync`](#)\<\{ `passed`: `true`; \} \| \{ `failures`: `object`[]; `passed`: `false`; \}, `never`\>

`ok({ passed: true })` when all checks pass,
  `ok({ passed: false, failures })` when one or more fail.
