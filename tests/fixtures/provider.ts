import { errAsync, okAsync } from 'neverthrow'
import type { IssueProvider } from '@/core/issue/base'
import type { Issue, Config } from '@/types'
import { ConfigSchema } from '@/types'

/** Creates a default Config by parsing an empty object through the schema. */
export const defaultConfig = (): Config => ConfigSchema.parse({})

/** Creates a test Issue with sensible defaults, overrideable per-field. */
export function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: '001',
    title: 'Test issue',
    state: 'NEW',
    parent: '',
    children: [],
    split_count: 0,
    force_split: false,
    body: '',
    ...overrides
  }
}

/** Stub provider where every method returns `err('not implemented')` by default. */
export function makeProvider(overrides: Partial<IssueProvider> = {}): IssueProvider {
  return {
    listIssues: () => errAsync(new Error('not implemented')),
    fetchIssue: () => errAsync(new Error('not implemented')),
    createIssue: () => errAsync(new Error('not implemented')),
    writeIssue: () => errAsync(new Error('not implemented')),
    deleteIssue: () => errAsync(new Error('not implemented')),
    lockIssue: () => errAsync(new Error('not implemented')),
    unlockIssue: () => errAsync(new Error('not implemented')),
    isLocked: () => errAsync(new Error('not implemented')),
    transition: () => errAsync(new Error('not implemented')),
    autoSelect: () => errAsync(new Error('not implemented')),
    checkAcceptanceCriteria: () => errAsync(new Error('not implemented')),
    ...overrides
  } as unknown as IssueProvider
}
