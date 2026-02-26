# Product Requirements Document: barf

**Version**: 2.0.0
**Last Updated**: 2026-02-25
**Status**: Active Development

## Executive Summary

**barf** (Backlog AI Resolution Framework) is a TypeScript CLI tool that orchestrates Claude AI agent work on project backlogs. It manages the full lifecycle of issue resolution—from triage and planning through implementation and verification—while automatically handling context overflow, state transitions, and quality validation.

**Core Value Proposition**: Enable developers to systematically work through backlogs using Claude AI while maintaining quality standards, reducing context management overhead, and ensuring completed work is verified before deployment.

---

## Problem Statement

### Current Pain Points

1. **Manual Context Management**: Developers must manually track when Claude approaches context limits, interrupting productive flow
2. **State Tracking Overhead**: No systematic way to track which issues are planned, in-progress, or completed across multiple Claude sessions
3. **Quality Assurance Gaps**: Completed work may not be verified against acceptance criteria or tested before integration
4. **Batch Processing Challenges**: No efficient way to queue and process multiple issues sequentially with AI assistance
5. **Context Overflow Failures**: Large issues cause Claude to hit context limits without automatic mitigation strategies

### Why This Matters

- **Developer Time**: Manual orchestration of AI-assisted development wastes 30-50% of time on overhead vs. actual implementation
- **Quality Risk**: Unverified AI-generated code introduces bugs and technical debt
- **Scalability**: Teams cannot systematically leverage AI for backlog reduction without process overhead
- **Predictability**: No reliable workflow for consistent AI-assisted issue resolution

---

## Goals & Objectives

### Primary Goals

1. **Automate AI Orchestration**: Reduce manual overhead of managing Claude sessions for issue resolution
2. **Ensure Quality**: Verify all completed work passes build, lint, and test suites before marking as done
3. **Handle Context Gracefully**: Automatically split issues or escalate to larger models when context limits approach
4. **Enable Batch Processing**: Allow unattended processing of multiple issues with automatic state tracking
5. **Maintain Traceability**: Preserve full audit trail of plan → implementation → verification for each issue

### Success Criteria

- ✅ Developers can queue issues and leave barf to process them autonomously
- ✅ >95% of completed issues pass verification on first attempt
- ✅ Context overflow handled without manual intervention
- ✅ Full state visibility: developers know which issues are planned, in-progress, verified
- ✅ Support both local file-based and GitHub Issues workflows

---

## User Personas

### Primary Persona: Solo Developer

**Name**: Alex (Indie Developer)
**Context**: Maintaining 2-3 open-source projects with growing backlogs
**Pain**: Can't keep up with issues; wants AI help but finds manual Claude sessions tedious
**Needs**:
- Queue issues for automated planning and implementation
- Verify work is actually done before closing issues
- Minimal setup and configuration

**Usage Pattern**:
```bash
barf init
# Add issues to issues/ directory
barf auto --batch 3  # Process 3 issues concurrently
```

### Secondary Persona: Small Team Lead

**Name**: Jordan (Team Lead, 3-5 developers)
**Context**: Managing GitHub Issues for a commercial product
**Pain**: Wants AI to handle routine issues so team can focus on complex work
**Needs**:
- GitHub Issues integration (no separate issue tracking)
- Quality gates (build/test must pass)
- Audit trail for compliance

**Usage Pattern**:
```bash
barf init --provider github --repo myorg/product
barf auto  # Processes GitHub issues with barf:new label
barf audit --all  # Review completed work
```

---

## Use Cases

### UC-1: Automated Backlog Processing

**Actor**: Developer
**Trigger**: Developer has 10+ issues ready for implementation
**Flow**:
1. Developer creates issues in `issues/` directory with acceptance criteria
2. Runs `barf auto`
3. barf triages issues, writes plans, implements features, verifies results
4. Developer reviews verified issues and merges changes

**Success Outcome**: 80%+ of issues complete verification without manual intervention

### UC-2: Context Overflow Handling

**Actor**: System
**Trigger**: Claude context usage exceeds `CONTEXT_USAGE_PERCENT` threshold
**Flow**:
1. barf detects context at 75% (configurable)
2. If `split_count < MAX_AUTO_SPLITS`: runs split prompt, creates child issues
3. Else: escalates to `EXTENDED_CONTEXT_MODEL` (e.g., claude-opus-4-6)
4. Continues processing without user intervention

**Success Outcome**: Large refactors complete without manual session restarts

### UC-3: Failed Verification Recovery

