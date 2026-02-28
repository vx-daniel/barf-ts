/**
 * MUI theme for the barf dashboard.
 *
 * Dark mode with state-lifecycle colours matching the original DaisyUI theme.
 * All state colours are available via `theme.palette.state.*` for consistent
 * usage across components.
 */
import { createTheme, type ThemeOptions } from '@mui/material/styles'

/** Issue-state palette — mirrors the original CSS custom properties. */
export const STATE_PALETTE = {
  new: '#64748b',
  groomed: '#6366f1',
  planned: '#8b5cf6',
  inProgress: '#f59e0b',
  completed: '#84cc16',
  verified: '#22c55e',
  stuck: '#ef4444',
  split: '#a855f7',
} as const

/** Command accent colours for action buttons. */
export const CMD_PALETTE = {
  plan: '#8b5cf6',
  build: '#f59e0b',
  audit: '#22c55e',
  triage: '#6366f1',
  interview: '#ec4899',
} as const

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: { main: '#a78bfa' },
    secondary: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    success: { main: '#22c55e' },
    background: {
      default: '#0d0d1a',
      paper: '#1a1a2e',
    },
    text: {
      primary: '#e2e8f0',
      secondary: '#94a3b8',
    },
    divider: 'rgba(148, 163, 184, 0.12)',
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 13,
    h6: { fontSize: '0.875rem', fontWeight: 600 },
    body2: { fontSize: '0.75rem' },
    caption: { fontSize: '0.6875rem' },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0d0d1a',
          color: '#e2e8f0',
          overflow: 'hidden',
          height: '100vh',
        },
        '#root': {
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        },
        '*::-webkit-scrollbar': { width: 6, height: 6 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          background: 'rgba(148, 163, 184, 0.2)',
          borderRadius: 3,
        },
        // Monospace for code areas
        'code, pre, .mono': {
          fontFamily:
            '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1a1a2e',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: '0.6875rem' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a2e',
          borderLeft: '1px solid rgba(148, 163, 184, 0.12)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0d0d1a',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
        },
      },
    },
    MuiButton: {
      defaultProps: { size: 'small', disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' },
      },
    },
    MuiIconButton: {
      defaultProps: { size: 'small' },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', minHeight: 36, fontSize: '0.75rem' },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 36 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: '#1a1a2e' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 4, borderRadius: 2 },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 400 },
      styleOverrides: {
        tooltip: { fontSize: '0.6875rem' },
      },
    },
  },
}

export const theme = createTheme(themeOptions)
