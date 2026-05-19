import { loadSVGFromString, loadSVGFromURL, util } from 'fabric'
import horizontalSvgUrl from '../templates/horizontal.svg?url'
import horizontalSvgRaw from '../templates/horizontal.svg?raw'
import verticalSvgUrl from '../templates/vertical.svg?url'
import verticalSvgRaw from '../templates/vertical.svg?raw'

/** @typedef {'horizontal' | 'vertical'} TemplateKey */

/** @typedef {{ type: 'template', templateKey: TemplateKey } | { type: 'free', widthPx: number, heightPx: number }} EditorConfig */

export const TEMPLATE_LAYER_PROP = 'isTemplateLayer'

const TEMPLATE_META = {
  horizontal: { url: horizontalSvgUrl, raw: horizontalSvgRaw },
  vertical: { url: verticalSvgUrl, raw: verticalSvgRaw },
}

/** @param {TemplateKey} key */
export function getTemplate(key) {
  const meta = TEMPLATE_META[key]
  if (!meta) {
    throw new Error(`Unknown template: ${key}`)
  }
  return { ...meta }
}

/** @param {import('fabric').FabricObject | null | undefined} obj */
export function isTemplateLayerObject(obj) {
  if (!obj) return false
  return Boolean(obj[TEMPLATE_LAYER_PROP] ?? obj.get?.(TEMPLATE_LAYER_PROP))
}

/**
 * viewBox="minX minY width height"
 * @param {string} svgRaw
 */
export function parseViewBoxFromSvgString(svgRaw) {
  const match = svgRaw.match(/viewBox\s*=\s*["']([^"']+)["']/i)
  if (!match) return null
  const parts = match[1]
    .trim()
    .split(/[\s,]+/)
    .map((n) => Number.parseFloat(n))
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [minX, minY, width, height] = parts
  if (width <= 0 || height <= 0) return null
  return { minX, minY, width, height }
}

/** @param {string} attrs */
function stripSvgTransformAttr(attrs) {
  return attrs.replace(/\s*transform\s*=\s*["'][^"']*["']/gi, '')
}

/**
 * @param {string} svgRaw
 */
export function normalizeTemplateSvgForLoad(svgRaw) {
  const viewBox = parseViewBoxFromSvgString(svgRaw)
  if (!viewBox) return svgRaw

  let svg = svgRaw.replace(/\s*style="enable-background:[^"]*"/gi, '')
  const nextViewBox = `0 0 ${viewBox.width} ${viewBox.height}`
  svg = svg.replace(/viewBox\s*=\s*["'][^"']+["']/i, `viewBox="${nextViewBox}"`)

  if (viewBox.minX === 0 && viewBox.minY === 0) {
    return svg
  }

  const translate = `translate(${-viewBox.minX},${-viewBox.minY})`
  const afterStyle = /(<\/style>\s*)(<g)(\s[^>]*)?(>)/i
  if (afterStyle.test(svg)) {
    return svg.replace(afterStyle, (_m, prefix, tag, attrs = '', close) => {
      const cleaned = stripSvgTransformAttr(attrs)
      return `${prefix}${tag} transform="${translate}"${cleaned}${close}`
    })
  }

  const afterSvg = /(<svg\b[^>]*>\s*)(<g)(\s[^>]*)?(>)/i
  return svg.replace(afterSvg, (_m, prefix, tag, attrs = '', close) => {
    const cleaned = stripSvgTransformAttr(attrs)
    return `${prefix}${tag} transform="${translate}"${cleaned}${close}`
  })
}

