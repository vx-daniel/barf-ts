/**
 * Drag-to-resize handles for sidebar and bottom panel.
 *
 * Inserts thin divider elements and tracks mouse drag to update
 * CSS grid template sizes on #app.
 *
 * Each resizer observes the DOM for its target element, mounting the drag
 * handle as soon as the element appears and cleaning up when it disappears.
 */

const MIN_SIDEBAR_W = 280
const MAX_SIDEBAR_W = 800
const MIN_BOTTOM_H = 100
const MAX_BOTTOM_H = 600

/**
 * Attaches a drag handle to `#sidebar` for horizontal resizing.
 * Safe to call before the sidebar exists — the handle is mounted lazily
 * via a {@link MutationObserver} and removed if the sidebar unmounts.
 */
export function mountSidebarResizer(): void {
  const HANDLE_ID = 'resize-sidebar'
  let mounted = false

  function attach() {
    const app = document.getElementById('app')
    const sidebar = document.getElementById('sidebar')
    if (!app || !sidebar || mounted) return
    if (document.getElementById(HANDLE_ID)) return

    const handle = document.createElement('div')
    handle.id = HANDLE_ID
    handle.className = 'resize-handle resize-handle-v'
    sidebar.prepend(handle)
    mounted = true

    let startX = 0
    let startW = 0

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      startX = e.clientX
      startW = sidebar.getBoundingClientRect().width

      const onMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX
        const newW = Math.min(
          MAX_SIDEBAR_W,
          Math.max(MIN_SIDEBAR_W, startW + delta),
        )
        app.style.gridTemplateColumns = `1fr ${newW}px`
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  function detach() {
    if (!mounted) return
    const handle = document.getElementById(HANDLE_ID)
    handle?.remove()
    mounted = false
  }

  // Try immediately, then watch #app for sidebar appear/disappear
  attach()
  const app = document.getElementById('app')
  if (app) {
    const observer = new MutationObserver(() => {
      const sidebar = document.getElementById('sidebar')
      if (sidebar && !mounted) attach()
      else if (!sidebar && mounted) detach()
    })
    observer.observe(app, { childList: true })
  }
}

/**
 * Attaches a drag handle to `#bottom` for vertical resizing.
 * Safe to call before the bottom panel exists — the handle is mounted lazily
 * via a {@link MutationObserver} and removed if the panel unmounts.
 */
export function mountBottomResizer(): void {
  const HANDLE_ID = 'resize-bottom'
  let mounted = false

  function attach() {
    const bottom = document.getElementById('bottom')
    if (!bottom || mounted) return
    if (document.getElementById(HANDLE_ID)) return

    const handle = document.createElement('div')
    handle.id = HANDLE_ID
    handle.className = 'resize-handle resize-handle-h'
    bottom.prepend(handle)
    mounted = true

    let startY = 0
    let startH = 0

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      startY = e.clientY
      startH = bottom.getBoundingClientRect().height

      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY
        const newH = Math.min(
          MAX_BOTTOM_H,
          Math.max(MIN_BOTTOM_H, startH + delta),
        )
        bottom.style.maxHeight = `${newH}px`
        bottom.style.height = `${newH}px`
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  function detach() {
    if (!mounted) return
    const handle = document.getElementById(HANDLE_ID)
    handle?.remove()
    mounted = false
  }

  attach()
  const app = document.getElementById('app')
  if (app) {
    const observer = new MutationObserver(() => {
      const bottom = document.getElementById('bottom')
      if (bottom && !mounted) attach()
      else if (!bottom && mounted) detach()
    })
    observer.observe(app, { childList: true })
  }
}
