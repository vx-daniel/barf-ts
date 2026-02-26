/**
 * Drag-to-resize handles for sidebar and bottom panel.
 *
 * Inserts thin divider elements and tracks mouse drag to update
 * CSS grid template sizes on #app.
 */

const MIN_SIDEBAR_W = 280
const MAX_SIDEBAR_W = 800
const MIN_BOTTOM_H = 100
const MAX_BOTTOM_H = 600

/** Mount sidebar resize handle (vertical bar between main and sidebar). */
export function mountSidebarResizer(): void {
  const app = document.getElementById('app')!
  const sidebar = document.getElementById('sidebar')!

  const handle = document.createElement('div')
  handle.id = 'resize-sidebar'
  handle.className = 'resize-handle resize-handle-v'
  sidebar.prepend(handle)

  let startX = 0
  let startW = 0

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    startX = e.clientX
    startW = sidebar.getBoundingClientRect().width

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      const newW = Math.min(MAX_SIDEBAR_W, Math.max(MIN_SIDEBAR_W, startW + delta))
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

/** Mount bottom panel resize handle (horizontal bar above bottom). */
export function mountBottomResizer(): void {
  const app = document.getElementById('app')!
  const bottom = document.getElementById('bottom')!

  const handle = document.createElement('div')
  handle.id = 'resize-bottom'
  handle.className = 'resize-handle resize-handle-h'
  bottom.prepend(handle)

  let startY = 0
  let startH = 0

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    startY = e.clientY
    startH = bottom.getBoundingClientRect().height

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY
      const newH = Math.min(MAX_BOTTOM_H, Math.max(MIN_BOTTOM_H, startH + delta))
      bottom.style.maxHeight = newH + 'px'
      bottom.style.height = newH + 'px'
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
