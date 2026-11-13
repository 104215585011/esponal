// Timestamp: 2026-11-13 17:20

/**
 * 设计 token —— 与 Web 端保持一致(白底 + brand-500 绿 + 大圆角)。
 * 后续若抽出共享包,这里换成从 packages/theme 导入。
 */
export const colors = {
  brand50: "#ECFDF5",
  brand100: "#D1FAE5",
  brand500: "#10B981",
  brand600: "#059669",
  brand700: "#047857",

  bg: "#FFFFFF",
  bgSubtle: "#FAF9F6",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F4F5",

  text: "#18181B",
  textSecondary: "#71717A",
  textTertiary: "#A1A1AA",

  border: "#E4E4E7",
  borderSubtle: "#F4F4F5",

  danger: "#DC2626",
  dangerBg: "#FEF2F2"
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32
} as const;
