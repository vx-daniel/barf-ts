[**barf**](README.md)

***

[barf](modules.md) / Triage

# Triage

Triage response parsing — validates and formats Claude's triage output.

Claude returns a JSON object indicating whether the issue needs an interview.
This module handles parsing that response, stripping markdown code fences,
and formatting interview questions as markdown for the issue body.

## Triage

### TriageResult

> **TriageResult** = \{ `needs_interview`: `false`; \} \| \{ `needs_interview`: `true`; `questions`: `object`[]; \}

Defined in: src/core/triage/parse.ts:40

Parsed triage result. Derived from [TriageResultSchema](#triageresultschema).

***

### TriageResultSchema

> `const` **TriageResultSchema**: `ZodUnion`\<[`TriageResult`](#triageresult)\>

Defined in: src/core/triage/parse.ts:22

JSON shape Claude must return for a triage evaluation.

Two possible outcomes:
- `{ needs_interview: false }` — issue is well-specified, ready for planning
- `{ needs_interview: true, questions: [...] }` — issue needs refinement

***

### formatQuestionsSection()

> **formatQuestionsSection**(`result`): `string`

Defined in: src/core/triage/parse.ts:53

Formats interview questions as a numbered markdown list.

Produces a `## Interview Questions` section suitable for appending
to an issue body. Each question is numbered, and optional multiple-choice
options are rendered as indented bullet points.

#### Parameters

##### result

\{ `needs_interview`: `false`; \} \| \{ `needs_interview`: `true`; `questions`: `object`[]; \} & `object`

Triage result with `needs_interview: true` and questions.

#### Returns

`string`

Markdown string starting with `\n\n## Interview Questions\n\n`.

***

### parseTriageResponse()

> **parseTriageResponse**(`stdout`): \{ `needs_interview`: `false`; \} \| \{ `needs_interview`: `true`; `questions`: `object`[]; \}

Defined in: src/core/triage/parse.ts:79

Parses Claude's raw triage response into a validated [TriageResult](#triageresult).

Handles markdown code fences that Claude sometimes wraps around JSON
despite instructions not to. Strips the fences, parses JSON, and
validates against [TriageResultSchema](#triageresultschema).

#### Parameters

##### stdout

`string`

Raw stdout from the Claude triage subprocess.

#### Returns

\{ `needs_interview`: `false`; \} \| \{ `needs_interview`: `true`; `questions`: `object`[]; \}

Validated triage result.

#### Throws

Error if the response cannot be parsed or doesn't match the schema.
