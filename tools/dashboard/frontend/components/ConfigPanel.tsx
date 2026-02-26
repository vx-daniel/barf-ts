/**
 * Config panel — Preact component rendering a form-based `.barfrc` editor in a
 * modal overlay. Replaces the imperative `panels/config.ts` implementation.
 */

import * as api from '@dashboard/frontend/lib/api-client'
import { configOpen } from '@dashboard/frontend/lib/state'
import { useEffect, useState } from 'preact/hooks'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'password'
  options?: string[]
  group: string
}

const FIELDS: FieldDef[] = [
  // Paths
  { key: 'issuesDir', label: 'Issues Directory', type: 'text', group: 'Paths' },
  { key: 'planDir', label: 'Plan Directory', type: 'text', group: 'Paths' },
  { key: 'barfDir', label: 'Barf Directory', type: 'text', group: 'Paths' },
  { key: 'promptDir', label: 'Prompt Directory', type: 'text', group: 'Paths' },
  {
    key: 'disableLogStream',
    label: 'Disable Stream Logging',
    type: 'boolean',
    group: 'Logging',
  },

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
]

/** Modal overlay for editing `.barfrc` configuration. */
export function ConfigPanel() {
  const isOpen = configOpen.value
  const [configData, setConfigData] = useState<Record<string, unknown>>({})
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [status, setStatus] = useState('')
  const [statusColor, setStatusColor] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setStatus('')
    setStatusColor('')
    api
      .fetchConfig()
      .then((data) => {
        setConfigData(data)
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
        setStatus(
          `Failed to load config: ${e instanceof Error ? e.message : String(e)}`,
        )
        setStatusColor('#ef4444')
      })
  }, [isOpen])

  function updateField(key: string, value: unknown) {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  function close() {
    configOpen.value = false
  }

  async function save() {
    const result: Record<string, unknown> = {}
    for (const field of FIELDS) {
      const val = formValues[field.key]
      if (field.type === 'boolean') {
        result[field.key] = Boolean(val)
      } else if (field.type === 'number') {
        result[field.key] = val === '' || val == null ? 0 : Number(val)
      } else if (field.type === 'password') {
        const strVal = String(val ?? '')
        if (
          strVal !== '' &&
          strVal !== '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'
        ) {
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

    try {
      setStatus('Saving...')
      setStatusColor('')
      await api.saveConfig(result)
      setStatus('Saved! Restart server to apply.')
      setStatusColor('#22c55e')
      setTimeout(() => {
        close()
        setStatus('')
        setStatusColor('')
      }, 1500)
    } catch (e: unknown) {
      setStatus(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
      setStatusColor('#ef4444')
    }
  }

  let configPath = ''
  if (configData.configPath) {
    configPath = String(configData.configPath)
  } else if (configData.projectCwd) {
    configPath = `${String(configData.projectCwd)}/.barfrc`
  }

  let currentGroup = ''

  return (
    <div
      id="config-ov"
      className={isOpen ? 'open' : ''}
      role="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close()
      }}
    >
      <div id="config-modal">
        <div id="config-header">
          <span>Configuration</span>
          <span id="config-path">{configPath}</span>
          <button type="button" id="config-close" onClick={close}>
            &times;
          </button>
        </div>
        <div id="config-body">
          {FIELDS.map((field) => {
            const nodes: preact.JSX.Element[] = []
            if (field.group !== currentGroup) {
              currentGroup = field.group
              nodes.push(
                <h3
                  key={`group-${field.group}`}
                  className="config-group-heading"
                >
                  {field.group}
                </h3>,
              )
            }

            const val = formValues[field.key]
            let input: preact.JSX.Element

            if (field.type === 'select' && field.options) {
              input = (
                <select
                  className="config-input"
                  id={`cfg-${field.key}`}
                  value={String(val ?? '')}
                  onChange={(e) =>
                    updateField(
                      field.key,
                      (e.target as HTMLSelectElement).value,
                    )
                  }
                >
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )
            } else if (field.type === 'boolean') {
              input = (
                <input
                  type="checkbox"
                  className="config-checkbox"
                  id={`cfg-${field.key}`}
                  checked={Boolean(val)}
                  onChange={(e) =>
                    updateField(
                      field.key,
                      (e.target as HTMLInputElement).checked,
                    )
                  }
                />
              )
            } else {
              const typeMap: Record<string, string> = {
                password: 'password',
                number: 'number',
              }
              const inputType = typeMap[field.type] ?? 'text'
              let placeholder: string | undefined
              if (field.type === 'password') {
                placeholder = configData[field.key]
                  ? '(set \u2014 leave blank to keep)'
                  : '(not set)'
              }
              input = (
                <input
                  type={inputType}
                  className="config-input"
                  id={`cfg-${field.key}`}
                  value={String(val ?? '')}
                  placeholder={placeholder}
                  autoComplete={field.type === 'password' ? 'off' : undefined}
                  onInput={(e) =>
                    updateField(field.key, (e.target as HTMLInputElement).value)
                  }
                />
              )
            }

            nodes.push(
              <div key={field.key} className="config-row">
                <label className="config-label" htmlFor={`cfg-${field.key}`}>
                  {field.label}
                </label>
                {input}
              </div>,
            )

            return nodes
          })}
        </div>
        <div id="config-footer">
          <span id="config-status" style={{ color: statusColor || undefined }}>
            {status}
          </span>
          <button type="button" className="mbtn" onClick={close}>
            Cancel
          </button>
          <button type="button" className="mbtn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
