/**
 * MarkdownPreview — reusable rendered markdown viewer.
 *
 * Parses markdown via `marked`, sanitizes the output (strips inline event
 * handlers and `<script>` tags), and renders into a styled container.
 * Used by IssuePanel (issue body, plan) and PromptsPanel (prompt templates).
 */

import { marked } from 'marked'
import { useEffect, useRef } from 'preact/hooks'

function sanitizeDoc(doc: Document): void {
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    }
  }
  for (const script of Array.from(doc.body.querySelectorAll('script'))) {
    script.remove()
  }
}

function safeRenderHTML(container: HTMLElement, htmlString: string): void {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')
  sanitizeDoc(doc)
  container.textContent = ''
  while (doc.body.firstChild) {
    container.appendChild(doc.body.firstChild)
  }
}

interface MarkdownPreviewProps {
  /** Markdown source string to render. */
  content: string
  /** Extra class names appended to the container div. */
  className?: string
  /** When false/undefined the container is hidden via `display: none`. */
  visible?: boolean
  /** Optional id for the container element. */
  id?: string
}

export function MarkdownPreview({
  content,
  className = '',
  visible = true,
  id,
}: MarkdownPreviewProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible || !ref.current) return
    const htmlString = marked.parse(content) as string
    safeRenderHTML(ref.current, htmlString)
  }, [content, visible])

  return (
    <div
      id={id}
      ref={ref}
      className={`markdown-preview flex-1 overflow-y-auto px-3xl py-2xl text-base leading-[1.7] ${className}`}
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
