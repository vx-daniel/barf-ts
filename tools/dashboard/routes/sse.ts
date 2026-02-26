/**
 * SSE routes — command streaming + JSONL log tailing.
 */
import { join } from 'path'
import type { IssueService } from '../services/issue-service'
import { readNewLines } from '../services/log-reader'
import { parseLogMessage } from '../services/activity-aggregator'

const ALLOWED_COMMANDS = ['plan', 'build', 'audit'] as const
type AllowedCommand = (typeof ALLOWED_COMMANDS)[number]

export { ALLOWED_COMMANDS }
export type { AllowedCommand }

/** Tracks the currently running process so it can be killed via /api/auto/stop. */
let activeProc: { proc: ReturnType<typeof Bun.spawn>; label: string } | null = null

export function isAllowedCommand(cmd: string): cmd is AllowedCommand {
  return (ALLOWED_COMMANDS as readonly string[]).includes(cmd)
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'Access-Control-Allow-Origin': '*',
} as const

/**
 * Spawns a barf subprocess and streams its stdout/stderr as SSE events.
 * Guards against writing to a closed controller.
 */
function spawnSSEStream(svc: IssueService, args: string[], label?: string): Response {
  const srcIndex = join(import.meta.dir, '..', '..', '..', 'src', 'index.ts')

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      let closed = false

      function send(data: object) {
        if (closed) return
        try {
          controller.enqueue(enc.encode('data: ' + JSON.stringify(data) + '\n\n'))
        } catch {
          closed = true
        }
      }

      function safeClose() {
        if (closed) return
        closed = true
        try { controller.close() } catch { /* already closed */ }
      }

      const configArgs = svc.configPath ? ['--config', svc.configPath] : []
      const proc = Bun.spawn(
        [
          process.execPath,
          'run',
          srcIndex,
          '--cwd',
          svc.projectCwd,
          ...configArgs,
          ...args,
        ],
        {
          stdout: 'pipe',
          stderr: 'pipe',
          env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        },
      )

      async function pipeStream(
        readable: ReadableStream<Uint8Array>,
        streamName: 'stdout' | 'stderr',
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

      if (label) activeProc = { proc, label }

      Promise.all([
        pipeStream(proc.stdout, 'stdout'),
        pipeStream(proc.stderr, 'stderr'),
      ])
        .then(async () => {
          const exitCode = await proc.exited
          if (activeProc?.proc === proc) activeProc = null
          send({ type: 'done', exitCode })
          safeClose()
        })
        .catch((e) => {
          if (activeProc?.proc === proc) activeProc = null
          send({ type: 'error', message: String(e) })
          safeClose()
        })
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}

/**
 * SSE stream for a barf command (plan/build/audit) on a specific issue.
 */
export function handleRunCommand(
  svc: IssueService,
  id: string,
  command: AllowedCommand,
): Response {
  return spawnSSEStream(svc, [command, '--issue', id], command + ':' + id)
}

/**
 * SSE stream for `barf auto` — orchestrates all issues.
 */
export function handleRunAuto(svc: IssueService): Response {
  return spawnSSEStream(svc, ['auto'], 'auto')
}

/**
 * Kills the currently tracked active process (auto or command).
 */
export function handleStopActive(): Response {
  if (!activeProc) {
    return new Response(JSON.stringify({ stopped: false, reason: 'no active process' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const label = activeProc.label
  activeProc.proc.kill()
  activeProc = null
  return new Response(JSON.stringify({ stopped: true, label }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * SSE stream tailing JSONL activity logs for an issue.
 * Polls log file every 500ms, sends parsed activity entries.
 */
export function handleLogTail(svc: IssueService, issueId: string): Response {
  const streamLogDir = svc.config.streamLogDir
  if (!streamLogDir) {
    return new Response(JSON.stringify({ error: 'STREAM_LOG_DIR not configured' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const logPath = join(svc.projectCwd, streamLogDir, `${issueId}.jsonl`)

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      let offset = 0
      let closed = false

      function send(data: object) {
        if (closed) return
        try {
          controller.enqueue(enc.encode('data: ' + JSON.stringify(data) + '\n\n'))
        } catch {
          closed = true
        }
      }

      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval)
          return
        }
        const { lines, newOffset } = readNewLines(logPath, offset)
        offset = newOffset
        for (const line of lines) {
          const entry = parseLogMessage(line.data)
          if (entry) {
            send(entry)
          }
        }
      }, 500)
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}

/**
 * Returns full JSONL log history as JSON array of ActivityEntries.
 */
export function handleLogHistory(svc: IssueService, issueId: string): Response {
  const streamLogDir = svc.config.streamLogDir
  if (!streamLogDir) {
    return new Response(JSON.stringify({ error: 'STREAM_LOG_DIR not configured' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const logPath = join(svc.projectCwd, streamLogDir, `${issueId}.jsonl`)
  const { lines } = readNewLines(logPath, 0)
  const entries = lines
    .map((l) => parseLogMessage(l.data))
    .filter((e): e is NonNullable<typeof e> => e !== null)

  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json' },
  })
}
