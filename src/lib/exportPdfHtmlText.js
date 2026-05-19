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
 * @param {() => Promise<string>} exportSvg
 */
export async function exportSvgWithUserTextHidden(canvas, exportSvg) {
  const texts = collectUserTextObjectsForPdf(canvas)
  const states = texts.map((obj) => ({ obj, visible: obj.visible }))

  for (const obj of texts) {
    obj.set({ visible: false })
  }
  if (typeof canvas.requestRenderAll === 'function') {
    canvas.requestRenderAll()
  } else {
    canvas.renderAll?.()
  }

  try {
    return await exportSvg()
  } finally {
    for (const { obj, visible } of states) {
      obj.set({ visible })
    }
    if (typeof canvas.requestRenderAll === 'function') {
      canvas.requestRenderAll()
    } else {
      canvas.renderAll?.()
    }
  }
}

/** @param {string} value */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** @param {unknown} fill */
function fillToCssColor(fill) {
  if (typeof fill === 'string' && fill) return fill
  if (fill && typeof fill === 'object' && typeof fill.toHex === 'function') {
    return `#${fill.toHex()}`
  }
  return '#1a1d24'
}

/** @param {unknown} fontWeight */
function cssFontWeight(fontWeight) {
  if (fontWeight === 'bold') return 'bold'
  const n = Number(fontWeight)
  return Number.isFinite(n) && n >= 600 ? 'bold' : 'normal'
}

/** @param {string} fontFamily */
function primaryFontFamily(fontFamily) {
  const first = String(fontFamily || 'Noto Sans KR')
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
  return first.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
  const family = primaryFontFamily(textObj.fontFamily)

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
