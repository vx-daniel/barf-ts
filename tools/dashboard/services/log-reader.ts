/**
 * JSONL tail reader — tracks byte offset to stream new lines from log files.
 *
 * Used by the activity log SSE endpoint to tail `{streamLogDir}/{issueId}.jsonl`.
 */
import { closeSync, existsSync, openSync, readSync, statSync } from 'fs'

export interface LogLine {
  offset: number
  data: unknown
}

/**
 * Reads new JSONL lines from `filePath` starting at `fromOffset`.
 * When `toOffset` is provided, reads only up to that byte position
 * (used for session-scoped reads).
 * Returns parsed lines and the new byte offset.
 */
export function readNewLines(
  filePath: string,
  fromOffset: number,
  toOffset?: number,
): { lines: LogLine[]; newOffset: number } {
  if (!existsSync(filePath)) {
    return { lines: [], newOffset: fromOffset }
  }

  const stat = statSync(filePath)
  const endOffset =
    toOffset !== undefined ? Math.min(toOffset, stat.size) : stat.size
  if (endOffset <= fromOffset) {
    return { lines: [], newOffset: fromOffset }
  }

  const fd = openSync(filePath, 'r')
  try {
    const bytesToRead = endOffset - fromOffset
    const buf = Buffer.alloc(bytesToRead)
    readSync(fd, buf, 0, bytesToRead, fromOffset)
    const text = buf.toString('utf8')
    const rawLines = text.split('\n').filter((l) => l.trim().length > 0)
    const lines: LogLine[] = []
    let currentOffset = fromOffset
    for (const raw of rawLines) {
      try {
        const data = JSON.parse(raw)
        lines.push({ offset: currentOffset, data })
      } catch {
        // skip malformed lines
      }
      currentOffset += Buffer.byteLength(`${raw}\n`, 'utf8')
    }
    return { lines, newOffset: endOffset }
  } finally {
    closeSync(fd)
  }
}
