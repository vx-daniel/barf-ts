/**
 * barf Kanban Playground — local dev server
 *
 * Usage:
 *   bun tools/playground-server.ts --cwd <project-dir> [--config <path>] [--port 3333]
 *
 * Serves an interactive Kanban board for a barf project and exposes a small
 * REST API backed by LocalIssueProvider. Long-running commands (plan/build/audit)
 * are streamed back to the browser via Server-Sent Events.
 */

import { resolve, join } from 'path'
import { loadConfig } from '../src/core/config'
import { LocalIssueProvider } from '../src/core/issue/providers/local'
import { VALID_TRANSITIONS } from '../src/core/issue'
import { IssueStateSchema } from '../src/types'

// ── CLI arg parsing ────────────────────────────────────────────────────────────

function parseArgs(): { projectCwd: string; configPath: string | undefined; port: number } {
  const args = process.argv.slice(2)
  let cwd = process.cwd()
  let configPath: string | undefined
  let port = 3333
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) cwd = resolve(args[++i])
    else if (args[i] === '--config' && args[i + 1]) configPath = resolve(args[++i])
    else if (args[i] === '--port' && args[i + 1]) port = parseInt(args[++i], 10)
  }
  return { projectCwd: resolve(cwd), configPath, port }
}

const { projectCwd, configPath, port } = parseArgs()
const config = loadConfig(configPath ?? join(projectCwd, '.barfrc'))
const issuesDir = resolve(projectCwd, config.issuesDir)
const barfDir = resolve(projectCwd, config.barfDir)
const provider = new LocalIssueProvider(issuesDir, barfDir)

// ── Helpers ────────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status = 400): Response {
  return json({ error: message }, status)
}

// ── Route handlers ─────────────────────────────────────────────────────────────

async function handleListIssues(): Promise<Response> {
  const result = await provider.listIssues()
  if (result.isErr()) return jsonError(result.error.message, 500)
  return json(result.value)
}

async function handleGetIssue(id: string): Promise<Response> {
  const result = await provider.fetchIssue(id)
  if (result.isErr()) return jsonError(result.error.message, 404)
  return json(result.value)
}

