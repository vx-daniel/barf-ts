import type { IssueProvider } from '@/core/issue-providers/base'
import type { Config } from '@/types/index'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'
import { mkdirSync, writeFileSync, existsSync } from 'fs'

const logger = createLogger('init')

const BARF_LABELS = [
  { name: 'barf:new', color: 'e4e669', description: 'Issue not yet planned' },
  { name: 'barf:planned', color: 'bfd4f2', description: 'Issue planned, ready for build' },
  { name: 'barf:in-progress', color: 'fef2c0', description: 'Issue being worked on by barf' },
  { name: 'barf:stuck', color: 'e11d48', description: 'Issue blocked, needs intervention' },
  { name: 'barf:split', color: 'c5def5', description: 'Issue split into child issues' },
  { name: 'barf:completed', color: '0e8a16', description: 'Issue complete' },
  { name: 'barf:locked', color: 'd93f0b', description: 'Issue currently being processed' }
]

export async function initCommand(_provider: IssueProvider, config: Config): Promise<void> {
  if (config.issueProvider === 'local') {
    mkdirSync(config.issuesDir, { recursive: true })
    mkdirSync(config.planDir, { recursive: true })
    logger.info({ issuesDir: config.issuesDir, planDir: config.planDir }, 'Directories created')
  }

  if (config.issueProvider === 'github') {
    logger.info({ repo: config.githubRepo }, 'Creating barf:* labels')
    for (const label of BARF_LABELS) {
      const result = await execFileNoThrow('gh', [
        'api',
        '--method',
        'POST',
        `/repos/${config.githubRepo}/labels`,
        '-f',
        `name=${label.name}`,
        '-f',
        `color=${label.color}`,
        '-f',
        `description=${label.description}`
      ])
      const alreadyExists =
        result.stderr.includes('already_exists') || result.stdout.includes('already_exists')
      if (result.status !== 0 && !alreadyExists) {
        logger.error({ label: label.name, stderr: result.stderr.trim() }, 'Label creation failed')
      } else {
        logger.info({ label: label.name }, 'Label created')
      }
    }
  }

  if (!existsSync('.barfrc')) {
    const lines = [
      '# barf configuration',
      `ISSUE_PROVIDER=${config.issueProvider}`,
      config.issueProvider === 'github' ? `GITHUB_REPO=${config.githubRepo}` : '',
      'PLAN_MODEL=claude-opus-4-6',
      'BUILD_MODEL=claude-sonnet-4-6',
      'CONTEXT_USAGE_PERCENT=75'
    ].filter(Boolean)
    writeFileSync('.barfrc', lines.join('\n') + '\n')
    logger.info('Created .barfrc')
  }

  logger.info('Done. Next: barf plan --issue=001')
}
