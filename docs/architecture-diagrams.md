# barf-ts Architecture Diagrams

## Issue State Machine

The core state machine governs all issue lifecycle transitions. States are validated by `VALID_TRANSITIONS` in `src/core/issue/index.ts` — direct state mutation is never permitted.

```mermaid
stateDiagram-v2
    [*] --> NEW : createIssue()

    NEW --> PLANNED : plan mode completes

    PLANNED --> IN_PROGRESS : build mode starts
    PLANNED --> STUCK : blocker detected
    PLANNED --> SPLIT : too large

    IN_PROGRESS --> COMPLETED : acceptance criteria met
    IN_PROGRESS --> STUCK : blocker detected
    IN_PROGRESS --> SPLIT : context overflow / force_split

    STUCK --> PLANNED : blocker resolved (re-plan)
    STUCK --> NEW : reset to triage
    STUCK --> SPLIT : decompose instead

    COMPLETED --> VERIFIED : verification passes

    SPLIT --> [*] : terminal (children created)
    VERIFIED --> [*] : terminal (done)
```

## Auto Command Pipeline

The `auto` command runs a continuous loop through four phases until no work remains. This is the primary orchestration entry point for hands-off operation.

```mermaid
flowchart TD
    START([barf auto]) --> TRIAGE

    subgraph TRIAGE ["Phase 1: Triage"]
        T1[List NEW issues where<br/>needs_interview = undefined]
        T2[One-shot Claude call<br/>with triage prompt]
        T3{Well-specified?}
        T4[Set needs_interview = false]
        T5[Set needs_interview = true<br/>Append interview questions]
        T1 --> T2 --> T3
        T3 -->|Yes| T4
        T3 -->|No| T5
    end

    TRIAGE --> GATE

    subgraph GATE ["Gate Check"]
        G1{Any issues need<br/>interview?}
        G2[Warn user:<br/>issues blocked pending interview]
    end
    G1 -->|Yes| G2
    G1 -->|No| PLAN

    subgraph PLAN ["Phase 2: Plan"]
        P1[List NEW issues where<br/>needs_interview ≠ true]
        P2[runLoop issueId, plan]
        P3[Claude explores codebase,<br/>writes plan file]
        P4[Transition → PLANNED]
        P1 --> P2 --> P3 --> P4
    end

    G2 --> PLAN

    PLAN --> BUILD

    subgraph BUILD ["Phase 3: Build"]
        B1[List PLANNED + IN_PROGRESS issues]
        B2[Run up to --batch concurrent builds]
        B3[runLoop issueId, build]
        B1 --> B2 --> B3
    end

    BUILD --> VERIFY

    subgraph VERIFY ["Phase 4: Verify"]
        V1[List COMPLETED issues]
        V2[Run build → check → test]
        V3{All pass?}
        V4[Transition → VERIFIED]
        V5{Retries left?}
        V6[Create fix sub-issue]
        V7[Set verify_exhausted = true]
        V1 --> V2 --> V3
        V3 -->|Yes| V4
        V3 -->|No| V5
        V5 -->|Yes| V6
        V5 -->|No| V7
    end

    VERIFY --> CHECK{Any work<br/>remaining?}
    CHECK -->|Yes| TRIAGE
    CHECK -->|No| DONE([Done])
```

## Build Loop (Single Issue)

The core iteration loop in `src/core/batch/loop.ts` drives a single issue through Claude interactions until completion or exhaustion.

