/**
 * Read-only display of the issue frontmatter fields (everything except `body`).
 *
 * Renders the fields as syntax-highlighted JSON using a lightweight inline
 * tokeniser rather than a full library — avoids adding a parse-time dependency.
 * Each token type gets a distinct colour via inline `<span>` elements.
 */
import type React from 'react'
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import type { Issue } from '@/types/schema/issue-schema'
import { TOKENS } from '@dashboard/frontend/tokens'

interface IssueMetadataProps {
  /** The issue whose frontmatter fields are displayed. */
  issue: Issue
}

/** Token categories for the inline syntax highlighter. */
type TokenKind =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punctuation'
  | 'text'

interface Token {
  kind: TokenKind
  value: string
}

/** Colour map for each token kind — tuned to the dark dashboard theme. */
const TOKEN_COLORS: Record<TokenKind, string> = {
  key: TOKENS.syntaxKey,
  string: TOKENS.syntaxString,
  number: TOKENS.syntaxNumber,
  boolean: TOKENS.syntaxBoolean,
  null: TOKENS.syntaxNull,
  punctuation: TOKENS.syntaxPunctuation,
  text: TOKENS.syntaxText,
}

/**
 * Naively tokenises a JSON string for syntax colouring.
 * Not a full parser — handles the subset produced by `JSON.stringify` with indent.
 *
 * @param json - Prettified JSON string.
 * @returns Array of tokens for rendering.
 */
function tokenise(json: string): Token[] {
  const tokens: Token[] = []
  // Split on a regex that captures the delimiter groups
  const parts = json.split(
    /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([[\]{},])/g,
  )

  for (const part of parts) {
    if (part === undefined || part === '') continue

    if (/^"[^"]*"\s*:$/.test(part)) {
      tokens.push({ kind: 'key', value: part })
    } else if (/^"/.test(part)) {
      tokens.push({ kind: 'string', value: part })
    } else if (part === 'true' || part === 'false') {
      tokens.push({ kind: 'boolean', value: part })
    } else if (part === 'null') {
      tokens.push({ kind: 'null', value: part })
    } else if (/^-?\d/.test(part)) {
      tokens.push({ kind: 'number', value: part })
    } else if (/^[[\]{},]$/.test(part)) {
      tokens.push({ kind: 'punctuation', value: part })
    } else {
      tokens.push({ kind: 'text', value: part })
    }
  }

  return tokens
}

/**
 * Renders issue frontmatter as syntax-highlighted JSON.
 *
 * @param issue - The issue to inspect.
 * @returns A scrollable `<pre>` block with coloured token spans.
 */
export function IssueMetadata({
  issue,
}: IssueMetadataProps): React.JSX.Element {
  const { body: _body, ...frontmatter } = issue
  const frontmatterJson = JSON.stringify(frontmatter, null, 2)

  const tokens = useMemo(() => {
    return tokenise(frontmatterJson)
  }, [frontmatterJson])

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        p: 1.5,
      }}
    >
      <Box
        component="pre"
        sx={{
          m: 0,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.75rem',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {tokens.map((token, idx) => (
          <span
            key={`${idx}-${token.kind}`}
            style={{ color: TOKEN_COLORS[token.kind] }}
          >
            {token.value}
          </span>
        ))}
      </Box>
    </Box>
  )
}
