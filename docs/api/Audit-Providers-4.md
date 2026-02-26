[**barf**](README.md)

***

[barf](modules.md) / Audit Providers

# Audit Providers

## Functions

### createAuditProvider()

> **createAuditProvider**(`config`): [`AuditProvider`](Audit-Providers.md#abstract-auditprovider)

Defined in: src/providers/index.ts:30

Creates the configured [AuditProvider](Audit-Providers.md#abstract-auditprovider) implementation.

Reads `config.auditProvider` to select the provider. Defaults to OpenAI.
To add a new provider, create a class extending [AuditProvider](Audit-Providers.md#abstract-auditprovider) and add a case here.

#### Parameters

##### config

Loaded barf configuration.

###### anthropicApiKey

`string` = `...`

Anthropic API key for the Claude audit provider.

###### auditModel

`string` = `...`

Model used for audit provider calls.

###### auditProvider

`"openai"` \| `"gemini"` \| `"claude"` \| `"codex"` = `...`

Which audit provider to use for code review.

###### barfDir

`string` = `...`

Directory for barf internal state (lock files, etc.).

###### buildModel

`string` = `...`

Model used for build mode iterations.

###### claudeAuditModel

`string` = `...`

Model used by the Claude audit provider.

###### claudeTimeout

`number` = `...`

Timeout in seconds for each Claude iteration.

###### contextUsagePercent

`number` = `...`

Percentage of context window to use before triggering overflow (split/escalate).

###### extendedContextModel

`string` = `...`

Model used when escalating past maxAutoSplits (larger context window).

###### fixCommands

`string`[] = `...`

Shell commands to run as fix steps before the test gate (best-effort, failures don't block).

###### geminiApiKey

`string` = `...`

Google Gemini API key for the Gemini audit provider.

###### geminiModel

`string` = `...`

Gemini model identifier for the Gemini audit provider.

###### githubRepo

`string` = `...`

GitHub repository slug (owner/repo) for the GitHub issue provider.

###### issueProvider

`"local"` \| `"github"` = `...`

Issue storage backend: local filesystem or GitHub Issues.

###### issuesDir

`string` = `...`

Directory where issue markdown files are stored. Relative to project root.

###### logFile

`string` = `...`

Path to the pino log file.

###### logLevel

`string` = `...`

Pino log level (trace, debug, info, warn, error, fatal).

###### logPretty

`boolean` = `...`

Enable pretty-printed log output (for development).

###### maxAutoSplits

`number` = `...`

Maximum number of automatic splits before escalating to extended context model.

###### maxIterations

`number` = `...`

Maximum Claude iterations per run. 0 means unlimited.

###### maxVerifyRetries

`number` = `...`

Maximum verification retry attempts before marking issue as verify_exhausted.

###### openaiApiKey

`string` = `...`

OpenAI API key for the OpenAI audit provider.

###### planDir

`string` = `...`

Directory where plan files are written by the plan mode.

###### planModel

`string` = `...`

Model used for plan mode iterations.

###### promptDir

`string` = `...`

Directory for custom prompt templates. Empty string uses built-in prompts.

###### pushStrategy

`"iteration"` \| `"on_complete"` \| `"manual"` = `...`

When to push commits: after each iteration, on completion, or manually.

###### splitModel

`string` = `...`

Model used for split mode iterations (after overflow).

###### streamLogDir

`string` = `...`

Directory for raw JSONL stream logs. Empty string disables logging.

###### testCommand

`string` = `...`

Shell command to run as the test gate during pre-completion checks. Empty string to skip.

###### triageModel

`string` = `...`

Model used for triage one-shot calls.

#### Returns

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider)

The appropriate [AuditProvider](Audit-Providers.md#abstract-auditprovider) instance.

## References

### AuditProvider

Re-exports [AuditProvider](Audit-Providers.md#abstract-auditprovider)

***

### ChatOptions

Re-exports [ChatOptions](types/schema/provider-schema.md#chatoptions)

***

### ChatResult

Re-exports [ChatResult](types/schema/provider-schema.md#chatresult)

***

### ClaudeAuditProvider

Re-exports [ClaudeAuditProvider](Audit-Providers-1.md#claudeauditprovider)

***

### CodexAuditProvider

Re-exports [CodexAuditProvider](Audit-Providers-2.md#codexauditprovider)

***

### GeminiAuditProvider

Re-exports [GeminiAuditProvider](Audit-Providers-3.md#geminiauditprovider)

***

### OpenAIAuditProvider

Re-exports [OpenAIAuditProvider](Audit-Providers-6.md#openaiauditprovider)

***

### PingResult

Re-exports [PingResult](types/schema/provider-schema.md#pingresult)

***

### ProviderInfo

Re-exports [ProviderInfo](types/schema/provider-schema.md#providerinfo)
