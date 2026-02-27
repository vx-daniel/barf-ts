/** @module CLI Commands */

import chalk from 'chalk'
import { arch, platform } from 'os'
import { dirname, join } from 'path'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { logger } from '@/utils/logger'

/** Current version from package.json, embedded at compile time. */
const CURRENT_VERSION = '2.0.0'

/**
 * Maps the current OS and architecture to the release binary name.
 *
 * @returns Binary filename matching the GitHub Release asset naming convention,
 *   or `null` if the platform is unsupported
 */
function getBinaryName(): string | null {
  const os = platform()
  const cpu = arch()

  const osMap: Record<string, string> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows',
  }
  const archMap: Record<string, string> = {
    arm64: 'arm64',
    x64: 'x64',
  }

  const mappedOs = osMap[os]
  const mappedArch = archMap[cpu]
  if (!mappedOs || !mappedArch) return null

  const ext = os === 'win32' ? '.exe' : ''
  return `barf-${mappedOs}-${mappedArch}${ext}`
}

/**
 * Fetches the latest release tag from GitHub via the `gh` CLI.
 *
 * @param repo - GitHub repo in `owner/repo` format
 * @returns The latest tag string, or `null` if the check failed
 */
async function fetchLatestTag(repo: string): Promise<string | null> {
  const result = await execFileNoThrow('gh', [
    'api',
    `repos/${repo}/releases/latest`,
    '--jq',
    '.tag_name',
  ])

  if (result.status !== 0) {
    logger.debug({ stderr: result.stderr }, 'gh api call failed')
    return null
  }

  return result.stdout.trim()
}

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
  console.log(`Current version: v${CURRENT_VERSION}`)

  const latestTag = await fetchLatestTag(repo)
  if (!latestTag) {
    console.log(
      chalk.yellow(
        'Could not check for updates. Ensure gh CLI is installed and authenticated.',
      ),
    )
    return
  }

  const latestVersion = latestTag.replace(/^v/, '')

  if (latestVersion === CURRENT_VERSION) {
    console.log(chalk.green('You are on the latest version.'))
  } else {
    console.log(
      chalk.yellow(
        `New version available: ${latestTag} (current: v${CURRENT_VERSION})`,
      ),
    )
    console.log(`Run: barf update --repo ${repo}`)
  }
}

/**
 * Self-updates the barf binary by downloading the latest release from GitHub
 * and replacing the current executable in-place.
 *
 * Detects the current platform and architecture, downloads the matching binary
 * via `gh release download`, and overwrites the running binary. On Unix this
 * works because the OS keeps the old inode open. On Windows a rename-then-move
 * strategy is used since the running exe is locked.
 *
 * @param repo - GitHub repo in `owner/repo` format
 */
export async function updateCommand(repo: string): Promise<void> {
  console.log(`Current version: v${CURRENT_VERSION}`)

  const latestTag = await fetchLatestTag(repo)
  if (!latestTag) {
    console.log(
      chalk.yellow(
        'Could not check for updates. Ensure gh CLI is installed and authenticated.',
      ),
    )
    return
  }

  const latestVersion = latestTag.replace(/^v/, '')
  if (latestVersion === CURRENT_VERSION) {
    console.log(chalk.green('Already on the latest version.'))
    return
  }

  const binaryName = getBinaryName()
  if (!binaryName) {
    console.log(
      chalk.red(
        `Unsupported platform: ${platform()}-${arch()}. Download manually from GitHub Releases.`,
      ),
    )
    return
  }

  console.log(
    chalk.blue(`Updating: v${CURRENT_VERSION} → ${latestTag} (${binaryName})`),
  )

  // Download to a temp location next to the current binary
  const currentBinary = process.execPath
  const installDir = dirname(currentBinary)
  const tmpPath = join(installDir, `${binaryName}.tmp`)

  const download = await execFileNoThrow('gh', [
    'release',
    'download',
    latestTag,
    '--repo',
    repo,
    '--pattern',
    binaryName,
    '--output',
    tmpPath,
    '--clobber',
  ])

  if (download.status !== 0) {
    logger.debug({ stderr: download.stderr }, 'gh release download failed')
    console.log(chalk.red('Download failed:'), download.stderr.trim())
    return
  }

  // Replace the current binary
  const isWindows = platform() === 'win32'

  if (isWindows) {
    // Windows locks the running exe — rename old, move new, then delete old
    const oldPath = `${currentBinary}.old`
    const { rename, unlink } = await import('fs/promises')
    await rename(currentBinary, oldPath)
    await rename(tmpPath, currentBinary)
    // Best-effort cleanup of the old binary
    unlink(oldPath).catch(() => {})
  } else {
    // Unix: chmod +x, then overwrite (OS keeps old inode for running process)
    await execFileNoThrow('chmod', ['+x', tmpPath])
    const { rename } = await import('fs/promises')
    await rename(tmpPath, currentBinary)
  }

  console.log(chalk.green(`Updated to ${latestTag}`))
}
