# 030 — Barf Dashboard: Modular Kanban + Editor + Activity Log

## Context

The existing `tools/playground-server.ts` is a 1000-line monolith serving a kanban board with REST API + SSE streaming. It works but is hard to extend. The user wants to evolve it into a full dashboard with:
- Enhanced kanban board
- CodeMirror 6 markdown editor for issues
- Real-time status panel (tokens, context, active issue)
- Expandable agent/tool activity log

This plan decomposes the monolith into `tools/dashboard/` modules and adds the three new panels.

## File Layout

```
tools/dashboard/
  server.ts                    # Entry: CLI args, Bun.serve(), route dispatch
  routes/
    api.ts                     # REST: CRUD issues, transitions, config
    sse.ts                     # SSE: command streaming + JSONL log tailing
    ws.ts                      # WebSocket: interview handler
    static.ts                  # Serves dist/ (bundled frontend)
  services/
    issue-service.ts           # LocalIssueProvider + Config wrapper
    log-reader.ts              # JSONL tail reader (byte offset tracking)
    activity-aggregator.ts     # Merges SSE events + JSONL into ActivityEntry[]
  frontend/
    index.html                 # Shell HTML, panel containers
    main.ts                    # Init panels, SSE/WS connections
    panels/
      kanban.ts                # 7-column board (extracted from existing)
      editor.ts                # CodeMirror 6 + marked preview
      status.ts                # Token/context/model status display
      activity-log.ts          # Expandable unified timeline
    lib/
      api-client.ts            # fetch() wrappers for /api/*
      sse-client.ts            # EventSource manager with reconnect
      ws-client.ts             # WebSocket manager for interview
      types.ts                 # Frontend types (ActivityEntry, StatusData)
    styles/
      base.css                 # CSS variables, dark theme, layout grid
      kanban.css
      editor.css
      status.css
      activity.css
  build.ts                     # Bun.build() → dist/
  dist/                        # .gitignored build output
```

## Implementation Steps

### Step 1: Extract Server into Modules
### Step 2: Frontend Build Pipeline
### Step 3: Kanban Panel
### Step 4: Status Panel
### Step 5: Activity Log Panel
### Step 6: Markdown Editor Panel

See full plan details in the implementation task description.
