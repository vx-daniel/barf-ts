/**
 * WebSocket interview handler — spawns `barf interview` subprocess
 * and pipes stdin/stdout/stderr over the WebSocket.
 */
import { join } from 'path'
import type { IssueService } from '@dashboard/services/issue-service'

export const wsProcs = new Map<object, ReturnType<typeof Bun.spawn>>()

export function startInterviewProc(
  ws: { send(data: string): void },
  svc: IssueService,
  issueId: string,
): void {
  const srcIndex = join(import.meta.dir, '..', '..', '..', 'src', 'index.ts')
  const configArgs = svc.configPath ? ['--config', svc.configPath] : []

  const proc = Bun.spawn(
    [
      process.execPath,
      'run',
      srcIndex,
      '--cwd',
      svc.projectCwd,
      ...configArgs,
      'interview',
      '--issue',
      issueId,
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    },
  )
  wsProcs.set(ws, proc)

  function send(data: object) {
    try {
      ws.send(JSON.stringify(data))
    } catch {
      /* ws already closed */
    }
  }

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
          send({
            type: streamName,
            // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ANSI escape stripping
            line: line.replace(/\u001b\[[0-9;]*m/g, ''),
          })
        }
      }
      if (buf)
        // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ANSI escape stripping
        send({ type: streamName, line: buf.replace(/\u001b\[[0-9;]*m/g, '') })
    } finally {
      reader.releaseLock()
    }
  }

  Promise.all([
    pipeStream(proc.stdout, 'stdout'),
    pipeStream(proc.stderr, 'stderr'),
  ])
    .then(async () => {
      const exitCode = await proc.exited
      send({ type: 'done', exitCode })
      wsProcs.delete(ws)
    })
    .catch((e) => {
      send({ type: 'error', message: String(e) })
      wsProcs.delete(ws)
    })
}
