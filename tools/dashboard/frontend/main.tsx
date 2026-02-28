import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from '@dashboard/frontend/theme'
import { App } from '@dashboard/frontend/App'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { useSessionStore } from '@dashboard/frontend/store/useSessionStore'
import { useConfigStore } from '@dashboard/frontend/store/useConfigStore'

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- root element guaranteed by index.html
const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')
const root = createRoot(rootEl)
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>,
)

// Initial data fetch
void useIssueStore.getState().fetchIssues()
void useSessionStore.getState().fetchSessions()
void useConfigStore.getState().fetchConfig()
void useConfigStore.getState().fetchAuditGate()

// Polling: 5s interval
setInterval(() => {
  void useSessionStore.getState().fetchSessions()
  const { pauseRefresh } = useIssueStore.getState()
  if (!pauseRefresh) {
    void useIssueStore.getState().fetchIssues()
    void useConfigStore.getState().fetchAuditGate()
  }
}, 5000)
