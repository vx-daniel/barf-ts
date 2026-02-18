import type { IssueProvider } from '@/core/issue-providers/base'
import type { Config } from '@/types/index'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { mkdirSync, writeFileSync, existsSync } from 'fs'

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
    console.info(`Created ${config.issuesDir}/ and ${config.planDir}/`)
  }

  if (config.issueProvider === 'github') {
    console.info(`Creating barf:* labels in ${config.githubRepo}...`)
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
        console.error(`  ✗ ${label.name}: ${result.stderr.trim()}`)
      } else {
        console.info(`  ✓ ${label.name}`)
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
    console.info('Created .barfrc')
  }

  console.info('\nDone. Next: barf plan --issue=001')
}
