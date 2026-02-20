import { BoxRenderable, createCliRenderer, Text } from "@opentui/core"
import { tokyoNight } from "@/utils/themes";

export const theme = tokyoNight

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
    dev: 'lime',
    white: theme.foreground,
    orange: theme.color_12,
} as const;

const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
})

const container = new BoxRenderable(renderer, {
  id: "container",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  height: "100%"
})


const leftPanel = new BoxRenderable(renderer, {
  id: "left",
  width: "25%",
  height: "100%",
  backgroundColor: _APP_COLORS.sidebar,
})

const mainPanel = new BoxRenderable(renderer, {
  id: "main",
  height: "100%",
  flexGrow: 1,
  backgroundColor: _APP_COLORS.background,
})

// Add to main panel
const headerPanel = new BoxRenderable(renderer, {
  id: "header",
  width: "100%",
  height: 10,
  // flexGrow: 1,
  backgroundColor: tokyoNight.color_02,
})

container.add(leftPanel)
container.add(mainPanel)
renderer.root.add(container)


// renderer.root.add(
//   Text({
//     content: "Hello, OpenTUI!",
//     fg: "#00FF00",
//   })
// )