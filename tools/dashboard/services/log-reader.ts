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
 * Returns parsed lines and the new byte offset.
 */
export function readNewLines(
  filePath: string,
  fromOffset: number,
): { lines: LogLine[]; newOffset: number } {
  if (!existsSync(filePath)) {
    return { lines: [], newOffset: fromOffset }
  }

  const stat = statSync(filePath)
  if (stat.size <= fromOffset) {
    return { lines: [], newOffset: fromOffset }
  }

  const fd = openSync(filePath, 'r')
  try {
    const bytesToRead = stat.size - fromOffset
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
    return { lines, newOffset: stat.size }
  } finally {
    closeSync(fd)
  }
}
