/**
 * Markdown preview for the issue body.
 *
 * Converts the body field to HTML via `marked`, then strips event handlers and
 * `<script>` elements using the browser's `DOMParser` before injecting via
 * dangerouslySetInnerHTML. Content is trusted (local filesystem issues authored
 * by the operator), but we sanitize as defence-in-depth. The sanitizeHtml
 * function removes all `<script>` tags and `on*` event handler attributes.
 */
import type React from 'react'
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { marked } from 'marked'
import type { Issue } from '@/types/schema/issue-schema'
import { TOKENS } from '@dashboard/frontend/tokens'

interface IssuePreviewProps {
  /** The issue whose `body` field is rendered. */
  issue: Issue
}

/**
 * Sanitizes an HTML string by removing `<script>` tags and all inline event
 * handler attributes (`on*`). Uses `DOMParser` as the parsing engine, which
 * never executes scripts.
 *
 * @param html - Raw HTML string from `marked`.
 * @returns Sanitized HTML string.
 */
function sanitizeHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll('script').forEach((el) => {
    el.remove()
  })

  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
      }
    })
  })

  return doc.body.innerHTML
}

/**
 * Renders the issue body as sanitized HTML markdown.
 *
 * @param issue - The issue to preview.
 * @returns A scrollable Box containing the rendered markdown.
 */
export function IssuePreview({ issue }: IssuePreviewProps): React.JSX.Element {
  // Content is operator-authored local issue files; sanitized as defence-in-depth.
  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
  const sanitizedHtml = useMemo(() => {
    const raw = marked(issue.body ?? '', { async: false }) as string
    return sanitizeHtml(raw)
  }, [issue.body])

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        px: 2,
        py: 1.5,
        fontSize: '0.8125rem',
        lineHeight: 1.65,
        color: 'text.primary',
        '& h1, & h2, & h3, & h4': {
          fontWeight: 600,
          mt: 2,
          mb: 0.75,
          color: 'text.primary',
        },
        '& h1': { fontSize: '1rem' },
        '& h2': { fontSize: '0.9375rem' },
        '& h3': { fontSize: '0.875rem' },
        '& p': { mt: 0, mb: 1 },
        '& ul, & ol': { pl: 2.5, mb: 1 },
        '& li': { mb: 0.25 },
        '& code': {
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.75rem',
          backgroundColor: TOKENS.surfaceCodeInline,
          px: 0.5,
          py: 0.125,
          borderRadius: 0.5,
        },
        '& pre': {
          backgroundColor: TOKENS.surfaceCodeBlock,
          borderRadius: 1,
          p: 1.5,
          overflow: 'auto',
          mb: 1,
          '& code': {
            backgroundColor: 'transparent',
            px: 0,
            py: 0,
          },
        },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'divider',
          ml: 0,
          pl: 1.5,
          color: 'text.secondary',
        },
        '& a': { color: 'primary.main' },
        '& hr': { borderColor: 'divider', my: 1.5 },
        '& table': {
          borderCollapse: 'collapse',
          width: '100%',
          mb: 1,
          fontSize: '0.75rem',
        },
        '& th, & td': {
          border: '1px solid',
          borderColor: 'divider',
          px: 1,
          py: 0.5,
        },
        '& th': { backgroundColor: TOKENS.surfaceTableHeader, fontWeight: 600 },
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized via DOMParser (scripts + on* attrs stripped)
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
