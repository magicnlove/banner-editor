import { prepareCanvasForRasterExport } from './exportFonts'

/**
 * @param {import('fabric').Canvas} canvas
 * @param {'png' | 'jpeg'} format
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 * @param {number} [jpegQuality]
 */
export async function exportCanvasToDataUrl(
  canvas,
  format,
  customFonts = [],
  jpegQuality = 0.92,
) {
  await prepareCanvasForRasterExport(canvas, customFonts)

  if (format === 'png') {
    return canvas.toDataURL({ format: 'png', multiplier: 1 })
  }

  return canvas.toDataURL({
    format: 'jpeg',
    quality: jpegQuality,
    multiplier: 1,
  })
}
