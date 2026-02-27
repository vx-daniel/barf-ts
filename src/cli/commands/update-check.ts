/** @module CLI Commands */
import chalk from 'chalk'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { logger } from '@/utils/logger'

/** Current version from package.json, embedded at compile time. */
const CURRENT_VERSION = '2.0.0'

/**
 * Checks for a newer release on GitHub by querying the latest release tag
 * via the `gh` CLI. Compares against {@link CURRENT_VERSION} and prints
 * a notice if an update is available.
 *
 * Requires `gh` CLI installed and authenticated with repo access.
 *
 * @param repo - GitHub repo in `owner/repo` format
 */
export async function updateCheckCommand(repo: string): Promise<void> {
  console.log(`Current version: ${CURRENT_VERSION}`)

  const result = await execFileNoThrow('gh', [
    'api',
    `repos/${repo}/releases/latest`,
    '--jq',
    '.tag_name',
  ])

  if (result.status !== 0) {
    logger.debug({ stderr: result.stderr }, 'gh api call failed')
    console.log(
      chalk.yellow(
        'Could not check for updates. Ensure gh CLI is installed and authenticated.',
      ),
    )
    return
  }

  const latestTag = result.stdout.trim()
  const latestVersion = latestTag.replace(/^v/, '')

  if (latestVersion === CURRENT_VERSION) {
    console.log(chalk.green('You are on the latest version.'))
  } else {
    console.log(
      chalk.yellow(
        `New version available: ${latestTag} (current: v${CURRENT_VERSION})`,
      ),
    )
    console.log(`Download: gh release download ${latestTag} --repo ${repo}`)
  }
}
