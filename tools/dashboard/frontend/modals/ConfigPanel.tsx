/**
 * Config panel — MUI Dialog for editing the project `.barfrc` configuration.
 *
 * Controlled by {@link useUIStore.configOpen}. Loads current config from the
 * API on open, groups fields by category, and serialises form values back on
 * save. Password fields preserve the existing server-side value when left
 * blank. The `fixCommands` field is serialised as a comma-separated string in
 * the form and split back to an array on save.
 */
import type React from 'react'
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useUIStore } from '@dashboard/frontend/store/useUIStore'
import * as api from '@dashboard/frontend/common/utils/api-client'
import { TOKENS } from '@dashboard/frontend/tokens'

/** Supported field input types. */
type FieldType = 'text' | 'number' | 'select' | 'boolean' | 'password'

interface FieldDef {
  /** `.barfrc` key used for both storage and form identity. */
  key: string
  /** Human-readable label shown in the form. */
  label: string
  /** Determines the input widget rendered. */
  type: FieldType
  /** Available choices for `select` fields. */
  options?: string[]
  /** Section heading used to group related fields. */
  group: string
}

/** Complete field manifest for the `.barfrc` config editor. */
const FIELDS: FieldDef[] = [
  // Paths
  { key: 'issuesDir', label: 'Issues Directory', type: 'text', group: 'Paths' },
  { key: 'planDir', label: 'Plan Directory', type: 'text', group: 'Paths' },
  { key: 'barfDir', label: 'Barf Directory', type: 'text', group: 'Paths' },
  { key: 'promptDir', label: 'Prompt Directory', type: 'text', group: 'Paths' },

  // Orchestration
  {
    key: 'contextUsagePercent',
    label: 'Context Usage %',
    type: 'number',
    group: 'Orchestration',
  },
  {
    key: 'maxAutoSplits',
    label: 'Max Auto Splits',
    type: 'number',
    group: 'Orchestration',
  },
  {
    key: 'maxVerifyRetries',
    label: 'Max Verify Retries',
    type: 'number',
    group: 'Orchestration',
  },
  {
    key: 'maxIterations',
    label: 'Max Iterations (0=unlimited)',
    type: 'number',
    group: 'Orchestration',
  },
  {
    key: 'claudeTimeout',
    label: 'Claude Timeout (seconds)',
    type: 'number',
    group: 'Orchestration',
  },

  // Models
  { key: 'planModel', label: 'Plan Model', type: 'text', group: 'Models' },
  { key: 'buildModel', label: 'Build Model', type: 'text', group: 'Models' },
  { key: 'splitModel', label: 'Split Model', type: 'text', group: 'Models' },
  {
    key: 'extendedContextModel',
    label: 'Extended Context Model',
    type: 'text',
    group: 'Models',
  },
  { key: 'triageModel', label: 'Triage Model', type: 'text', group: 'Models' },

  // Audit
  {
    key: 'auditProvider',
    label: 'Audit Provider',
    type: 'select',
    options: ['openai', 'gemini', 'claude'],
    group: 'Audit',
  },
  { key: 'auditModel', label: 'Audit Model', type: 'text', group: 'Audit' },
  {
    key: 'claudeAuditModel',
    label: 'Claude Audit Model',
    type: 'text',
    group: 'Audit',
  },
  { key: 'geminiModel', label: 'Gemini Model', type: 'text', group: 'Audit' },
  {
    key: 'openaiApiKey',
    label: 'OpenAI API Key',
    type: 'password',
    group: 'Audit',
  },
  {
    key: 'geminiApiKey',
    label: 'Gemini API Key',
    type: 'password',
    group: 'Audit',
  },
  {
    key: 'anthropicApiKey',
    label: 'Anthropic API Key',
    type: 'password',
    group: 'Audit',
  },

  // Testing & Git
  {
    key: 'testCommand',
    label: 'Test Command',
    type: 'text',
    group: 'Testing & Git',
  },
  {
    key: 'fixCommands',
    label: 'Fix Commands (comma-separated)',
    type: 'text',
    group: 'Testing & Git',
  },
  {
    key: 'pushStrategy',
    label: 'Push Strategy',
    type: 'select',
    options: ['none', 'auto', 'pr'],
    group: 'Testing & Git',
  },

  // Provider
  {
    key: 'issueProvider',
    label: 'Issue Provider',
    type: 'select',
    options: ['local', 'github'],
    group: 'Provider',
  },
  {
    key: 'githubRepo',
    label: 'GitHub Repo (owner/repo)',
    type: 'text',
    group: 'Provider',
  },

  // Logging
  { key: 'logFile', label: 'Log File', type: 'text', group: 'Logging' },
  {
    key: 'logLevel',
    label: 'Log Level',
    type: 'select',
    options: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
    group: 'Logging',
  },
  { key: 'logPretty', label: 'Pretty Logs', type: 'boolean', group: 'Logging' },
  {
    key: 'disableLogStream',
    label: 'Disable Stream Logging',
    type: 'boolean',
    group: 'Logging',
  },
]

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Configuration editor dialog.
 *
 * Loads config on open, groups fields by {@link FieldDef.group}, and serialises
 * form values on save. Password fields with blank values retain the existing
 * server-side secret. The `fixCommands` array is presented and edited as a
 * comma-separated string.
 *
 * @returns Always-mounted MUI Dialog controlled by `open` prop.
 */
