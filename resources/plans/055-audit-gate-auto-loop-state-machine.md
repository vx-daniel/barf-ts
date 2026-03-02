# 055: Audit Gate — Auto-Loop State Machine

## Context

Currently, the `audit` command runs as a standalone CLI action *after* builds complete. There's no mechanism to automatically pause the build pipeline, run an audit via an external agent (Gemini/ChatGPT), and then force-fix audit findings before resuming normal builds.

This feature adds an **audit gate** — a state machine inside the auto loop that:
1. Blocks new build sessions from starting
2. Waits for active sessions to drain
3. Runs the audit agent on all BUILT issues
4. Creates fix issues from audit findings
5. Builds ONLY the fix issues (global build block)
6. Auto-resumes normal operation once all fixes are done

### Triggers
- **Dashboard button**: On-demand "Start Audit" button in the UI
- **CLI flag**: `barf auto --audit-gate` to enable periodic audits
- **Config auto-trigger**: `AUDIT_AFTER_N_BUILT=10` — after N issues complete, auto-trigger
- **Cancellation**: Dashboard button or CLI to cancel an in-progress audit gate

---

## Design

### 1. Audit Gate State Machine

New enum `AuditGateState`:

```
running → draining → auditing → fixing → running
                                   ↗
            (cancel) → running  ←──┘
```

| State | Behavior |
|-------|----------|
| `running` | Normal auto loop — triage, plan, build, verify as usual |
| `draining` | No new build/plan sessions start. Wait for all active sessions to finish. |
| `auditing` | Run `auditIssue()` on all BUILT issues. Create fix issues from findings. |
| `fixing` | Only audit-fix issues can build. All other issues are blocked globally. |

### 2. Gate File: `.barf/audit-gate.json`

Persisted state file read/written by the auto loop and dashboard/CLI:

```typescript
// New schema: src/types/schema/audit-gate-schema.ts
const AuditGateStateSchema = z.enum(['running', 'draining', 'auditing', 'fixing', 'cancelled'])

const AuditGateSchema = z.object({
  state: AuditGateStateSchema.default('running'),
  triggeredBy: z.enum(['dashboard', 'cli', 'auto']).optional(),
  triggeredAt: z.string().optional(),       // ISO 8601
  completedSinceLastAudit: z.number().int().nonnegative().default(0),
  auditFixIssueIds: z.array(z.string()).default([]),  // track fix issues created by audit
  cancelledAt: z.string().optional(),
})
```

### 3. Config Additions

In `ConfigSchema` (`src/types/schema/config-schema.ts`):

```typescript
/** Number of completed issues before auto-triggering an audit gate. 0 = disabled. */
auditAfterNCompleted: z.number().int().nonnegative().default(0),
```

### 4. Auto Loop Integration (`src/cli/commands/auto.ts`)

The main `while(true)` loop gains gate-awareness:

```
each iteration:
  gate = readAuditGate(config.barfDir)

  // Auto-trigger check
  if gate.state === 'running' && config.auditAfterNCompleted > 0:
    if gate.completedSinceLastAudit >= config.auditAfterNCompleted:
      gate.state = 'draining', gate.triggeredBy = 'auto'
      writeAuditGate(gate)

  // State machine transitions
  switch gate.state:
    case 'running':
      → normal triage/plan/build/verify cycle
      → after each build completes: increment completedSinceLastAudit

    case 'draining':
      → skip plan and build phases
      → check if any active sessions (locks exist)
      → if no active sessions: transition to 'auditing'

    case 'auditing':
      → run auditIssue() on all BUILT issues
      → collect created fix issue IDs into gate.auditFixIssueIds
      → if no findings: transition to 'running', reset counter
      → if findings: transition to 'fixing'

    case 'fixing':
      → only build issues where id ∈ gate.auditFixIssueIds
      → after each fix completes, check if ALL fix issues are BUILT/COMPLETE
      → if all done: transition to 'running', reset counter, clear auditFixIssueIds

    case 'cancelled':
      → transition to 'running', reset state
```

### 5. Build Command Gate (`src/cli/commands/build.ts`)

The standalone `barf build` command also respects the gate:

