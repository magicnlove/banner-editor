import {
  collectFontFamiliesFromCanvas,
  embedFontsInSvgString,
  ensureFontsReady,
  substituteNonEmbeddableFontsInSvg,
} from './exportFonts'

/**
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 */
export async function exportFabricToSvg(canvas, customFonts = []) {
  const wPx = canvas.getWidth()
  const hPx = canvas.getHeight()
  const families = collectFontFamiliesFromCanvas(canvas)

  await ensureFontsReady(families, customFonts)

  let inner = canvas.toSVG({
    suppressPreamble: true,
    width: String(wPx),
    height: String(hPx),
    viewBox: { x: 0, y: 0, width: wPx, height: hPx },
  })

  inner = await embedFontsInSvgString(inner, families, customFonts)
  inner = substituteNonEmbeddableFontsInSvg(inner)

  return inner
}