```mermaid
flowchart TD
    ENTRY([runLoop issue, mode]) --> LOCK[Acquire POSIX lock]
    LOCK --> INIT[Initialize stats:<br/>model, iteration=0, tokens=0]

    INIT --> FORCE{force_split<br/>= true?}
    FORCE -->|Yes| SPLIT_NOW[Handle split completion]
    FORCE -->|No| TRANSITION

    TRANSITION --> |build mode| TRANS_IP[Transition → IN_PROGRESS]
    TRANSITION --> |plan mode| ITER_CHECK

    TRANS_IP --> ITER_CHECK

    ITER_CHECK{shouldContinue?<br/>iteration < max}
    ITER_CHECK -->|No| STATS
    ITER_CHECK -->|Yes| STATE_CHECK

    STATE_CHECK{State =<br/>COMPLETED?}
    STATE_CHECK -->|Yes| STATS
    STATE_CHECK -->|No| RESOLVE

    RESOLVE[Resolve prompt template<br/>Inject vars: ISSUE_ID, MODE, etc.]
    RESOLVE --> CLAUDE

    subgraph CLAUDE ["Claude SDK Iteration"]
        C1[query via @anthropic-ai/claude-agent-sdk]
        C2[Stream async messages]
        C3[Track token usage]
        C4{Tokens ><br/>threshold?}
        C5[ContextOverflowError]
        C6[Return outcome]
        C1 --> C2 --> C3 --> C4
        C4 -->|Yes| C5
        C4 -->|No| C6
    end

    CLAUDE --> DISPATCH

    subgraph DISPATCH ["Outcome Dispatch"]
        D1{Outcome?}
        D2[overflow → split or escalate model]
        D3[rate_limited → throw with reset time]
        D4[error → log and break]
        D5[success → check mode completion]
        D1 --> D2
        D1 --> D3
        D1 --> D4
        D1 --> D5
    end

    D5 --> MODE_CHECK{Mode?}
    MODE_CHECK -->|plan| PLAN_DONE{Plan file<br/>exists?}
    MODE_CHECK -->|build| BUILD_DONE{Acceptance<br/>criteria met?}

    PLAN_DONE -->|Yes| PLANNED[Transition → PLANNED]
    PLAN_DONE -->|No| ITER_INC

    BUILD_DONE -->|Yes| PRE_COMPLETE[Run pre-complete gate<br/>fix commands + test gate]
    BUILD_DONE -->|No| ITER_INC

    PRE_COMPLETE --> GATE_OK{Gate passed?}
    GATE_OK -->|Yes| COMPLETED[Transition → COMPLETED<br/>Trigger verification]
    GATE_OK -->|No| ITER_INC

    ITER_INC[iteration++] --> ITER_CHECK

    D2 --> ITER_INC
    PLANNED --> STATS
    COMPLETED --> STATS

    STATS[Persist session stats<br/>tokens, iterations, duration]
    STATS --> UNLOCK[Release lock]
    UNLOCK --> END([Return])
```

## Verification Flow

After an issue reaches COMPLETED, verification runs build/check/test commands. Failed verification spawns fix sub-issues up to a retry limit.

```mermaid
flowchart TD
    ENTRY([verifyIssue]) --> FIX_CHECK{is_verify_fix<br/>= true?}
    FIX_CHECK -->|Yes| SKIP([Skip — no recursive verify])
    FIX_CHECK -->|No| RUN

    RUN[Run DEFAULT_VERIFY_CHECKS<br/>sequentially]

    subgraph CHECKS ["Verification Checks"]
        CH1[bun run build]
        CH2[bun run check]
        CH3[bun run test]
        CH1 --> CH2 --> CH3
    end

    RUN --> CHECKS --> RESULT{All passed?}

    RESULT -->|Yes| VERIFIED[Transition → VERIFIED ✓]

    RESULT -->|No| RETRY{verify_count <br/>< maxVerifyRetries?}
    RETRY -->|Yes| CREATE_FIX[Create fix sub-issue<br/>is_verify_fix = true<br/>Increment verify_count]
    RETRY -->|No| EXHAUSTED[Set verify_exhausted = true<br/>Leave as COMPLETED]

    CREATE_FIX --> FIX_LOOP[Fix issue goes through<br/>plan → build cycle]
    FIX_LOOP --> RE_VERIFY[Parent re-verified<br/>in next auto loop]
```

## Data Flow Overview

Three-layer architecture: CLI → Core → Providers. All I/O goes through providers; core logic is pure.

