// https://github.com/Gogh-Co/Gogh/blob/master/themes/Adventure%20Time.yml
const adventureTime = {
  color_01: '#050404', // Black(Host)
  color_02: '#BD0013', // Red(Syntax string)
  color_03: '#4AB118', // Green(Command)
  color_04: '#E7741E', // Yellow(Command second)
  color_05: '#0F4AC6', // Blue(Path)
  color_06: '#665993', // Magenta(Syntax var)
  color_07: '#70A598', // Cyan(Prompt)
  color_08: '#F8DCC0', // White
  color_09: '#4E7CBF', // Bright Black
  color_10: '#FC5F5A', // Bright Red(Command error)
  color_11: '#9EFF6E', // Bright Green(Exec)
  color_12: '#EFC11A', // Bright Yellow
  color_13: '#1997C6', // Bright Blue(Folder)
  color_14: '#9B5953', // Bright Magenta
  color_15: '#C8FAF4', // Bright Cyan
  color_16: '#F6F5FB', // Bright White
  background: '#1F1D45', // Background
  foreground: '#F8DCC0', // Foreground(Text)
  cursor: '#F8DCC0', // Cursor
} as const

// https://github.com/Gogh-Co/Gogh/blob/master/themes/Catppuccin%20Frapp%C3%A9.yml
const catppuccin = {
  color_01: '#51576D', // Black(Host)
  color_02: '#E78284', // Red(Syntax string)
  color_03: '#A6D189', // Green(Command)
  color_04: '#E5C890', // Yellow(Command second)
  color_05: '#8CAAEE', // Blue(Path)
  color_06: '#F4B8E4', // Magenta(Syntax var)
  color_07: '#81C8BE', // Cyan(Prompt)
  color_08: '#B5BFE2', // White
  color_09: '#626880', // Bright Black
  color_10: '#E78284', // Bright Red(Command error)
  color_11: '#A6D189', // Bright Green(Exec)
  color_12: '#E5C890', // Bright Yellow
  color_13: '#8CAAEE', // Bright Blue(Folder)
  color_14: '#F4B8E4', // Bright Magenta
  color_15: '#81C8BE', // Bright Cyan
  color_16: '#A5ADCE', // Bright White
  background: '#303446', // Background
  foreground: '#C6D0F5', // Foreground(Text)
  cursor: '#C6D0F5', // Cursor
} as const

// https://github.com/Gogh-Co/Gogh/blob/master/themes/Gotham.yml
const gotham = {
  color_01: '#0A0F14', // Black(Host)
  color_02: '#C33027', // Red(Syntax string)
  color_03: '#26A98B', // Green(Command)
  color_04: '#EDB54B', // Yellow(Command second)
  color_05: '#195465', // Blue(Path)
  color_06: '#4E5165', // Magenta(Syntax var)
  color_07: '#33859D', // Cyan(Prompt)
  color_08: '#98D1CE', // White
  color_09: '#10151B', // Bright Black
  color_10: '#D26939', // Bright Red(Command error)
  color_11: '#081F2D', // Bright Green(Exec)
  color_12: '#245361', // Bright Yellow
  color_13: '#093748', // Bright Blue(Folder)
  color_14: '#888BA5', // Bright Magenta
  color_15: '#599CAA', // Bright Cyan
  color_16: '#D3EBE9', // Bright White
  background: '#0A0F14', // Background
  foreground: '#98D1CE', // Foreground(Text)
  cursor: '#98D1CE', // Cursor
} as const

// https://github.com/Gogh-Co/Gogh/blob/master/themes/Tokyo%20Night.yml
const tokyoNight = {
  color_01: '#414868', // Black(Host)
  color_02: '#F7768E', // Red(Syntax string)
  color_03: '#9ECE6A', // Green(Command)
  color_04: '#E0AF68', // Yellow(Command second)
  color_05: '#7AA2F7', // Blue(Path)
  color_06: '#BB9AF7', // Magenta(Syntax var)
  color_07: '#7DCFFF', // Cyan(Prompt)
  color_08: '#A9B1D6', // White
  color_09: '#3b3e4c', // Bright Black
  color_10: '#F7768E', // Bright Red(Command error)
  color_11: '#9ECE6A', // Bright Green(Exec)
  color_12: '#E0AF68', // Bright Yellow
  color_13: '#7AA2F7', // Bright Blue(Folder)
  color_14: '#BB9AF7', // Bright Magenta
  color_15: '#7DCFFF', // Bright Cyan
  color_16: '#C0CAF5', // Bright White
  background: '#1A1B26', // Background
  foreground: '#e5e7f3', // Foreground(Text)
  cursor: '#C0CAF5', // Cursor
} as const

const kanagawaWave = {
  color_01: '#090618', // Black (Host)
  color_02: '#C34043', // Red (Syntax string)
  color_03: '#76946A', // Green (Command)
  color_04: '#C0A36E', // Yellow (Command second)
  color_05: '#7E9CD8', // Blue (Path)
  color_06: '#957FB8', // Magenta (Syntax var)
  color_07: '#6A9589', // Cyan (Prompt)
  color_08: '#C8C093', // White
  color_09: '#727169', // Bright Black
  color_10: '#E82424', // Bright Red (Command error)
  color_11: '#98BB6C', // Bright Green (Exec)
  color_12: '#E6C384', // Bright Yellow
  color_13: '#7FB4CA', // Bright Blue (Folder)
  color_14: '#938AA9', // Bright Magenta
  color_15: '#7AA89F', // Bright Cyan
  color_16: '#DCD7BA', // Bright White

  background: '#1F1F28', // Background
  foreground: '#DCD7BA', // Foreground (Text)

  cursor: '#DCD7BA', // Cursor
} as const

// ── Exports ──────────────────────────────────────────────────────────────────

/** Shape of a Gogh terminal color theme. */
export type Theme = Readonly<Record<string, string>>

/** All available themes keyed by name. */
export const themes = {
  adventureTime,
  catppuccin,
  gotham,
  tokyoNight,
  kanagawaWave,
} as const satisfies Record<string, Theme>

export type ThemeName = keyof typeof themes

/**
 * Applies a theme by setting CSS custom properties on the document root.
 *
 * Each theme key becomes `--theme-<key>` with underscores converted to hyphens,
 * e.g. `color_01` → `--theme-color-01`, `background` → `--theme-background`.
 */
export function applyTheme(name: ThemeName): void {
  const theme = themes[name]
  const style = document.documentElement.style
  for (const [key, value] of Object.entries(theme)) {
    style.setProperty(`--theme-${key.replace(/_/g, '-')}`, value)
  }
}