export function ConfigPanel(): React.JSX.Element {
  const isOpen = useUIStore((s) => s.configOpen)
  const closeConfig = useUIStore((s) => s.closeConfig)

  const [configData, setConfigData] = useState<Record<string, unknown>>({})
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  // Load config when the dialog opens
  useEffect(() => {
    if (!isOpen) return
    setSaveStatus('idle')
    setStatusMessage('')

    api
      .fetchConfig()
      .then((data) => {
        setConfigData(data as Record<string, unknown>)
        const initial: Record<string, unknown> = {}
        for (const field of FIELDS) {
          const val = (data as Record<string, unknown>)[field.key]
          if (field.key === 'fixCommands' && Array.isArray(val)) {
            initial[field.key] = val.join(', ')
          } else if (field.type === 'boolean') {
            initial[field.key] = val === true || val === 'true' || val === '1'
          } else {
            initial[field.key] = val != null ? val : ''
          }
        }
        setFormValues(initial)
      })
      .catch((e: unknown) => {
        setSaveStatus('error')
        setStatusMessage(
          `Failed to load config: ${e instanceof Error ? e.message : String(e)}`,
        )
      })
  }, [isOpen])

  function updateField(key: string, value: unknown): void {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(): Promise<void> {
    const result: Record<string, unknown> = {}
    for (const field of FIELDS) {
      const val = formValues[field.key]
      if (field.type === 'boolean') {
        result[field.key] = Boolean(val)
      } else if (field.type === 'number') {
        result[field.key] = val === '' || val == null ? 0 : Number(val)
      } else if (field.type === 'password') {
        const strVal = String(val ?? '')
        // Preserve server-side value when the field is blank or unchanged
        if (strVal !== '' && strVal !== '••••••••') {
          result[field.key] = strVal
        } else {
          result[field.key] = configData[field.key]
        }
      } else if (field.key === 'fixCommands') {
        result[field.key] = String(val ?? '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      } else {
        result[field.key] = val
      }
    }

    setSaveStatus('saving')
    setStatusMessage('Saving…')

    try {
      await api.saveConfig(result)
      setSaveStatus('saved')
      setStatusMessage('Saved! Restart server to apply.')
      setTimeout(() => {
        closeConfig()
        setSaveStatus('idle')
        setStatusMessage('')
      }, 1500)
    } catch (e: unknown) {
      setSaveStatus('error')
      setStatusMessage(
        `Save failed: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  let configPath: string
  if (configData.configPath) {
    configPath = String(configData.configPath)
  } else if (configData.projectCwd) {
    configPath = `${String(configData.projectCwd)}/.barfrc`
  } else {
    configPath = ''
  }

  const STATUS_COLORS: Record<string, string> = {
    saved: TOKENS.statusSaved,
    error: TOKENS.statusCrashed,
  }
  const statusColor = STATUS_COLORS[saveStatus] ?? 'text.secondary'

  // Render fields grouped under section headers
  let currentGroup = ''
  const fieldNodes: React.ReactNode[] = []

  for (const field of FIELDS) {
    if (field.group !== currentGroup) {
      currentGroup = field.group
      fieldNodes.push(
        <Box key={`group-${field.group}`}>
          {fieldNodes.length > 0 && <Divider sx={{ my: 1.5 }} />}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'primary.main',
              fontWeight: 600,
              mb: 1,
            }}
          >
            {field.group}
          </Typography>
        </Box>,
      )
    }

    const val = formValues[field.key]
    let inputNode: React.ReactNode

    if (field.type === 'select' && field.options) {
      inputNode = (
        <Select
          size="small"
          value={String(val ?? '')}
          onChange={(e) => updateField(field.key, e.target.value)}
          sx={{ flex: 1, fontSize: '0.75rem' }}
          inputProps={{ 'aria-label': field.label }}
        >
          {field.options.map((opt) => (
            <MenuItem key={opt} value={opt} sx={{ fontSize: '0.75rem' }}>
              {opt}
            </MenuItem>
          ))}
        </Select>
      )
    } else if (field.type === 'boolean') {
      inputNode = (
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={Boolean(val)}
              onChange={(e) => updateField(field.key, e.target.checked)}
            />
          }
          label=""
          sx={{ m: 0, flex: 1 }}
        />
      )
    } else {
      const isPassword = field.type === 'password'
      let placeholder: string | undefined
      if (isPassword) {
        placeholder = configData[field.key]
          ? '(set \u2014 leave blank to keep)'
          : '(not set)'
      }
      const INPUT_TYPES: Record<string, string> = {
        password: 'password',
        number: 'number',
      }
      const inputType = INPUT_TYPES[field.type] ?? 'text'

      inputNode = (
        <TextField
          size="small"
          type={inputType}
          value={String(val ?? '')}
          onChange={(e) => updateField(field.key, e.target.value)}
          placeholder={placeholder}
          autoComplete={isPassword ? 'off' : undefined}
          sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
          inputProps={{ 'aria-label': field.label }}
        />
      )
    }

    fieldNodes.push(
      <Box
        key={field.key}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 0.75,
        }}
      >
        <Typography
          component="label"
          variant="body2"
          sx={{
            color: 'text.secondary',
            minWidth: 180,
            flexShrink: 0,
            fontSize: '0.75rem',
          }}
        >
          {field.label}
        </Typography>
        {inputNode}
      </Box>,
    )
  }

  return (
    <Dialog
      open={isOpen}
      onClose={() => {
        if (saveStatus !== 'saving') closeConfig()
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          maxWidth: 600,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
          Configuration
        </Typography>
        {configPath && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {configPath}
          </Typography>
        )}
        <Button
          size="small"
          variant="text"
          onClick={closeConfig}
          sx={{ ml: 'auto', minWidth: 0, px: 0.5, color: 'text.secondary' }}
        >
          ✕
        </Button>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
        {fieldNodes}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{ flex: 1, color: statusColor, fontSize: '0.75rem' }}
        >
          {statusMessage}
        </Typography>
        <Button
          variant="text"
          onClick={closeConfig}
          disabled={saveStatus === 'saving'}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
