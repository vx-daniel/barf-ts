import { tokyoNight } from '@/utils/themes'

const theme = tokyoNight

/**
 * Application-wide colour palette derived from the Tokyo Night theme.
 *
 * Extracted into a side-effect-free constants file so components can import
 * it without creating circular dependencies through `@/tui/index`.
 */
export const _APP_COLORS = {
  title: theme.color_14,
  subtitle: theme.color_13,
  dim: theme.color_08,
  border: theme.color_06,
  header: theme.color_01,
  headerAlt: theme.color_09,
  background: theme.background,
  sidebar: theme.color_01,
  red: theme.color_02,
  yellow: theme.color_04,
  green: theme.color_03,
  white: theme.foreground,
  orange: theme.color_12
} as const
