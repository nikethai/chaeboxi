// WCAG 2 contrast ratio for opaque `#rrggbb` colours.

function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) {
    throw new Error(`contrastRatio only supports #rrggbb colours, got "${hex}"`)
  }
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const srgb = channel / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
