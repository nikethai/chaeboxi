/**
 * (legacy comment)
 * @param file
 * @returns base64
 */
export async function getImageBase64AndResize(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('file is not an image')
  }
  // Claude: To improve time-to-first-token, we recommend resizing images to no more than 1.15 megapixels (and within 1568 pixels in both dimensions).
  // https://docs.anthropic.com/en/docs/build-with-claude/vision
  const maxPixelL1 = 1568
  // OpenAI: For high res mode, the short side of the image should be less than 768px and the long side should be less than 2,000px.
  // https://platform.openai.com/docs/guides/vision
  const maxPixelL2 = 768
  return new Promise<string>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('cannot get canvas context'))
      return
    }
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      // object URL
      URL.revokeObjectURL(objectUrl)
      // (legacy comment removed)
      const originalWidth = img.width
      const originalHeight = img.height
      // (legacy comment removed)
      let newWidth = originalWidth
      let newHeight = originalHeight
      // (legacy comment removed)
      if (originalWidth > maxPixelL1 || originalHeight > maxPixelL1) {
        const scale = Math.min(maxPixelL1 / originalWidth, maxPixelL1 / originalHeight)
        newWidth = Math.floor(originalWidth * scale)
        newHeight = Math.floor(originalHeight * scale)
      }
      // maxPixelL2
      const minSide = Math.min(newWidth, newHeight)
      if (minSide > maxPixelL2) {
        const scale = maxPixelL2 / minSide
        newWidth = Math.floor(newWidth * scale)
        newHeight = Math.floor(newHeight * scale)
      }
      // (legacy comment)
      canvas.width = newWidth
      canvas.height = newHeight
      // (legacy comment removed)
      ctx.drawImage(img, 0, 0, newWidth, newHeight)
      // (legacy comment)
      const base64 =
        file.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png', 1.0)
      resolve(base64)
    }
    img.onerror = (error) => {
      // object URL
      URL.revokeObjectURL(objectUrl)
      reject(error)
    }
    img.src = objectUrl
  })
}

export function svgCodeToBase64(svgCode: string) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgCode)))
}

export async function svgToPngBase64(svgBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height
      try {
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(atob(svgBase64.split(',')[1]), 'image/svg+xml')
        const svgElement = svgDoc.documentElement
        const viewBox = svgElement.getAttribute('viewBox')
        if (viewBox) {
          const items = viewBox.split(/[\s,]+/)
          if (items.length === 4) {
            const [, , viewBoxWidth, viewBoxHeight] = items.map((item) => parseFloat(item))
            if (viewBoxWidth && viewBoxHeight) {
              // NaN
              width = Math.max(viewBoxWidth, img.width)
              height = Math.max(viewBoxHeight, img.height)
              // console.log('viewBoxWidth', viewBoxWidth, 'viewBoxHeight', viewBoxHeight)
            }
          }
        }
      } catch (e) {
        console.error(e)
      }
      // console.log('img.width', img.width, 'img.height', img.height)
      // console.log('width', width, 'height', height)

      const canvas = document.createElement('canvas')
      const scale = 2
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('cannot get canvas context'))
        return
      }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, width, height)
      try {
        const pngBase64 = canvas.toDataURL('image/png', 1.0) // (legacy)
        resolve(pngBase64)
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = (error) => {
      reject(error)
    }
    img.src = svgBase64
  })
}