async function handleCreateIssue(req: Request): Promise<Response> {
  let body: { title?: string; body?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  if (!body.title?.trim()) return jsonError('title is required')
  const result = await provider.createIssue({ title: body.title.trim(), body: body.body })
  if (result.isErr()) return jsonError(result.error.message, 500)
  return json(result.value, 201)
}

async function handleDeleteIssue(id: string): Promise<Response> {
  const result = await provider.deleteIssue(id)
  if (result.isErr()) return jsonError(result.error.message, 500)
  return json({ ok: true })
}

async function handleTransition(id: string, req: Request): Promise<Response> {
  let body: { to?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  const parsed = IssueStateSchema.safeParse(body.to)
  if (!parsed.success) return jsonError('Invalid state: ' + body.to)
  const result = await provider.transition(id, parsed.data)
  if (result.isErr()) return jsonError(result.error.message, 400)
  return json(result.value)
}

const ALLOWED_COMMANDS = ['plan', 'build', 'audit'] as const // interview uses WebSocket, not SSE
type AllowedCommand = (typeof ALLOWED_COMMANDS)[number]

function handleRunCommand(id: string, command: AllowedCommand): Response {
  const srcIndex = join(import.meta.dir, '..', 'src', 'index.ts')

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()

      function send(data: object) {
        controller.enqueue(enc.encode('data: ' + JSON.stringify(data) + '\n\n'))
      }

      const configArgs = configPath ? ['--config', configPath] : []
      const proc = Bun.spawn(
        [process.execPath, 'run', srcIndex, '--cwd', projectCwd, ...configArgs, command, '--issue', id],
        {
          stdout: 'pipe',
          stderr: 'pipe',
          env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        }
      )

      async function pipeStream(
        readable: ReadableStream<Uint8Array>,
        streamName: 'stdout' | 'stderr'
      ) {
        const reader = readable.getReader()
        const dec = new TextDecoder()
        let buf = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += dec.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              // Strip ANSI escape codes
              const clean = line.replace(/\x1b\[[0-9;]*m/g, '')
              send({ type: streamName, line: clean })
            }
          }
          if (buf) {
            send({ type: streamName, line: buf.replace(/\x1b\[[0-9;]*m/g, '') })
          }
        } finally {
          reader.releaseLock()
        }
      }

      Promise.all([pipeStream(proc.stdout, 'stdout'), pipeStream(proc.stderr, 'stderr')])
        .then(async () => {
          const exitCode = await proc.exited
          send({ type: 'done', exitCode })
          controller.close()
        })
        .catch(e => {
          send({ type: 'error', message: String(e) })
          controller.close()
        })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// ── Router ─────────────────────────────────────────────────────────────────────

async function router(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method

  if (method === 'GET' && path === '/') {
    return new Response(buildHtml(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (method === 'GET' && path === '/api/issues') return handleListIssues()
  if (method === 'POST' && path === '/api/issues') return handleCreateIssue(req)

  const issueMatch = path.match(/^\/api\/issues\/([^/]+)$/)
  if (issueMatch) {
    const id = issueMatch[1]
    if (method === 'GET') return handleGetIssue(id)
    if (method === 'DELETE') return handleDeleteIssue(id)
  }

  const transitionMatch = path.match(/^\/api\/issues\/([^/]+)\/transition$/)
  if (transitionMatch && method === 'PUT') return handleTransition(transitionMatch[1], req)

  const runMatch = path.match(/^\/api\/issues\/([^/]+)\/run\/([^/]+)$/)
  if (runMatch && (method === 'GET' || method === 'POST')) {
    const [, id, command] = runMatch
    if (!ALLOWED_COMMANDS.includes(command as AllowedCommand)) {
      return jsonError(`Unknown command: ${command}. Allowed: ${ALLOWED_COMMANDS.join(', ')}`)
    }
    return handleRunCommand(id, command as AllowedCommand)
  }

  return new Response('Not found', { status: 404 })
}

// ── WebSocket interview ────────────────────────────────────────────────────────

const wsProcs = new Map<object, ReturnType<typeof Bun.spawn>>()

function startInterviewProc(ws: { send(data: string): void }, issueId: string): void {
  const srcIndex = join(import.meta.dir, '..', 'src', 'index.ts')
  const configArgs = configPath ? ['--config', configPath] : []

  const proc = Bun.spawn(
    [process.execPath, 'run', srcIndex, '--cwd', projectCwd, ...configArgs, 'interview', '--issue', issueId],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    }
  )
  wsProcs.set(ws, proc)

  function send(data: object) {
    try { ws.send(JSON.stringify(data)) } catch { /* ws already closed */ }
  }

  async function pipeStream(readable: ReadableStream<Uint8Array>, streamName: 'stdout' | 'stderr') {
    const reader = readable.getReader()
    const dec = new TextDecoder()
    let buf = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          send({ type: streamName, line: line.replace(/\x1b\[[0-9;]*m/g, '') })
        }
      }
      if (buf) send({ type: streamName, line: buf.replace(/\x1b\[[0-9;]*m/g, '') })
    } finally {
      reader.releaseLock()
    }
  }

  Promise.all([pipeStream(proc.stdout, 'stdout'), pipeStream(proc.stderr, 'stderr')])
    .then(async () => {
      const exitCode = await proc.exited
      send({ type: 'done', exitCode })
      wsProcs.delete(ws)
    })
    .catch(e => {
      send({ type: 'error', message: String(e) })
      wsProcs.delete(ws)
    })
}

// ── HTML playground ────────────────────────────────────────────────────────────

function buildHtml(): string {
  const validTransitionsJson = JSON.stringify(VALID_TRANSITIONS)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>barf kanban</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d0d1a;--surface:#161625;--surface2:#1e1e32;--border:#2a2a45;
  --text:#e2e8f0;--text-muted:#7c8db0;--radius:6px;
  --c-new:#6b7280;--c-interviewing:#3b82f6;--c-planned:#f59e0b;
  --c-in-progress:#f97316;--c-completed:#22c55e;--c-stuck:#ef4444;--c-split:#a855f7;
}
html,body{height:100%;overflow:hidden;background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code',monospace;font-size:13px}
#app{display:flex;flex-direction:column;height:100%}
#header{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}
#header h1{font-size:15px;font-weight:700;color:#a78bfa;white-space:nowrap}
#project-path{color:var(--text-muted);font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hbtn{padding:5px 12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:inherit;font-size:12px;white-space:nowrap}
.hbtn:hover{border-color:#a78bfa;color:#a78bfa}
#refresh-ind{font-size:11px;color:var(--text-muted)}
#main{display:flex;flex-direction:column;flex:1;overflow:hidden}
#board-wrap{flex:1;overflow-x:auto;overflow-y:hidden;padding:12px 16px}
#board{display:flex;gap:10px;height:100%;align-items:flex-start}
.col{display:flex;flex-direction:column;width:200px;min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;max-height:calc(100% - 4px)}
.col-hdr{padding:8px 10px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-top:3px solid transparent}
.col-cnt{font-size:10px;font-weight:400;background:var(--surface2);border-radius:8px;padding:1px 6px;color:var(--text-muted)}
.col-body{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;flex:1}
.col-body::-webkit-scrollbar{width:4px}
.col-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.card{background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border);border-left:3px solid var(--sc,#444);padding:8px 9px;cursor:pointer;transition:border-color .15s,transform .1s;position:relative}
.card:hover{border-color:var(--sc,#888);transform:translateY(-1px)}
.card.running{opacity:.7}
.card-id{font-size:10px;color:var(--text-muted);margin-bottom:3px}
.card-title{font-size:12px;line-height:1.4;word-break:break-word}
.card-meta{margin-top:6px;display:flex;align-items:center;gap:6px}
.pbar{flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden}
.pbar-fill{height:100%;border-radius:2px;transition:width .3s}
.pbar-lbl{font-size:10px;color:var(--text-muted);white-space:nowrap}
.card-actions{display:flex;gap:4px;margin-top:7px;flex-wrap:wrap}
.abtn{font-size:10px;padding:2px 7px;border-radius:3px;border:1px solid;background:transparent;cursor:pointer;font-family:inherit;font-weight:600;letter-spacing:.03em;transition:background .15s}
.abtn:hover{filter:brightness(1.2)}
.abtn:disabled{opacity:.4;cursor:not-allowed}
.abtn-plan{border-color:#f59e0b;color:#f59e0b}
.abtn-build{border-color:#f97316;color:#f97316}
.abtn-audit{border-color:#22c55e;color:#22c55e}
.abtn-interview{border-color:#3b82f6;color:#3b82f6}
@keyframes spin{to{transform:rotate(360deg)}}
#term-wrap{flex-shrink:0;height:180px;border-top:1px solid var(--border);display:flex;flex-direction:column;background:#0a0a14}
#term-hdr{display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-bottom:1px solid var(--border);flex-shrink:0}
#term-title{font-size:11px;color:var(--text-muted)}
#term-close{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;line-height:1}
#term-close:hover{color:var(--text)}
#term-out{flex:1;overflow-y:auto;padding:8px 12px;font-size:11px;line-height:1.6}
#term-out::-webkit-scrollbar{width:4px}
#term-out::-webkit-scrollbar-thumb{background:var(--border)}
.t-stdout{color:#e2e8f0}.t-stderr{color:#f87171}.t-info{color:#60a5fa;font-style:italic}.t-done{color:#4ade80;font-weight:700}.t-error{color:#f87171;font-weight:700}
#term-input-row{display:none;align-items:center;gap:8px;padding:5px 10px;border-top:1px solid var(--border);flex-shrink:0}
#term-input-prompt{font-size:11px;color:#60a5fa;white-space:nowrap}
#term-input{flex:1;background:transparent;border:none;color:var(--text);font-family:inherit;font-size:11px;outline:none}
#term-input::placeholder{color:var(--text-muted)}
#detail{position:fixed;right:0;top:0;bottom:0;width:380px;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .25s ease;z-index:100}
#detail.open{transform:translateX(0)}
#detail-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
#detail-back{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:2px 4px;display:none}
#detail-back:hover{color:var(--text)}
#detail-id{font-size:11px;color:var(--text-muted)}
#detail-title{font-size:14px;font-weight:700;flex:1}
#detail-close{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;padding:2px}
#detail-close:hover{color:var(--text)}
#detail-rels{padding:8px 14px;border-bottom:1px solid var(--border);flex-shrink:0;display:none;flex-direction:column;gap:6px}
.rel-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rel-label{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;min-width:52px}
.rel-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:11px;transition:border-color .15s}
.rel-chip:hover{border-color:var(--text-muted)}
.rel-chip .state-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.rel-chip .rel-id{color:var(--text-muted);font-size:10px}
.card-rel{display:flex;gap:5px;margin-top:5px;flex-wrap:wrap}
.card-rel-tag{font-size:10px;padding:1px 5px;border-radius:3px;border:1px solid var(--border);color:var(--text-muted);background:var(--surface)}
#detail-state{padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#detail-state-lbl{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;letter-spacing:.06em;border:1px solid}
#detail-trans{display:flex;gap:6px;flex-wrap:wrap}
.tbtn{font-size:11px;padding:3px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);cursor:pointer;font-family:inherit}
.tbtn:hover{border-color:var(--text-muted);color:var(--text)}
#detail-body{flex:1;overflow-y:auto;padding:14px 16px}
#detail-body::-webkit-scrollbar{width:4px}
#detail-body::-webkit-scrollbar-thumb{background:var(--border)}
#detail-body pre{white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.7;color:var(--text)}
#detail-acts{padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}
#modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:none;align-items:center;justify-content:center}
#modal-ov.open{display:flex}
#modal{background:var(--surface);border:1px solid var(--border);border-radius:8px;width:420px;max-width:90vw;padding:20px}
#modal h2{font-size:14px;margin-bottom:14px;color:var(--text)}
#modal label{display:block;font-size:11px;color:var(--text-muted);margin-bottom:4px}
#modal input,#modal textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:inherit;font-size:12px;padding:7px 10px;margin-bottom:12px;resize:vertical}
#modal input:focus,#modal textarea:focus{outline:none;border-color:#a78bfa}
#modal-btns{display:flex;gap:8px;justify-content:flex-end}
.mbtn{padding:6px 16px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:inherit;font-size:12px}
.mbtn.primary{background:#7c3aed;border-color:#7c3aed;color:#fff}
.mbtn.primary:hover{background:#6d28d9}
</style>
</head>
<body>
<div id="app">
  <div id="header">
    <h1>&#9672; barf kanban</h1>
    <span id="project-path"></span>
    <button class="hbtn" id="btn-new">+ New Issue</button>
    <span id="refresh-ind">&#x27F3; 5s</span>
  </div>
  <div id="main">
    <div id="board-wrap"><div id="board"></div></div>
    <div id="term-wrap" style="display:none">
      <div id="term-hdr">
        <span id="term-title">terminal</span>
        <button id="term-close">&#x2715;</button>
      </div>
      <div id="term-out"></div>
      <div id="term-input-row">
        <span id="term-input-prompt">answer &gt;</span>
        <input id="term-input" type="text" autocomplete="off" spellcheck="false" placeholder="type your answer and press Enter">
      </div>
    </div>
  </div>
</div>

<div id="detail">
  <div id="detail-hdr">
    <button id="detail-back">&#x2190;</button>
    <span id="detail-id"></span>
    <span id="detail-title"></span>
    <button id="detail-close">&#x2715;</button>
  </div>
  <div id="detail-state">
    <span id="detail-state-lbl"></span>
    <div id="detail-trans"></div>
  </div>
  <div id="detail-rels">
    <div id="detail-parent-row" class="rel-row"></div>
    <div id="detail-children-row" class="rel-row"></div>
  </div>
  <div id="detail-body"></div>
  <div id="detail-acts"></div>
</div>

<div id="modal-ov">
  <div id="modal">
    <h2>New Issue</h2>
    <label for="modal-ttl">Title</label>
    <input id="modal-ttl" type="text" placeholder="Short description of the work item">
    <label for="modal-bdy">Body (optional)</label>
    <textarea id="modal-bdy" rows="5" placeholder="## Description&#10;..."></textarea>
    <div id="modal-btns">
      <button class="mbtn" id="modal-cancel">Cancel</button>
      <button class="mbtn primary" id="modal-submit">Create</button>
    </div>
  </div>
</div>

<script>
(function() {
'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
var VALID_TRANS = ${validTransitionsJson};
var PROJECT_CWD = ${JSON.stringify(projectCwd)};
var STATE_ORDER = ['NEW','INTERVIEWING','PLANNED','IN_PROGRESS','COMPLETED','STUCK','SPLIT'];
var STATE_COLORS = {
  NEW:'#6b7280', INTERVIEWING:'#3b82f6', PLANNED:'#f59e0b',
  IN_PROGRESS:'#f97316', COMPLETED:'#22c55e', STUCK:'#ef4444', SPLIT:'#a855f7'
};
var STATE_LABELS = {
  NEW:'NEW', INTERVIEWING:'INTERVIEWING', PLANNED:'PLANNED',
  IN_PROGRESS:'IN PROGRESS', COMPLETED:'COMPLETED', STUCK:'STUCK', SPLIT:'SPLIT'
};
var CMD_ACTIONS = {
  NEW:['interview'], INTERVIEWING:['plan'], PLANNED:['plan','build'],
  IN_PROGRESS:['build'], COMPLETED:['audit'], STUCK:['plan'], SPLIT:[]
};
var CMD_CLASS = {plan:'abtn-plan',build:'abtn-build',audit:'abtn-audit',interview:'abtn-interview'};

// ── State ─────────────────────────────────────────────────────────────────────
var issues = [];
var selectedId = null;
var refreshTimer = null;
var activeSSE = null;
var activeWS = null;
var runningId = null;
var pauseRefresh = false;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.getElementById('project-path').textContent = PROJECT_CWD;

// ── Data ──────────────────────────────────────────────────────────────────────
function fetchIssues() {
  return fetch('/api/issues')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      issues = data;
      renderBoard();
      if (selectedId) {
        var up = issues.find(function(i) { return i.id === selectedId; });
        if (up) updateDetail(up);
      }
    })
    .catch(function(e) { console.error('fetch issues:', e); });
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(function() {
    if (!pauseRefresh) fetchIssues();
    scheduleRefresh();
  }, 5000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function el(tag, cls) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

// ── Board ─────────────────────────────────────────────────────────────────────
function renderBoard() {
  var board = document.getElementById('board');
  board.textContent = '';
  STATE_ORDER.forEach(function(state) {
    board.appendChild(buildCol(state, issues.filter(function(i) { return i.state === state; })));
  });
}

function buildCol(state, stateIssues) {
  var color = STATE_COLORS[state];
  var col = el('div', 'col');

  var hdr = el('div', 'col-hdr');
  hdr.style.color = color;
  hdr.style.borderTopColor = color;
  var lbl = el('span');
  lbl.textContent = STATE_LABELS[state];
  var cnt = el('span', 'col-cnt');
  cnt.textContent = String(stateIssues.length);
  hdr.appendChild(lbl);
  hdr.appendChild(cnt);
  col.appendChild(hdr);

  var body = el('div', 'col-body');
  stateIssues.forEach(function(issue) { body.appendChild(buildCard(issue)); });
  col.appendChild(body);
  return col;
}

function buildCard(issue) {
  var color = STATE_COLORS[issue.state];
  var card = el('div', 'card' + (issue.id === runningId ? ' running' : ''));
  card.id = 'card-' + issue.id;
  card.style.setProperty('--sc', color);

  var idEl = el('div', 'card-id');
  idEl.textContent = '#' + issue.id;
  card.appendChild(idEl);

  var titleEl = el('div', 'card-title');
  titleEl.textContent = issue.title;
  card.appendChild(titleEl);

  if (issue.context_usage_percent != null) {
    var pct = issue.context_usage_percent;
    var fillColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f97316' : '#22c55e';
    var meta = el('div', 'card-meta');
    var pbar = el('div', 'pbar');
    var fill = el('div', 'pbar-fill');
    fill.style.width = pct + '%';
    fill.style.background = fillColor;
    pbar.appendChild(fill);
    var lbl2 = el('span', 'pbar-lbl');
    lbl2.textContent = pct + '%';
    meta.appendChild(pbar);
    meta.appendChild(lbl2);
    card.appendChild(meta);
  }

  // Parent / children badges
  var hasParent = issue.parent && issue.parent.trim();
  var hasChildren = issue.children && issue.children.length > 0;
  if (hasParent || hasChildren) {
    var relRow = el('div', 'card-rel');
    if (hasParent) {
      var pt = el('span', 'card-rel-tag');
      pt.textContent = '\u2191 ' + issue.parent;
      relRow.appendChild(pt);
    }
    if (hasChildren) {
      var ct = el('span', 'card-rel-tag');
      ct.textContent = '\u21d3 ' + issue.children.length;
      relRow.appendChild(ct);
    }
    card.appendChild(relRow);
  }

  var actions = CMD_ACTIONS[issue.state] || [];
  if (actions.length > 0) {
    var actDiv = el('div', 'card-actions');
    actions.forEach(function(cmd) {
      var btn = el('button', 'abtn ' + CMD_CLASS[cmd]);
      btn.textContent = cmd;
      btn.disabled = runningId !== null;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        runCommand(issue.id, cmd);
      });
      actDiv.appendChild(btn);
    });
    card.appendChild(actDiv);
  }

  card.addEventListener('click', function() { openDetail(issue); });
  return card;
}

// ── Detail panel ──────────────────────────────────────────────────────────────
var detailHistory = [];

function openDetail(issue) {
  detailHistory = [issue.id];
  selectedId = issue.id;
  updateDetail(issue);
  document.getElementById('detail').classList.add('open');
  syncBackBtn();
}

function navigateDetail(id) {
  var issue = issues.find(function(i) { return i.id === id; });
  if (!issue) return;
  detailHistory.push(id);
  selectedId = id;
  updateDetail(issue);
  syncBackBtn();
}

function detailBack() {
  if (detailHistory.length <= 1) return;
  detailHistory.pop();
  var prevId = detailHistory[detailHistory.length - 1];
  var issue = issues.find(function(i) { return i.id === prevId; });
  if (!issue) return;
  selectedId = prevId;
  updateDetail(issue);
  syncBackBtn();
}

function syncBackBtn() {
  document.getElementById('detail-back').style.display = detailHistory.length > 1 ? 'inline-block' : 'none';
}

function buildRelChip(id, issue) {
  var chip = el('span', 'rel-chip');
  if (issue) {
    var dot = el('span', 'state-dot');
    dot.style.background = STATE_COLORS[issue.state];
    chip.appendChild(dot);
  }
  var idSpan = el('span', 'rel-id');
  idSpan.textContent = '#' + id;
  chip.appendChild(idSpan);
  if (issue) {
    var titleSpan = el('span');
    titleSpan.textContent = issue.title.length > 28 ? issue.title.slice(0, 28) + '\u2026' : issue.title;
    chip.appendChild(titleSpan);
  }
  chip.addEventListener('click', function() { navigateDetail(id); });
  return chip;
}

function updateDetail(issue) {
  var color = STATE_COLORS[issue.state];
  document.getElementById('detail-id').textContent = '#' + issue.id;
  document.getElementById('detail-title').textContent = issue.title;

  var stLbl = document.getElementById('detail-state-lbl');
  stLbl.textContent = STATE_LABELS[issue.state];
  stLbl.style.color = color;
  stLbl.style.borderColor = color;

  var transDiv = document.getElementById('detail-trans');
  transDiv.textContent = '';
  (VALID_TRANS[issue.state] || []).forEach(function(to) {
    var btn = el('button', 'tbtn');
    btn.textContent = '\u2192 ' + STATE_LABELS[to];
    btn.addEventListener('click', function() { doTransition(issue.id, to); });
    transDiv.appendChild(btn);
  });

  // ── Relationships ──────────────────────────────────────────────────────────
  var hasParent = issue.parent && issue.parent.trim();
  var hasChildren = issue.children && issue.children.length > 0;
  var relsEl = document.getElementById('detail-rels');
  relsEl.style.display = (hasParent || hasChildren) ? 'flex' : 'none';

  var parentRow = document.getElementById('detail-parent-row');
  parentRow.textContent = '';
  parentRow.style.display = 'none';
  if (hasParent) {
    var pLabel = el('span', 'rel-label');
    pLabel.textContent = 'parent';
    parentRow.appendChild(pLabel);
    var parentIssue = issues.find(function(i) { return i.id === issue.parent; });
    parentRow.appendChild(buildRelChip(issue.parent, parentIssue));
    parentRow.style.display = 'flex';
  }

  var childrenRow = document.getElementById('detail-children-row');
  childrenRow.textContent = '';
  childrenRow.style.display = 'none';
  if (hasChildren) {
    var cLabel = el('span', 'rel-label');
    cLabel.textContent = 'children';
    childrenRow.appendChild(cLabel);
    issue.children.forEach(function(childId) {
      var childIssue = issues.find(function(i) { return i.id === childId; });
      childrenRow.appendChild(buildRelChip(childId, childIssue));
    });
    childrenRow.style.display = 'flex';
  }

  var bodyEl = document.getElementById('detail-body');
  bodyEl.textContent = '';
  var pre = el('pre');
  pre.textContent = issue.body || '(no body)';
  bodyEl.appendChild(pre);

  var actsDiv = document.getElementById('detail-acts');
  actsDiv.textContent = '';
  (CMD_ACTIONS[issue.state] || []).forEach(function(cmd) {
    var btn = el('button', 'abtn ' + CMD_CLASS[cmd]);
    btn.style.fontSize = '12px';
    btn.style.padding = '5px 14px';
    btn.textContent = 'Run ' + cmd;
    btn.disabled = runningId !== null;
    btn.addEventListener('click', function() { runCommand(issue.id, cmd); });
    actsDiv.appendChild(btn);
  });

  var delBtn = el('button', 'abtn');
  delBtn.style.fontSize = '12px';
  delBtn.style.padding = '5px 14px';
  delBtn.style.borderColor = '#6b7280';
  delBtn.style.color = '#6b7280';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', function() { deleteIssue(issue.id); });
  actsDiv.appendChild(delBtn);
}

function closeDetail() {
  selectedId = null;
  detailHistory = [];
  document.getElementById('detail').classList.remove('open');
}

document.getElementById('detail-back').addEventListener('click', detailBack);
document.getElementById('detail-close').addEventListener('click', closeDetail);

// ── Transitions ───────────────────────────────────────────────────────────────
function doTransition(id, to) {
  fetch('/api/issues/' + id + '/transition', {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({to: to})
  }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { termLog('error', 'Transition failed: ' + e.error); });
    return fetchIssues();
  }).catch(function(e) { termLog('error', String(e)); });
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteIssue(id) {
  if (!confirm('Delete issue #' + id + '? This cannot be undone.')) return;
  fetch('/api/issues/' + id, {method: 'DELETE'}).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { termLog('error', 'Delete failed: ' + e.error); });
    closeDetail();
    return fetchIssues();
  }).catch(function(e) { termLog('error', String(e)); });
}

// ── Commands ──────────────────────────────────────────────────────────────────
function stopActive() {
  if (activeSSE) { activeSSE.close(); activeSSE = null; }
  if (activeWS) { activeWS.close(); activeWS = null; }
  setTermInput(false);
}

function onCommandDone(exitCode) {
  var ok = exitCode === 0;
  termLog(ok ? 'done' : 'error', ok ? 'Done (exit 0)' : 'Failed (exit ' + exitCode + ')');
  runningId = null; pauseRefresh = false;
  setTermInput(false);
  fetchIssues();
}

function handleMsg(data) {
  if (data.type === 'stdout' && data.line.trim()) termLog('stdout', data.line);
  else if (data.type === 'stderr' && data.line.trim()) termLog('stderr', data.line);
  else if (data.type === 'done') onCommandDone(data.exitCode);
  else if (data.type === 'error') { termLog('error', 'Error: ' + data.message); runningId = null; pauseRefresh = false; setTermInput(false); }
}

function runCommand(id, cmd) {
  stopActive();
  pauseRefresh = true;
  runningId = id;
  renderBoard();
  openTerminal('barf ' + cmd + ' --issue ' + id);
  termLog('info', 'Starting barf ' + cmd + ' --issue ' + id + ' ...');

  if (cmd === 'interview') {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var ws = new WebSocket(proto + '//' + location.host + '/api/issues/' + id + '/run/interview');
    activeWS = ws;
    ws.onopen = function() { setTermInput(true); };
    ws.onmessage = function(e) { handleMsg(JSON.parse(e.data)); };
    ws.onerror = function() { termLog('error', 'WebSocket error'); };
    ws.onclose = function() {
      if (activeWS === ws) { activeWS = null; runningId = null; pauseRefresh = false; setTermInput(false); renderBoard(); }
    };
  } else {
    var sse = new EventSource('/api/issues/' + id + '/run/' + cmd);
    activeSSE = sse;
    sse.onmessage = function(e) {
      var data = JSON.parse(e.data);
      handleMsg(data);
      if (data.type === 'done' || data.type === 'error') { sse.close(); activeSSE = null; }
    };
    sse.onerror = function() {
      termLog('error', 'SSE connection lost (state: ' + sse.readyState + ')');
      sse.close(); activeSSE = null; runningId = null; pauseRefresh = false; renderBoard();
    };
  }
}

function setTermInput(show) {
  var row = document.getElementById('term-input-row');
  row.style.display = show ? 'flex' : 'none';
  if (show) { document.getElementById('term-input').value = ''; document.getElementById('term-input').focus(); }
}

document.getElementById('term-input').addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var val = this.value;
  this.value = '';
  termLog('info', '> ' + val);
  if (activeWS) activeWS.send(val);
});

// ── Terminal ──────────────────────────────────────────────────────────────────
function openTerminal(title) {
  var wrap = document.getElementById('term-wrap');
  wrap.style.display = 'flex';
  document.getElementById('term-title').textContent = title || 'terminal';
  document.getElementById('term-out').textContent = '';
}

document.getElementById('term-close').addEventListener('click', function() {
  document.getElementById('term-wrap').style.display = 'none';
  stopActive();
  runningId = null; pauseRefresh = false;
  renderBoard();
});

function termLog(type, text) {
  var out = document.getElementById('term-out');
  var line = el('div', 't-' + type);
  line.textContent = text;
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

// ── New Issue Modal ───────────────────────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', function() {
  document.getElementById('modal-ttl').value = '';
  document.getElementById('modal-bdy').value = '';
  document.getElementById('modal-ov').classList.add('open');
  setTimeout(function() { document.getElementById('modal-ttl').focus(); }, 50);
});

document.getElementById('modal-ov').addEventListener('click', function(e) {
  if (e.target === this) document.getElementById('modal-ov').classList.remove('open');
});

document.getElementById('modal-cancel').addEventListener('click', function() {
  document.getElementById('modal-ov').classList.remove('open');
});

document.getElementById('modal-ttl').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') submitNewIssue();
});

document.getElementById('modal-submit').addEventListener('click', submitNewIssue);

function submitNewIssue() {
  var title = document.getElementById('modal-ttl').value.trim();
  var body = document.getElementById('modal-bdy').value.trim();
  if (!title) { document.getElementById('modal-ttl').focus(); return; }
  fetch('/api/issues', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({title: title, body: body || undefined})
  }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { alert('Create failed: ' + e.error); });
    document.getElementById('modal-ov').classList.remove('open');
    return fetchIssues();
  }).catch(function(e) { alert('Create failed: ' + e); });
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (document.getElementById('modal-ov').classList.contains('open')) {
      document.getElementById('modal-ov').classList.remove('open'); return;
    }
    if (document.getElementById('detail').classList.contains('open')) {
      closeDetail(); return;
    }
  }
  if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey &&
      document.activeElement === document.body) {
    document.getElementById('btn-new').click();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
fetchIssues();
scheduleRefresh();
})();
</script>
</body>
</html>`
}

// ── Start server ───────────────────────────────────────────────────────────────

Bun.serve({
  port,
  fetch(req, server) {
    const url = new URL(req.url)
    const wsMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/run\/interview$/)
    if (wsMatch && req.headers.get('upgrade') === 'websocket') {
      const upgraded = server.upgrade(req, { data: { issueId: wsMatch[1] } })
      if (upgraded) return undefined
    }
    return router(req)
  },
  websocket: {
    open(ws) {
      const { issueId } = ws.data as { issueId: string }
      startInterviewProc(ws, issueId)
    },
    message(ws, message) {
      const proc = wsProcs.get(ws)
      if (proc?.stdin) {
        const line = typeof message === 'string' ? message : new TextDecoder().decode(message)
        proc.stdin.write(line + '\n')
        proc.stdin.flush()
      }
    },
    close(ws) {
      const proc = wsProcs.get(ws)
      if (proc) { proc.kill(); wsProcs.delete(ws) }
    },
  },
})
console.log(`barf kanban  ->  http://localhost:${port}`)
console.log(`project:        ${projectCwd}`)
console.log(`issues dir:     ${issuesDir}`)
