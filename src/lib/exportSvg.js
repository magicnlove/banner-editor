import {
  collectFontFamiliesFromCanvas,
  embedFontsInSvgString,
  ensureFontsReady,
  substituteNonEmbeddableFontsInSvg,
} from './exportFonts'
import {
  getLogicalSizeFromCanvas,
  isTemplateLayerObject,
  fitTemplateToCanvas,
} from './template'

/**
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 * @param {{ width: number; height: number }} [logicalSize] —보내기 시 논리 크기(줌 1)
 * @param {{ notoOnly?: boolean }} [embedOptions] — 로컬 woff2 @font-face
 * @param {{ embedFonts?: boolean }} [options]
 */
export async function exportFabricToSvg(
  canvas,
  customFonts = [],
  logicalSize,
  embedOptions = { notoOnly: true },
  options = {},
) {
  const { embedFonts = true } = options
  const fontEmbedOpts = { notoOnly: true, ...embedOptions }

  if (canvas.getObjects().some((o) => isTemplateLayerObject(o))) {
    fitTemplateToCanvas(canvas)
  }
  const logical =
    logicalSize?.width > 0 && logicalSize?.height > 0
      ? logicalSize
      : getLogicalSizeFromCanvas(canvas)
  const wPx = logical.width
  const hPx = logical.height
  const families = collectFontFamiliesFromCanvas(canvas)

  await ensureFontsReady(families, customFonts)

  let inner = canvas.toSVG({
    suppressPreamble: true,
    width: String(wPx),
    height: String(hPx),
    viewBox: { x: 0, y: 0, width: wPx, height: hPx },
  })

  if (embedFonts) {
    inner = await embedFontsInSvgString(inner, families, customFonts, fontEmbedOpts)
  }
  inner = substituteNonEmbeddableFontsInSvg(inner)

  return inner
}
