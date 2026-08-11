/**
 * Map model-space screenshot coordinates → actuator / display coordinates.
 * Model sees screenshot size (Ww x Wh); display/actuator size (Dw x Dh).
 * On macOS, Dw×Dh should be points (CGDisplayBounds), matching cliclick / System Events.
 */
export function mapScreenshotToDisplay(
  x: number,
  y: number,
  screenshot: { width: number; height: number },
  display: { width: number; height: number }
): { x: number; y: number } {
  if (!screenshot.width || !screenshot.height) {
    return { x, y }
  }
  if (!display.width || !display.height) {
    return { x, y }
  }
  return {
    x: Math.min(Math.max(0, x * (display.width / screenshot.width)), display.width),
    y: Math.min(Math.max(0, y * (display.height / screenshot.height)), display.height),
  }
}
