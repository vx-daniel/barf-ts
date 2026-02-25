import { describe, it, expect } from 'bun:test'
import { createIssueProvider } from '@/core/issue/factory'
import { LocalIssueProvider } from '@/core/issue/providers/local'
import { GitHubIssueProvider } from '@/core/issue/providers/github'
import { ConfigSchema } from '@/types/index'

const defaultConfig = () => ConfigSchema.parse({})

describe('createIssueProvider', () => {
  it('returns LocalIssueProvider by default', () => {
    const result = createIssueProvider(defaultConfig())
    expect(result._unsafeUnwrap()).toBeInstanceOf(LocalIssueProvider)
  })

  it('returns GitHubIssueProvider when issueProvider=github', () => {
    const config = ConfigSchema.parse({
      issueProvider: 'github',
      githubRepo: 'owner/repo',
    })
    const result = createIssueProvider(config)
    expect(result._unsafeUnwrap()).toBeInstanceOf(GitHubIssueProvider)
  })

  it('returns Err when github is selected but GITHUB_REPO is missing', () => {
    const config = ConfigSchema.parse({ issueProvider: 'github' })
    const result = createIssueProvider(config)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('GITHUB_REPO required')
  })
})
