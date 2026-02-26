/**
 * Config panel — form-based .barfrc editor rendered in a modal overlay.
 */
import * as api from '../lib/api-client'

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
  { key: 'disableLogStream', label: 'Disable Stream Logging', type: 'boolean', group: 'Logging' },

  // Orchestration
  { key: 'contextUsagePercent', label: 'Context Usage %', type: 'number', group: 'Orchestration' },
  { key: 'maxAutoSplits', label: 'Max Auto Splits', type: 'number', group: 'Orchestration' },
  { key: 'maxVerifyRetries', label: 'Max Verify Retries', type: 'number', group: 'Orchestration' },
  { key: 'maxIterations', label: 'Max Iterations (0=unlimited)', type: 'number', group: 'Orchestration' },
  { key: 'claudeTimeout', label: 'Claude Timeout (seconds)', type: 'number', group: 'Orchestration' },

  // Models
  { key: 'planModel', label: 'Plan Model', type: 'text', group: 'Models' },
  { key: 'buildModel', label: 'Build Model', type: 'text', group: 'Models' },
  { key: 'splitModel', label: 'Split Model', type: 'text', group: 'Models' },
  { key: 'extendedContextModel', label: 'Extended Context Model', type: 'text', group: 'Models' },
  { key: 'triageModel', label: 'Triage Model', type: 'text', group: 'Models' },

  // Audit
  { key: 'auditProvider', label: 'Audit Provider', type: 'select', options: ['openai', 'gemini', 'claude', 'codex'], group: 'Audit' },
  { key: 'auditModel', label: 'Audit Model', type: 'text', group: 'Audit' },
  { key: 'claudeAuditModel', label: 'Claude Audit Model', type: 'text', group: 'Audit' },
  { key: 'geminiModel', label: 'Gemini Model', type: 'text', group: 'Audit' },
  { key: 'openaiApiKey', label: 'OpenAI API Key', type: 'password', group: 'Audit' },
  { key: 'geminiApiKey', label: 'Gemini API Key', type: 'password', group: 'Audit' },
  { key: 'anthropicApiKey', label: 'Anthropic API Key', type: 'password', group: 'Audit' },

  // Testing & Git
  { key: 'testCommand', label: 'Test Command', type: 'text', group: 'Testing & Git' },
  { key: 'fixCommands', label: 'Fix Commands (comma-separated)', type: 'text', group: 'Testing & Git' },
  { key: 'pushStrategy', label: 'Push Strategy', type: 'select', options: ['iteration', 'on_complete', 'manual'], group: 'Testing & Git' },

  // Provider
  { key: 'issueProvider', label: 'Issue Provider', type: 'select', options: ['local', 'github'], group: 'Provider' },
  { key: 'githubRepo', label: 'GitHub Repo (owner/repo)', type: 'text', group: 'Provider' },

  // Logging
  { key: 'logFile', label: 'Log File', type: 'text', group: 'Logging' },
  { key: 'logLevel', label: 'Log Level', type: 'select', options: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'], group: 'Logging' },
  { key: 'logPretty', label: 'Pretty Logs', type: 'boolean', group: 'Logging' },
]

let configData: Record<string, unknown> = {}

function renderForm(container: HTMLElement, data: Record<string, unknown>): void {
  container.textContent = ''
  let currentGroup = ''

  for (const field of FIELDS) {
    if (field.group !== currentGroup) {
      currentGroup = field.group
      const heading = document.createElement('h3')
      heading.className = 'config-group-heading'
      heading.textContent = currentGroup
      container.appendChild(heading)
    }

    const row = document.createElement('div')
    row.className = 'config-row'

    const label = document.createElement('label')
    label.className = 'config-label'
    label.textContent = field.label
    label.setAttribute('for', `cfg-${field.key}`)
    row.appendChild(label)

    const val = data[field.key]

    if (field.type === 'select' && field.options) {
      const select = document.createElement('select')
      select.className = 'config-input'
      select.id = `cfg-${field.key}`
      select.dataset.key = field.key
      for (const opt of field.options) {
        const option = document.createElement('option')
        option.value = opt
        option.textContent = opt
        if (String(val) === opt) option.selected = true
        select.appendChild(option)
      }
      row.appendChild(select)
    } else if (field.type === 'boolean') {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'config-checkbox'
      checkbox.id = `cfg-${field.key}`
      checkbox.dataset.key = field.key
      checkbox.checked = val === true || val === 'true' || val === '1'
      row.appendChild(checkbox)
    } else {
      const input = document.createElement('input')
      input.type = field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'
      input.className = 'config-input'
      input.id = `cfg-${field.key}`
      input.dataset.key = field.key
      if (field.key === 'fixCommands' && Array.isArray(val)) {
        input.value = val.join(', ')
      } else {
        input.value = val != null ? String(val) : ''
      }
      if (field.type === 'password') {
        input.placeholder = val ? '(set — leave blank to keep)' : '(not set)'
        input.autocomplete = 'off'
      }
      row.appendChild(input)
    }

    container.appendChild(row)
  }
}

function collectForm(): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of FIELDS) {
    const el = document.getElementById(`cfg-${field.key}`)
    if (!el) continue

    if (field.type === 'boolean') {
      result[field.key] = (el as HTMLInputElement).checked
    } else if (field.type === 'number') {
      const val = (el as HTMLInputElement).value
      result[field.key] = val === '' ? 0 : Number(val)
    } else if (field.type === 'password') {
      const val = (el as HTMLInputElement).value
      // Only send if changed — empty means keep existing (masked) value
      if (val && val !== '••••••••') {
        result[field.key] = val
      } else {
        result[field.key] = configData[field.key] // send back masked value
      }
    } else if (field.key === 'fixCommands') {
      const val = (el as HTMLInputElement).value
      result[field.key] = val.split(',').map((s: string) => s.trim()).filter(Boolean)
    } else if (field.type === 'select') {
      result[field.key] = (el as HTMLSelectElement).value
    } else {
      result[field.key] = (el as HTMLInputElement).value
    }
  }
  return result
}

export function initConfigPanel(): void {
  const overlay = document.getElementById('config-ov')!
  const body = document.getElementById('config-body')!
  const status = document.getElementById('config-status')!

  document.getElementById('btn-config')?.addEventListener('click', async () => {
    status.textContent = ''
    try {
      configData = await api.fetchConfig()
      document.getElementById('config-path')!.textContent = configData.configPath
        ? String(configData.configPath)
        : String(configData.projectCwd) + '/.barfrc'
      renderForm(body, configData)
      overlay.classList.add('open')
    } catch (e) {
      console.error('Failed to load config:', e)
    }
  })

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open')
  })

  document.getElementById('config-close')?.addEventListener('click', () => {
    overlay.classList.remove('open')
  })

  document.getElementById('config-cancel')?.addEventListener('click', () => {
    overlay.classList.remove('open')
  })

  document.getElementById('config-save')?.addEventListener('click', async () => {
    const values = collectForm()
    try {
      status.textContent = 'Saving...'
      await api.saveConfig(values)
      status.textContent = 'Saved! Restart server to apply.'
      status.style.color = '#22c55e'
      setTimeout(() => {
        overlay.classList.remove('open')
        status.textContent = ''
        status.style.color = ''
      }, 1500)
    } catch (e) {
      status.textContent = 'Save failed: ' + (e instanceof Error ? e.message : String(e))
      status.style.color = '#ef4444'
    }
  })
}