**Actor**: System
**Trigger**: Completed issue fails `bun run build`, `bun run check`, or `bun test`
**Flow**:
1. barf runs verification commands after Claude marks issue complete
2. On failure: creates fix sub-issue with error output
3. Claude attempts fix (up to `MAX_VERIFY_RETRIES` times)
4. If all retries exhausted: issue stays `COMPLETED` (not `VERIFIED`), logs failure

**Success Outcome**: Most verification failures self-heal; persistent failures flagged for manual review

### UC-4: GitHub Issues Workflow

**Actor**: Team using GitHub Issues
**Trigger**: Developer wants to process GitHub issues with AI
**Flow**:
1. Run `barf init --provider github --repo owner/repo`
2. barf creates `barf:new`, `barf:planned`, etc. labels
3. Tag issues with `barf:new`
4. Run `barf auto`
5. barf processes issues, updates labels, writes plans to repo

**Success Outcome**: Team workflow stays in GitHub; no separate issue tracker needed

---

## Features & Requirements

### Core Features

#### F-1: Issue State Machine

**Priority**: P0 (Must Have)
**Description**: Validated state transitions prevent invalid states

**States**:
- `NEW` → `PLANNED` → `IN_PROGRESS` → `COMPLETED` → `VERIFIED`
- Side-states: `STUCK`, `SPLIT` (terminal)

**Acceptance Criteria**:
- State transitions validated against `VALID_TRANSITIONS` map
- Invalid transitions rejected with clear error messages
- `needs_interview` flag orthogonal to state (set by triage)

#### F-2: Automated Triage

**Priority**: P0 (Must Have)
**Description**: Fast Claude call evaluates if issue has clear requirements

**Behavior**:
- Uses `TRIAGE_MODEL` (claude-haiku-4-5 for speed/cost)
- Sets `needs_interview=false` if requirements clear → auto-proceeds to planning
- Sets `needs_interview=true` + appends questions to issue body if under-specified
- Developer runs `/barf-interview` Claude Code skill to answer questions before planning

**Acceptance Criteria**:
- Triage completes in <10 seconds per issue
- Clear issues proceed to planning without delay
- Under-specified issues blocked until interview completes

#### F-3: Automated Planning

**Priority**: P0 (Must Have)
**Description**: Claude explores codebase and writes implementation plan

**Behavior**:
- Reads issue + acceptance criteria
- Uses Glob/Grep to explore relevant code
- Writes plan to `PLAN_DIR/{issueId}.md`
- Transitions `NEW → PLANNED`

**Acceptance Criteria**:
- Plan references specific files and line numbers
- Plan includes step-by-step implementation strategy
- Plan considers existing patterns and conventions

#### F-4: Automated Build

**Priority**: P0 (Must Have)
**Description**: Claude implements plan, checking acceptance criteria between iterations

**Behavior**:
- Reads plan file
- Implements changes iteratively
- Checks acceptance criteria after each iteration
- Transitions `PLANNED → IN_PROGRESS → COMPLETED` when all criteria met

**Acceptance Criteria**:
- Acceptance criteria checkboxes (`- [ ]`) tracked
- Issue marked `COMPLETED` only when all become `- [x]`
- Max iterations configurable via `MAX_ITERATIONS`

#### F-5: Automated Verification

**Priority**: P0 (Must Have)
**Description**: Run build, lint, and tests after completion; fix or fail

**Behavior**:
- After `COMPLETED`, runs `bun run build`, `bun run check`, `bun test`
- If all pass: `COMPLETED → VERIFIED`
- If any fail: creates fix sub-issue, retries up to `MAX_VERIFY_RETRIES`
- If retries exhausted: stays `COMPLETED`, logs failure

**Acceptance Criteria**:
- Verification runs after every completion
- Fix sub-issues include full error output
- Retry limit prevents infinite loops

#### F-6: Context Overflow Mitigation

**Priority**: P0 (Must Have)
**Description**: Automatically split or escalate when context fills

**Strategy**:
```
if context_usage >= CONTEXT_USAGE_PERCENT:
  if split_count < MAX_AUTO_SPLITS:
    run split prompt → create child issues
  else:
    switch to EXTENDED_CONTEXT_MODEL → continue
```

**Acceptance Criteria**:
- Context monitoring via async iterator on Claude stdout stream
- Split prompt decomposes issue into well-defined children
- Escalation preserves full conversation context

#### F-7: Provider Abstraction

**Priority**: P1 (Should Have)
**Description**: Pluggable backends for issue storage

**Providers**:
- **Local**: Frontmatter markdown files in `ISSUES_DIR` (POSIX mkdir locking)
- **GitHub**: GitHub Issues via `gh` CLI (label-based locking)

**Acceptance Criteria**:
- `IssueProvider` interface with `list()`, `load()`, `save()`, `lock()`, `unlock()`
- Factory pattern selects provider from `ISSUE_PROVIDER` config
- Adding new provider requires only implementing interface