/** @param {unknown} value */
export function preserveLogicalPx(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

/**
 * 문서 논리 크기 =보내기 해상도 (줌과 무관)
 * @param {import('fabric').Canvas} canvas
 * @param {number} width
 * @param {number} height
 */
export function setCanvasLogicalSize(canvas, width, height) {
  canvas.__logicalSize = {
    width: preserveLogicalPx(width),
    height: preserveLogicalPx(height),
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {{ width?: number; height?: number }} [fallback]
 */
export function getLogicalSizeFromCanvas(canvas, fallback) {
  const ls = canvas.__logicalSize
  if (ls?.width > 0 && ls?.height > 0) {
    return { width: Number(ls.width), height: Number(ls.height) }
  }
  const fw = Number(fallback?.width)
  const fh = Number(fallback?.height)
  if (fw > 0 && fh > 0) {
    return { width: fw, height: fh }
  }
  const z = canvas.getZoom() || 1
  return {
    width: canvas.getWidth() / z,
    height: canvas.getHeight() / z,
  }
}

/** @param {{ minX?: number; minY?: number; width: number; height: number }} viewBox */
export function cloneViewBox(viewBox) {
  return {
    minX: Number(viewBox.minX) || 0,
    minY: Number(viewBox.minY) || 0,
    width: preserveLogicalPx(viewBox.width),
    height: preserveLogicalPx(viewBox.height),
  }
}

/**
 * @param {Record<string, unknown>} [options] Fabric parse options
 * @param {string} [svgRaw]
 */
export function viewBoxFromSvg(options, svgRaw) {
  const fromRaw = svgRaw ? parseViewBoxFromSvgString(svgRaw) : null
  if (fromRaw) return fromRaw

  const width = Number(options?.viewBoxWidth ?? options?.width)
  const height = Number(options?.viewBoxHeight ?? options?.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return {
    minX: Number(options?.minX) || 0,
    minY: Number(options?.minY) || 0,
    width,
    height,
  }
}

/** @param {{ width: number; height: number }} viewBox */
export function logicalSizeFromViewBox(viewBox) {
  return {
    width: preserveLogicalPx(viewBox.width),
    height: preserveLogicalPx(viewBox.height),
  }
}

/**
 * 논리 크기 + 현재 줌으로 Fabric 캔버스 버퍼/DOM 크기 동기화 (__logicalSize는 그대로)
 * @param {import('fabric').Canvas} canvas
 */
export function syncCanvasBufferToLogicalZoom(canvas) {
  const { width, height } = getLogicalSizeFromCanvas(canvas)
  const z = canvas.getZoom() || 1
  canvas.setDimensions({
    width: Math.round(width * z),
    height: Math.round(height * z),
  })
  canvas.calcOffset()
}

/**
 * 문서 논리 크기 설정 (줌 1 기준 버퍼) — 템플릿 SVG viewBox 메타는 선택 저장
 * @param {import('fabric').Canvas} canvas
 * @param {number} width
 * @param {number} height
 * @param {{ minX?: number; minY?: number; width?: number; height?: number }} [viewBoxMeta]
 */
export function setCanvasDocumentSize(canvas, width, height, viewBoxMeta) {
  const w = preserveLogicalPx(width)
  const h = preserveLogicalPx(height)
  if (viewBoxMeta?.width > 0 && viewBoxMeta?.height > 0) {
    canvas.__viewBox = cloneViewBox(viewBoxMeta)
  }
  setCanvasLogicalSize(canvas, w, h)
  canvas.setZoom(1)
  canvas.setDimensions({ width: w, height: h })
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  canvas.calcOffset()
}

/** @deprecated setCanvasDocumentSize 사용 */
export function applyTemplateCanvasDimensions(canvas, width, height, viewBox) {
  setCanvasDocumentSize(canvas, width, height, viewBox)
}

/** @param {import('fabric').FabricObject} obj */
function markAsTemplateLayer(obj) {
  obj.set({
    [TEMPLATE_LAYER_PROP]: true,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
  })
  obj[TEMPLATE_LAYER_PROP] = true
  return obj
}

/**
 * 템플릿 그룹을 캔버스 논리 영역(0,0 ~ w×h)에 꽉 차게 스케일
 * @param {import('fabric').FabricObject} group
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 */
export function fitTemplateGroupToCanvas(group, canvasWidth, canvasHeight) {
  const cw = preserveLogicalPx(canvasWidth)
  const ch = preserveLogicalPx(canvasHeight)

  group.set({
    originX: 'left',
    originY: 'top',
    left: 0,
    top: 0,
  })
  group.setCoords()

  const br = group.getBoundingRect(true, true)
  if (!(br.width > 0 && br.height > 0)) return

  const scaleX = cw / br.width
  const scaleY = ch / br.height

  group.set({
    scaleX: (group.scaleX ?? 1) * scaleX,
    scaleY: (group.scaleY ?? 1) * scaleY,
  })
  group.setCoords()

  const br2 = group.getBoundingRect(true, true)
  group.set({
    left: (group.left ?? 0) - br2.left,
    top: (group.top ?? 0) - br2.top,
  })
  group.setCoords()
}

/**
 * @param {import('fabric').Canvas} canvas
 */
export function fitTemplateToCanvas(canvas) {
  const template = canvas.getObjects().find((o) => isTemplateLayerObject(o))
  if (!template) return null
  const { width, height } = getLogicalSizeFromCanvas(canvas)
  fitTemplateGroupToCanvas(template, width, height)
  return { width, height }
}

/** @param {import('fabric').Canvas} canvas */
export function syncCanvasToTemplateBounds(canvas) {
  return fitTemplateToCanvas(canvas)
}

/**
 * 논리 캔버스 크기 변경 — 모든 오브젝트 동일 비율 스케일 + 템플릿 재맞춤
 * @param {import('fabric').Canvas} canvas
 * @param {number} newWidth
 * @param {number} newHeight
 */
export function resizeCanvasLogicalSize(canvas, newWidth, newHeight) {
  const { width: oldW, height: oldH } = getLogicalSizeFromCanvas(canvas)
  const nw = preserveLogicalPx(newWidth)
  const nh = preserveLogicalPx(newHeight)

  if (Math.abs(oldW - nw) < 1e-6 && Math.abs(oldH - nh) < 1e-6) {
    return null
  }

  const scaleX = nw / oldW
  const scaleY = nh / oldH

  canvas.discardActiveObject()

  for (const obj of canvas.getObjects()) {
    obj.set({
      left: (obj.left ?? 0) * scaleX,
      top: (obj.top ?? 0) * scaleY,
      scaleX: (obj.scaleX ?? 1) * scaleX,
      scaleY: (obj.scaleY ?? 1) * scaleY,
    })
    obj.setCoords()
  }

  setCanvasLogicalSize(canvas, nw, nh)
  syncCanvasBufferToLogicalZoom(canvas)
  fitTemplateToCanvas(canvas)
  canvas.requestRenderAll()

  return { scaleX, scaleY, oldWidth: oldW, oldHeight: oldH, newWidth: nw, newHeight: nh }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {import('fabric').FabricObject} [templateGroup]
 * @param {string} [label]
 */
export function logTemplateCanvasMetrics(canvas, templateGroup, label = 'template') {
  const logical = canvas.__logicalSize
  const viewBox = canvas.__viewBox
  templateGroup?.setCoords()
  const br = templateGroup?.getBoundingRect(true, true)
  if (import.meta.env.DEV) {
    console.log(`[editor/template-size] ${label}`, {
      '__logicalSize': logical,
      '__viewBox (svg meta)': viewBox,
      'canvas.getWidth()': canvas.getWidth(),
      'canvas.getHeight()': canvas.getHeight(),
      'canvas.getZoom()': canvas.getZoom(),
      'template getBoundingRect()': br,
    })
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {string} svgUrl
 * @param {string} [svgRaw]
 */
export async function loadTemplateOntoCanvas(canvas, svgUrl, svgRaw) {
  if (!svgRaw) {
    throw new Error('SVG raw string required for viewBox parsing')
  }

  const normalizedRaw = normalizeTemplateSvgForLoad(svgRaw)
  const parsedViewBox = parseViewBoxFromSvgString(normalizedRaw)
  if (!parsedViewBox) {
    throw new Error('SVG template has no viewBox')
  }
  const viewBox = cloneViewBox(parsedViewBox)
  const { width, height } = logicalSizeFromViewBox(viewBox)

  let parsed = await loadSVGFromString(normalizedRaw)
  let objects = (parsed.objects ?? []).filter(Boolean)

  if (objects.length === 0) {
    parsed = await loadSVGFromURL(svgUrl)
    objects = (parsed.objects ?? []).filter(Boolean)
  }

  if (objects.length === 0) {
    throw new Error('SVG template could not be parsed')
  }

  const grouped = util.groupSVGElements(objects, parsed.options)
  markAsTemplateLayer(grouped)

  canvas.clear()
  canvas.backgroundColor = '#ffffff'
  canvas.add(grouped)
  canvas.sendObjectToBack(grouped)

  canvas.__viewBox = viewBox
  setCanvasDocumentSize(canvas, width, height)
  fitTemplateGroupToCanvas(grouped, width, height)

  logTemplateCanvasMetrics(canvas, grouped, 'after loadTemplateOntoCanvas')
  canvas.requestRenderAll()

  return { width, height, viewBox, templateObject: grouped }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} width
 * @param {number} height
 */
export function initBlankCanvas(canvas, width, height) {
  const w = Math.max(1, Number(width) || 1)
  const h = Math.max(1, Number(height) || 1)
  const viewBox = { minX: 0, minY: 0, width: w, height: h }

  canvas.clear()
  canvas.backgroundColor = '#ffffff'
  setCanvasDocumentSize(canvas, w, h, viewBox)
  canvas.requestRenderAll()

  return { width: w, height: h, viewBox }
}

/** @param {import('fabric').Canvas} canvas */
export function buildTemplateExportObject(canvas) {
  const { width, height } = getLogicalSizeFromCanvas(canvas)
  const json = canvas.toJSON()
  return { ...json, width, height }
}