```mermaid
flowchart LR
    subgraph CLI ["CLI Layer (src/cli/commands/)"]
        CMD_INIT[init]
        CMD_STATUS[status]
        CMD_PLAN[plan]
        CMD_BUILD[build]
        CMD_AUTO[auto]
        CMD_AUDIT[audit]
    end

    subgraph CORE ["Core Layer (src/core/)"]
        CONFIG[config.ts<br/>.barfrc parser]
        BATCH[batch/<br/>orchestration loop]
        TRIAGE_CORE[triage/<br/>one-shot triage]
        VERIFY_CORE[verification/<br/>build+check+test]
        CLAUDE_CORE[claude/<br/>SDK iteration + stream]
        PROMPTS[prompts/<br/>template resolution]
        ISSUE_CORE[issue/<br/>state machine + parser]
    end

    subgraph PROVIDERS ["Provider Layer"]
        BASE[IssueProvider<br/>abstract base]
        LOCAL[LocalProvider<br/>filesystem + POSIX locks]
        GITHUB[GitHubProvider<br/>gh CLI + labels]
    end

    subgraph EXTERNAL ["External"]
        FS[(Issue files<br/>frontmatter .md)]
        GH_API[(GitHub API<br/>via gh CLI)]
        CLAUDE_SDK[Claude Agent SDK<br/>@anthropic-ai/claude-agent-sdk]
    end

    CMD_AUTO --> TRIAGE_CORE
    CMD_AUTO --> BATCH
    CMD_AUTO --> VERIFY_CORE
    CMD_PLAN --> BATCH
    CMD_BUILD --> BATCH

    BATCH --> CLAUDE_CORE
    BATCH --> PROMPTS
    TRIAGE_CORE --> CLAUDE_CORE
    CLAUDE_CORE --> CLAUDE_SDK

    BATCH --> ISSUE_CORE
    TRIAGE_CORE --> ISSUE_CORE
    VERIFY_CORE --> ISSUE_CORE
    ISSUE_CORE --> BASE

    BASE --> LOCAL
    BASE --> GITHUB
    LOCAL --> FS
    GITHUB --> GH_API

    CLI --> CONFIG
```

## Context Overflow Handling

When Claude's token usage exceeds the configured threshold, barf decides whether to split the issue or escalate to a larger model.

```mermaid
flowchart TD
    OVERFLOW([ContextOverflowError<br/>tokens > threshold]) --> CHECK{split_count <br/>< maxAutoSplits?}

    CHECK -->|Yes| SPLIT_PENDING[Set splitPending = true<br/>Next iteration: Claude writes split plan]
    CHECK -->|No| ESCALATE{Larger model<br/>available?}

    ESCALATE -->|Yes| UPGRADE[Switch to larger model<br/>Continue iteration]
    ESCALATE -->|No| STUCK_STATE[Transition → STUCK<br/>Needs human intervention]

    SPLIT_PENDING --> SPLIT_ITER[Claude creates child issues<br/>in next iteration]
    SPLIT_ITER --> SPLIT_DONE[Transition → SPLIT<br/>Plan children sequentially]
```

## Provider Architecture

The provider abstraction enables swapping between local filesystem and GitHub Issues storage with identical semantics.

```mermaid
classDiagram
    class IssueProvider {
        <<abstract>>
        +fetchIssue(id) ResultAsync~Issue, Error~
        +listIssues(filter?) ResultAsync~Issue[], Error~
        +createIssue(input) ResultAsync~Issue, Error~
        +writeIssue(id, fields) ResultAsync~void, Error~
        +deleteIssue(id) ResultAsync~void, Error~
        +lockIssue(id, meta?) ResultAsync~void, Error~
        +unlockIssue(id) ResultAsync~void, Error~
        +isLocked(id) ResultAsync~boolean, Error~
        +transition(id, to) ResultAsync~Issue, Error~
        +autoSelect(mode) ResultAsync~string, Error~
        +checkAcceptanceCriteria(id) ResultAsync~boolean, Error~
    }

    class LocalProvider {
        -issuesDir: string
        -barfDir: string
        +sweepStaleLocks()
        -readLockIfAlive(id)
        -atomicWrite(path, content)
    }

    class GitHubProvider {
        -repo: string
        -stateToLabel(state)
        -labelToState(label)
    }

    IssueProvider <|-- LocalProvider : extends
    IssueProvider <|-- GitHubProvider : extends

    class LocalStorage {
        <<filesystem>>
        issues/*.md
        .barf/*.lock
    }

    class GitHubAPI {
        <<external>>
        gh issue create/edit/list
        gh api labels
    }

    LocalProvider --> LocalStorage : reads/writes
    GitHubProvider --> GitHubAPI : calls via gh CLI
```