#### F-8: AI Audit

**Priority**: P2 (Nice to Have)
**Description**: External AI reviews completed work for quality/compliance

**Behavior**:
- Uses `AUDIT_PROVIDER` (openai | gemini | claude)
- Reads completed issue + plan + changes
- Validates against project rules (`.claude/rules/*.md`)
- Outputs structured audit report (Zod schema)

**Acceptance Criteria**:
- Audit results include severity, category, affected files
- Reports saved to audit log for compliance tracking
- Configurable per-provider models

### Non-Functional Requirements

#### NFR-1: Reliability

- **Subprocess Isolation**: Claude runs in subprocess; crashes don't kill barf
- **Locking**: POSIX mkdir locking (local) or label-based (GitHub) prevents concurrent access
- **Timeouts**: `CLAUDE_TIMEOUT` kills hung processes
- **Error Handling**: All I/O returns `Result`/`ResultAsync`; no thrown errors except CLI boundary

#### NFR-2: Observability

- **Structured Logging**: Pino JSON to stderr + log file
- **Stream Logging**: Optional raw Claude output to `STREAM_LOG_DIR/{issueId}.jsonl`
- **State Visibility**: `barf status` shows all issues + current state
- **Context Tracking**: `context_usage_percent` field on each issue

#### NFR-3: Performance

- **Batch Builds**: `--batch N` runs N issues concurrently (default: 1)
- **Fast Triage**: Haiku model completes triage in <10s per issue
- **Incremental Planning**: Plan files prevent re-planning on retry

#### NFR-4: Security

- **Shell Injection Prevention**: `execFileNoThrow` uses spawn, not shell execution
- **Secret Management**: API keys in `.barfrc`, not committed to git
- **Validation**: All external input validated via Zod schemas

---

## Technical Architecture

### System Components

```mermaid
graph TB
    CLI[CLI Entry<br/>commander] --> Commands[Commands]
    Commands --> Core[Core Orchestration]

    Core --> Issue[Issue Management]
    Core --> Claude[Claude Subprocess]
    Core --> Batch[Batch Orchestration]
    Core --> Verify[Verification]
    Core --> Audit[Audit]

    Issue --> Provider[Issue Provider]
    Provider --> Local[Local FS Provider]
    Provider --> GitHub[GitHub Provider]

    Claude --> Context[Context Monitoring]
    Claude --> Prompts[Prompt Templates]

    Batch --> Triage[Triage Loop]
    Batch --> Plan[Plan Loop]
    Batch --> Build[Build Loop]

    Verify --> Tests[Run Tests]
    Verify --> SubIssue[Create Fix Sub-Issue]

    Audit --> OpenAI[OpenAI API]
    Audit --> Gemini[Gemini API]
    Audit --> ClaudeAPI[Claude API]
```

### Key Design Decisions

#### State Machine Enforcement

**Decision**: All state transitions validated through `validateTransition()`
**Rationale**: Bash version had bugs from unchecked state mutations
**Trade-off**: Slightly more verbose, but eliminates entire class of bugs

#### No Global State

**Decision**: Pass `Issue` objects as function arguments; no global `ISSUE_ID`/`STATE`
**Rationale**: Bash globals caused race conditions in concurrent execution
**Trade-off**: More parameter passing, but thread-safe and testable

#### neverthrow for Error Handling

**Decision**: All I/O returns `Result<T, E>` or `ResultAsync<T, E>`
**Rationale**: Explicit error handling without exceptions; railway-oriented programming
**Trade-off**: More verbose than try/catch, but errors visible in types

#### Async Stream Parsing

**Decision**: Monitor Claude stdout stream for context usage via async iterator
**Rationale**: Real-time detection without polling or hooks
**Trade-off**: More complex than post-execution parsing, but catches overflow mid-conversation

#### Frontmatter Markdown for Issues

**Decision**: `KEY=VALUE` frontmatter + markdown body
**Rationale**: Git-trackable, human-readable, no DB setup
**Trade-off**: No relational queries, but sufficient for single-agent use

---

## Configuration

