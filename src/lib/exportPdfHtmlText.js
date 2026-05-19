import { isTemplateLayerObject } from './template'
import { collectTextObjectsForPdfExport } from './exportPdfSvg'

/** @param {import('fabric').Canvas} canvas */
export function collectUserTextObjectsForPdf(canvas) {
  return collectTextObjectsForPdfExport(canvas).filter(
    (obj) => !isTemplateLayerObject(obj),
  )
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {() => Promise<T>} fn
 * @template T
 */
export async function withUserTextHidden(canvas, fn) {
  const texts = collectUserTextObjectsForPdf(canvas)
  const states = texts.map((obj) => ({ obj, visible: obj.visible }))

  for (const obj of texts) {
    obj.set({ visible: false })
  }
  canvas.requestRenderAll?.()

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  try {
    return await fn()
  } finally {
    for (const { obj, visible } of states) {
      obj.set({ visible })
    }
    canvas.requestRenderAll?.()
  }
}

/** @param {import('fabric').Canvas} canvas
 * @param {() => Promise<string>} exportSvg
 */
export async function exportSvgWithUserTextHidden(canvas, exportSvg) {
  return withUserTextHidden(canvas, exportSvg)
}

/** @param {unknown} fill */
export function fillToCssColor(fill) {
  if (typeof fill === 'string' && fill) return fill
  if (fill && typeof fill === 'object' && typeof fill.toHex === 'function') {
    return `#${fill.toHex()}`
  }
  return '#1a1d24'
}

/** @param {string} fontFamily */
export function primaryFontFamilyName(fontFamily) {
  return String(fontFamily || 'Noto Sans KR')
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
}

/**
 * PDF API용 텍스트 메타 (줌 1 논리 좌표)
 * @param {import('fabric').Canvas} canvas
 */
export function extractTextObjectsForPdf(canvas) {
  return collectUserTextObjectsForPdf(canvas).map((obj) => {
    obj.setCoords?.()
    const bounds = obj.getBoundingRect(true, true)
    return {
      text: String(obj.text ?? ''),
      left: bounds.left,
      top: bounds.top,
      width: Math.max(bounds.width, 1),
      height: Math.max(bounds.height, 1),
      fontSize: Number(obj.fontSize) || 16,
      fontFamily: primaryFontFamilyName(obj.fontFamily),
      fill: fillToCssColor(obj.fill),
      textAlign: obj.textAlign || 'left',
      fontWeight: obj.fontWeight ?? 'normal',
      scaleX: obj.scaleX ?? 1,
      scaleY: obj.scaleY ?? 1,
      angle: obj.angle ?? 0,
      lineHeight: obj.lineHeight ?? 1.16,
      charSpacing: Number(obj.charSpacing) || 0,
      opacity: obj.opacity ?? 1,
    }
  })
}

/** @param {string} value */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** @param {unknown} fontWeight */
function cssFontWeight(fontWeight) {
  if (fontWeight === 'bold') return 'bold'
  const n = Number(fontWeight)
  return Number.isFinite(n) && n >= 600 ? 'bold' : 'normal'
}

/**
 * Fabric 텍스트 → HTML (Chromium PDF에서 선택·복사 가능)
 * @param {import('fabric').FabricObject} textObj
 */
export function buildHtmlTextOverlay(textObj) {
  textObj.setCoords?.()
  const bounds = textObj.getBoundingRect(true, true)
  const fontSize = Math.max(1, (textObj.fontSize || 16) * (textObj.scaleY ?? 1))
  const lineHeight = textObj.lineHeight ?? 1.16
  const angle = textObj.angle ?? 0
  const charSpacing = Number(textObj.charSpacing) || 0
  const letterSpacing =
    charSpacing !== 0 ? `${(fontSize * charSpacing) / 1000}px` : 'normal'

  const decorations = []
  if (textObj.underline) decorations.push('underline')
  if (textObj.linethrough) decorations.push('line-through')
  if (textObj.overline) decorations.push('overline')
  const textDecoration = decorations.length ? decorations.join(' ') : 'none'

  const content = escapeHtml(String(textObj.text ?? ''))
  const family = primaryFontFamilyName(textObj.fontFamily).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  return `<div class="pdf-text" style="
    position: absolute;
    left: ${bounds.left}px;
    top: ${bounds.top}px;
    width: ${Math.max(bounds.width, 1)}px;
    min-height: ${Math.max(bounds.height, fontSize * lineHeight)}px;
    font-size: ${fontSize}px;
    font-family: '${family}', 'Noto Sans KR', sans-serif;
    font-weight: ${cssFontWeight(textObj.fontWeight)};
    font-style: ${textObj.fontStyle || 'normal'};
    color: ${fillToCssColor(textObj.fill)};
    text-align: ${textObj.textAlign || 'left'};
    line-height: ${lineHeight};
    letter-spacing: ${letterSpacing};
    text-decoration: ${textDecoration};
    white-space: pre-wrap;
    word-break: break-word;
    overflow: visible;
    opacity: ${textObj.opacity ?? 1};
    transform: rotate(${angle}deg);
    transform-origin: ${bounds.width / 2}px ${bounds.height / 2}px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  ">${content}</div>`
}

/** @param {import('fabric').FabricObject[]} textObjects */
export function buildHtmlTextLayer(textObjects) {
  if (!textObjects.length) return ''
  return `<div class="pdf-text-layer" aria-hidden="false">${textObjects
    .map(buildHtmlTextOverlay)
    .join('\n')}</div>`
}
