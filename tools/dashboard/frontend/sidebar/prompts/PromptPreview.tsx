/**
 * Rendered markdown preview for a prompt template.
 * Content is sanitized by stripping event handlers and script elements
 * before rendering, matching the same approach used in IssuePreview.
 */
import type React from 'react'
import { useMemo, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import { marked } from 'marked'
import { TOKENS } from '@dashboard/frontend/tokens'

interface PromptPreviewProps {
  content: string
}

/** Strips event handlers and scripts from a parsed document. */
function sanitizeAndAppend(container: HTMLElement, htmlString: string): void {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    }
  }
  for (const script of Array.from(doc.body.querySelectorAll('script'))) {
    script.remove()
  }
  container.textContent = ''
  while (doc.body.firstChild) {
    container.appendChild(doc.body.firstChild)
  }
}

export function PromptPreview({
  content,
}: PromptPreviewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const html = useMemo(() => marked.parse(content) as string, [content])

  useEffect(() => {
    if (containerRef.current) {
      sanitizeAndAppend(containerRef.current, html)
    }
  }, [html])

  return (
    <Box
      ref={containerRef}
      sx={{
        p: 2,
        fontSize: '0.75rem',
        lineHeight: 1.7,
        '& pre': {
          backgroundColor: TOKENS.surfaceOverlayDark,
          p: 1,
          borderRadius: 1,
          overflow: 'auto',
          fontSize: '0.6875rem',
        },
        '& code': { fontFamily: 'monospace', fontSize: '0.6875rem' },
        '& h1,& h2,& h3': { mt: 2, mb: 1 },
        '& p': { mb: 1 },
      }}
    />
  )
}