### .barfrc Schema

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ISSUE_PROVIDER` | `local \| github` | `local` | Issue storage backend |
| `GITHUB_REPO` | `owner/repo` | — | Required when `ISSUE_PROVIDER=github` |
| `BARF_DIR` | path | `.barf` | Internal state directory |
| `ISSUES_DIR` | path | `issues` | Issue file directory (local provider) |
| `PLAN_DIR` | path | `plans` | Plan file directory |
| `TRIAGE_MODEL` | model | `claude-haiku-4-5` | Triage model (fast/cheap) |
| `PLAN_MODEL` | model | `claude-opus-4-6` | Planning model |
| `BUILD_MODEL` | model | `claude-sonnet-4-6` | Build model |
| `SPLIT_MODEL` | model | `claude-sonnet-4-6` | Split model |
| `EXTENDED_CONTEXT_MODEL` | model | `claude-opus-4-6` | Escalation model |
| `AUDIT_PROVIDER` | `openai \| gemini \| claude` | `openai` | Audit AI provider |
| `AUDIT_MODEL` | model | `gpt-4o` | Provider-specific audit model |
| `CONTEXT_USAGE_PERCENT` | 1-100 | `75` | Context threshold for overflow action |
| `MAX_AUTO_SPLITS` | int | `3` | Max splits before escalation |
| `MAX_VERIFY_RETRIES` | int | `3` | Max verification fix attempts |
| `MAX_ITERATIONS` | int | `0` | Max build iterations (0 = unlimited) |
| `CLAUDE_TIMEOUT` | seconds | `3600` | Claude subprocess timeout |
| `TEST_COMMAND` | shell | — | Run after each build iteration |
| `PUSH_STRATEGY` | `iteration \| on_complete \| manual` | `iteration` | When to git push |
| `PROMPT_DIR` | path | — | Custom prompt template directory |
| `STREAM_LOG_DIR` | path | — | Raw Claude output logging |

### Environment Variables

- `OPENAI_API_KEY`: OpenAI API key (when `AUDIT_PROVIDER=openai`)
- `GEMINI_API_KEY`: Google Gemini API key (when `AUDIT_PROVIDER=gemini`)
- `ANTHROPIC_API_KEY`: Anthropic API key (when `AUDIT_PROVIDER=claude`)
- `LOG_LEVEL`: Pino log level (`debug`, `info`, `warn`, `error`)
- `LOG_PRETTY`: Set to `1` for human-readable logs (dev only)

---

## Success Metrics

### Quantitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Verification Pass Rate** | >95% | % of `COMPLETED` issues that reach `VERIFIED` without manual fixes |
| **Context Overflow Success** | 100% | % of overflow events handled without manual intervention |
| **Triage Accuracy** | >90% | % of triaged issues that successfully complete planning |
| **Build Success Rate** | >80% | % of planned issues that reach `COMPLETED` |
| **Concurrent Batch Throughput** | 3x | Speed improvement of `--batch 3` vs `--batch 1` |

### Qualitative Metrics

- **Developer Confidence**: Survey developers on trust in auto-verified work
- **Setup Friction**: Measure time from `barf init` to first successful auto run
- **Error Clarity**: User feedback on error message helpfulness

---

## Future Roadmap

### Phase 2 (Q2 2026)

- [ ] **Multi-Agent Locking**: Support concurrent `barf auto` processes on different issues
- [ ] **GitLab/Linear Providers**: Add provider implementations for GitLab Issues, Linear
- [ ] **Streaming UI**: Real-time TUI for monitoring concurrent builds
- [ ] **Custom Audit Rules**: Per-project audit rulesets beyond global `.claude/rules/*.md`

### Phase 3 (Q3 2026)

- [ ] **Team Workflows**: Issue assignment, review queues, approval gates
- [ ] **Metrics Dashboard**: Web UI for tracking verification rates, common failures
- [ ] **Plugin System**: Extensible hooks for custom pre/post-build logic
- [ ] **Cloud Sync**: Optional cloud backend for cross-machine issue state

### Research & Exploration

- **Agentic Code Review**: Auto-review sub-agent before verification
- **Smart Batching**: ML-based issue batching for optimal concurrency
- **Cost Optimization**: Automatic model selection based on issue complexity
- **Rollback on Verification Failure**: Auto-revert changes if verification fails N times

---

## Appendix

### Glossary

- **Issue**: Unit of work with frontmatter metadata + markdown body
- **Plan**: Implementation strategy written by Claude before build phase
- **Acceptance Criteria**: Checklist in issue body defining "done"
- **Verification**: Automated build/lint/test run after completion
- **Triage**: Fast AI evaluation of issue clarity
- **Split**: Decomposition of large issue into child issues
- **Escalation**: Switch to larger context model when splits exhausted
- **Provider**: Pluggable backend for issue storage (local, GitHub, etc.)

### References

- [Bun](https://bun.sh) — JavaScript runtime and toolkit
- [Claude CLI](https://claude.ai/download) — Anthropic Claude command-line interface
- [neverthrow](https://github.com/supermacro/neverthrow) — Type-safe error handling
- [Zod 4](https://zod.dev) — TypeScript-first schema validation

---

**Document Owner**: Daniel
**Last Review**: 2026-02-25
**Next Review**: 2026-03-25
