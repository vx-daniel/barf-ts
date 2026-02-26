/**
 * barf Dashboard — local dev server
 *
 * Usage:
 *   bun tools/dashboard/server.ts --cwd <project-dir> [--config <path>] [--port 3333]
 *
 * Serves an interactive dashboard for a barf project: kanban board, issue editor,
 * status panel, and activity log. REST API + SSE + WebSocket.
 */
import { resolve } from 'path'
import { IssueService } from './services/issue-service'
import {
  handleListIssues,
  handleGetIssue,
  handleCreateIssue,
  handleUpdateIssue,
  handleDeleteIssue,
  handleTransition,
  handleGetConfig,
  handleSaveConfig,
  jsonError,
} from './routes/api'
import {
  handleRunCommand,
  handleRunAuto,
  handleStopActive,
  handleLogTail,
  handleLogHistory,
  isAllowedCommand,
} from './routes/sse'
import { startInterviewProc, wsProcs } from './routes/ws'
import { serveStatic } from './routes/static'

// ── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(): {
  projectCwd: string
  configPath: string | undefined
  port: number
} {
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
const svc = new IssueService({ projectCwd, configPath })

// ── Router ───────────────────────────────────────────────────────────────────

async function router(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method

  // API routes
  if (method === 'GET' && path === '/api/issues') return handleListIssues(svc)
  if (method === 'POST' && path === '/api/issues') return handleCreateIssue(svc, req)
  if (method === 'GET' && path === '/api/config') return handleGetConfig(svc)
  if (method === 'PUT' && path === '/api/config') return handleSaveConfig(svc, req)
  if ((method === 'GET' || method === 'POST') && path === '/api/auto') return handleRunAuto(svc)
  if (method === 'POST' && path === '/api/auto/stop') return handleStopActive()

  const issueMatch = path.match(/^\/api\/issues\/([^/]+)$/)
  if (issueMatch) {
    const id = issueMatch[1]
    if (method === 'GET') return handleGetIssue(svc, id)
    if (method === 'PUT') return handleUpdateIssue(svc, id, req)
    if (method === 'DELETE') return handleDeleteIssue(svc, id)
  }

  const transitionMatch = path.match(/^\/api\/issues\/([^/]+)\/transition$/)
  if (transitionMatch && method === 'PUT') return handleTransition(svc, transitionMatch[1], req)

  const runMatch = path.match(/^\/api\/issues\/([^/]+)\/run\/([^/]+)$/)
  if (runMatch && (method === 'GET' || method === 'POST')) {
    const [, id, command] = runMatch
    if (!isAllowedCommand(command)) {
      return jsonError(`Unknown command: ${command}. Allowed: plan, build, audit`)
    }
    return handleRunCommand(svc, id, command)
  }

  // Activity log endpoints
  const logTailMatch = path.match(/^\/api\/issues\/([^/]+)\/logs$/)
  if (logTailMatch && method === 'GET') return handleLogTail(svc, logTailMatch[1])

  const logHistoryMatch = path.match(/^\/api\/issues\/([^/]+)\/logs\/history$/)
  if (logHistoryMatch && method === 'GET') return handleLogHistory(svc, logHistoryMatch[1])

  // Static files (frontend)
  const staticResponse = serveStatic(path)
  if (staticResponse) return staticResponse

  return new Response('Not found', { status: 404 })
}

// ── Start server ─────────────────────────────────────────────────────────────

Bun.serve({
  port,
  idleTimeout: 255, // max — SSE streams are long-lived
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
      startInterviewProc(ws, svc, issueId)
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
      if (proc) {
        proc.kill()
        wsProcs.delete(ws)
      }
    },
  },
})

console.log(`barf dashboard  ->  http://localhost:${port}`)
console.log(`project:           ${projectCwd}`)
console.log(`issues dir:        ${svc.issuesDir}`)
