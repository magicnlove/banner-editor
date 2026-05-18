/**
 *보내기 시 텍스트를 opentype 윤곽선(path)으로 변환 — 벡터 PDF/SVG, 확대 시 깨짐 없음
 */
import opentype from 'opentype.js'
import { Path } from 'fabric'
import { isTemplateLayerObject } from './template'
import {
  loadPdfFontBinaries,
  resolveExportFontFamily,
  splitFontFamilyList,
} from './exportFonts'

/** @type {Map<string, import('opentype.js').Font>} */
const fontCache = new Map()

function binaryStringToArrayBuffer(binary) {
  const u8 = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    u8[i] = binary.charCodeAt(i) & 0xff
  }
  return u8.buffer
}

function normalizeWeight(fontWeight) {
  if (fontWeight === 'bold') return 700
  if (fontWeight === 'normal') return 400
  const n = Number(fontWeight)
  return Number.isFinite(n) ? n : 600
}

function isTextLike(obj) {
  if (!obj) return false
  return Boolean(
    obj.isType?.('IText', 'i-text', 'Text', 'Textbox', 'textbox') ||
      obj.type === 'i-text' ||
      obj.type === 'text' ||
      obj.type === 'textbox',
  )
}

/**
 * @param {string} family
 * @param {number} weight
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 */
async function getOpentypeFont(family, weight, customFonts) {
  const resolved = resolveExportFontFamily(family)
  const w = normalizeWeight(weight)
  const slot = w >= 600 ? 'bold' : 'regular'
  const cacheKey = `${resolved}:${slot}`
  if (fontCache.has(cacheKey)) return fontCache.get(cacheKey)

  const binaries = await loadPdfFontBinaries(resolved, customFonts)
  if (!binaries) {
    throw new Error(`폰트를 불러오지 못했습니다: ${family}`)
  }

  const bin = slot === 'bold' ? binaries.bold : binaries.regular
  const font = opentype.parse(binaryStringToArrayBuffer(bin))
  fontCache.set(cacheKey, font)
  return font
}

/**
 * @param {import('opentype.js').Font} font
 * @param {import('fabric').FabricObject} textObj
 */
function buildOutlinePathData(font, textObj) {
  const fontSize = Math.max(1, textObj.fontSize || 16)
  const lineHeight = textObj.lineHeight || 1.16
  const lineStep = fontSize * lineHeight
  const lines = String(textObj.text ?? '').split('\n')
  const align = textObj.textAlign || 'left'
  const ascender = (font.ascender / font.unitsPerEm) * fontSize

  let y = ascender
  const parts = []

  for (const line of lines) {
    const advance = font.getAdvanceWidth(line, fontSize)
    const boxW = Math.max(textObj.width || 0, advance)
    let x = 0
    if (align === 'center') x = (boxW - advance) / 2
    else if (align === 'right' || align === 'end') x = boxW - advance

    parts.push(font.getPath(line, x, y, fontSize).toPathData(2))
    y += lineStep
  }

  return parts.join(' ')
}

/**
 * @param {import('fabric').FabricObject} textObj
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 */
async function textObjectToFabricPath(textObj, customFonts) {
  const families = splitFontFamilyList(textObj.fontFamily)
  const family = families[0] || 'Noto Sans KR'
  const font = await getOpentypeFont(family, textObj.fontWeight, customFonts)
  const d = buildOutlinePathData(font, textObj)
  if (!d.trim()) return null

  const fill =
    typeof textObj.fill === 'string'
      ? textObj.fill
      : textObj.fill?.toString?.() ?? '#1a1d24'

  return new Path(d, {
    left: textObj.left,
    top: textObj.top,
    originX: textObj.originX ?? 'left',
    originY: textObj.originY ?? 'top',
    scaleX: textObj.scaleX ?? 1,
    scaleY: textObj.scaleY ?? 1,
    angle: textObj.angle ?? 0,
    fill,
    opacity: textObj.opacity ?? 1,
    stroke: textObj.stroke,
    strokeWidth: textObj.strokeWidth,
  })
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {import('fabric').FabricObject} obj
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 * @param {Array<{ text: import('fabric').FabricObject; path: import('fabric').FabricObject }>} swaps
 */
async function outlineTextInTree(canvas, obj, customFonts, swaps) {
  if (!obj || isTemplateLayerObject(obj)) return

  if (obj.type === 'group' && typeof obj.getObjects === 'function') {
    for (const child of [...obj.getObjects()]) {
      await outlineTextInTree(canvas, child, customFonts, swaps)
    }
    return
  }

  if (!isTextLike(obj)) return

  const path = await textObjectToFabricPath(obj, customFonts)
  if (!path) return

  const parent = obj.group ?? canvas
  const objects = parent.getObjects?.() ?? canvas.getObjects()
  const index = objects.indexOf(obj)

  obj.set({ visible: false })
  parent.add(path)
  if (index >= 0 && typeof parent.moveObjectTo === 'function') {
    parent.moveObjectTo(path, index + 1)
  }

  swaps.push({ text: obj, path })
}

/**
 *보내기 동안 텍스트를 윤곽선 path로 바꿨다가 복구합니다.
 * @template T
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 * @param {() => Promise<T>} fn
 */
export async function withTextOutlinedForExport(canvas, customFonts, fn) {
  fontCache.clear()
  /** @type {Array<{ text: import('fabric').FabricObject; path: import('fabric').FabricObject }>} */
  const swaps = []

  for (const obj of [...canvas.getObjects()]) {
    await outlineTextInTree(canvas, obj, customFonts, swaps)
  }

  canvas.requestRenderAll()

  try {
    return await fn()
  } finally {
    for (const { text, path } of swaps) {
      const parent = path.group ?? canvas
      parent.remove(path)
      text.set({ visible: true })
    }
    fontCache.clear()
    canvas.requestRenderAll()
  }
}
