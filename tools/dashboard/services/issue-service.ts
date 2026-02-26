/**
 * Dashboard issue service — wraps {@link LocalIssueProvider} and {@link Config}
 * so route handlers receive a single dependency instead of scattered globals.
 */
import { resolve, join } from 'path'
import { loadConfig } from '@/core/config'
import { LocalIssueProvider } from '@/core/issue/providers/local'
import type { Config } from '@/types'

export interface IssueServiceInit {
  projectCwd: string
  configPath: string | undefined
}

export class IssueService {
  readonly provider: LocalIssueProvider
  readonly config: Config
  readonly projectCwd: string
  readonly configPath: string | undefined
  readonly issuesDir: string
  readonly barfDir: string

  constructor(init: IssueServiceInit) {
    this.projectCwd = init.projectCwd
    this.configPath = init.configPath
    this.config = loadConfig(
      init.configPath ?? join(init.projectCwd, '.barfrc'),
    )
    this.issuesDir = resolve(init.projectCwd, this.config.issuesDir)
    this.barfDir = resolve(init.projectCwd, this.config.barfDir)
    this.provider = new LocalIssueProvider(this.issuesDir, this.barfDir)
  }
}
