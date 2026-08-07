/**
 * Vision-friendly resize matching pic_utils / Claude + OpenAI guidance:
 * - max side 1568
 * - short side max 768
 */
export const VISION_MAX_PIXEL_L1 = 1568
export const VISION_MAX_PIXEL_L2 = 768

export function computeVisionResizeDimensions(
  originalWidth: number,
  originalHeight: number
): { width: number; height: number } {
  let newWidth = Math.max(1, Math.floor(originalWidth))
  let newHeight = Math.max(1, Math.floor(originalHeight))

  if (newWidth > VISION_MAX_PIXEL_L1 || newHeight > VISION_MAX_PIXEL_L1) {
    const scale = Math.min(VISION_MAX_PIXEL_L1 / newWidth, VISION_MAX_PIXEL_L1 / newHeight)
    newWidth = Math.floor(newWidth * scale)
    newHeight = Math.floor(newHeight * scale)
  }

  const minSide = Math.min(newWidth, newHeight)
  if (minSide > VISION_MAX_PIXEL_L2) {
    const scale = VISION_MAX_PIXEL_L2 / minSide
    newWidth = Math.floor(newWidth * scale)
    newHeight = Math.floor(newHeight * scale)
  }

  return {
    width: Math.max(1, newWidth),
    height: Math.max(1, newHeight),
  }
}