```typescript
// At start of buildCommand():
const gate = readAuditGate(config.barfDir)
if (gate.state === 'fixing') {
  // Only allow building audit fix issues
  candidates = candidates.filter(i => gate.auditFixIssueIds.includes(i.id))
  if (candidates.length === 0) {
    logger.warn('audit gate active — only audit fix issues can build')
    return
  }
}
if (gate.state === 'draining' || gate.state === 'auditing') {
  logger.warn('audit gate active — builds are paused')
  return
}
```

### 6. Gate I/O Module (`src/core/batch/audit-gate.ts`)

New module with pure functions:

- `readAuditGate(barfDir): AuditGate` — read + parse, default to `{ state: 'running' }`
- `writeAuditGate(barfDir, gate): void` — atomic write
- `triggerAuditGate(barfDir, triggeredBy): void` — set state to 'draining'
- `cancelAuditGate(barfDir): void` — set state to 'running', reset
- `incrementCompleted(barfDir): void` — bump counter
- `checkAutoTrigger(gate, config): boolean` — pure: should we trigger?

### 7. Dashboard Integration

**New REST endpoints** (`tools/dashboard/routes/api.ts`):

- `GET /api/audit-gate` — return current gate state
- `POST /api/audit-gate/trigger` — set state to 'draining' (triggeredBy: 'dashboard')
- `POST /api/audit-gate/cancel` — cancel active audit gate

**Frontend** (`tools/dashboard/frontend/`):

- Add "Audit Gate" button to the KanbanBoard header area
- Show gate state as a status badge (running/draining/auditing/fixing)
- Button toggles: "Start Audit" when running, "Cancel Audit" when draining/auditing/fixing

### 8. Session Index Events

New events in session-index for dashboard tracking:

- `audit_gate_triggered` — when gate enters draining
- `audit_gate_auditing` — when audit phase starts
- `audit_gate_fixing` — when fixing phase starts
- `audit_gate_completed` — when gate returns to running
- `audit_gate_cancelled` — when cancelled

### 9. CLI Flag

In `src/index.ts`, add to the `auto` command:

```typescript
.option('--audit-gate', 'Enable periodic audit gate (uses AUDIT_AFTER_N_BUILT config)')
```

When `--audit-gate` is passed but `config.auditAfterNCompleted === 0`, default to 10.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/schema/audit-gate-schema.ts` | Zod schema for gate state |
| `src/core/batch/audit-gate.ts` | Gate I/O + pure decision functions |
| `tests/unit/audit-gate.test.ts` | Unit tests for gate logic |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/schema/config-schema.ts` | Add `auditAfterNCompleted` field |
| `src/types/schema/index.ts` | Export audit gate schema + types |
| `src/types/index.ts` | Re-export audit gate types |
| `src/core/batch/index.ts` | Export audit gate module |
| `src/cli/commands/auto.ts` | Integrate gate state machine into loop |
| `src/cli/commands/build.ts` | Gate check at start |
| `src/cli/commands/audit.ts` | Extract `auditIssue` for reuse by auto loop |
| `src/index.ts` | Add `--audit-gate` flag to auto command |
| `src/core/batch/session-index.ts` | Add audit gate event writers |
| `src/types/schema/session-index-schema.ts` | Add audit gate event types |
| `tools/dashboard/routes/api.ts` | Add gate REST endpoints |
| `tools/dashboard/frontend/components/KanbanBoard.tsx` | Add audit gate button + status |
| `tools/dashboard/frontend/lib/actions.ts` | Add trigger/cancel actions |
| `tools/dashboard/frontend/lib/state.ts` | Add `auditGate` signal |

## Key Reuse

- **`auditIssue()`** from `src/cli/commands/audit.ts` — already does the full audit flow. Export it and call from auto loop during 'auditing' phase.
- **`readAuditGate()`/`writeAuditGate()`** follow the same pattern as lock files in `.barf/`
- **`createLimiter()`** from `src/core/batch/` — reuse for concurrent audit fix builds
- **`appendEvent()`** pattern from session-index — extend for gate events

---

## Verification

1. **Unit tests**: Gate state transitions, auto-trigger logic, counter reset
2. **Integration test**: `auto` command with mocked deps — verify draining → auditing → fixing → running flow
3. **Manual test**:
   - Run `barf auto --audit-gate` with `AUDIT_AFTER_N_BUILT=2`
   - Complete 2 issues → verify audit triggers automatically
   - Dashboard: click "Start Audit" → verify gate activates
   - Dashboard: click "Cancel Audit" → verify gate resets
   - During fixing phase: run `barf build` → verify only fix issues are allowed
