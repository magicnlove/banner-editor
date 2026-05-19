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
 * viewBox="minX minY width height" (정규화 후 minX/minY는 0)
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

/** @param {unknown} value */
export function preserveLogicalPx(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} width
 * @param {number} height
 * @param {string} [source]
 */
export function setCanvasLogicalSize(canvas, width, height, source = 'unknown') {
  const w = preserveLogicalPx(width)
  const h = preserveLogicalPx(height)
  console.log('[logicalSize set DIRECT]', source, w, h)
  console.trace(`[logicalSize set DIRECT trace] ${source}`)
  canvas.__logicalSize = { width: w, height: h }
}

/**
 * viewBox가 있으면 __logicalSize를 viewBox와 강제 동기화
 * @param {import('fabric').Canvas} canvas
 * @param {string} [source]
 */
export function ensureCanvasLogicalSizeFromViewBox(canvas, source = 'ensure') {
  // 템플릿: 논리 크기는 getBoundingRect 기준 — viewBox로 덮어쓰지 않음
  if (canvas.getObjects?.().some((o) => isTemplateLayerObject(o))) {
    return
  }
  const vb = canvas.__viewBox
  if (!(vb?.width > 0 && vb?.height > 0)) return
  const w = preserveLogicalPx(vb.width)
  const h = preserveLogicalPx(vb.height)
  const cur = canvas.__logicalSize
  if (!cur || cur.width !== w || cur.height !== h) {
    setCanvasLogicalSize(canvas, w, h, `${source}:fromViewBox`)
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} width 논리 px
 * @param {number} height 논리 px
 * @param {string} [source]
 * @param {{ zoom?: number; skipLogicalAssign?: boolean }} [options]
 */
export function setCanvasLogicalDimensions(canvas, width, height, source = 'unknown', options = {}) {
  const w = preserveLogicalPx(width)
  const h = preserveLogicalPx(height)
  const z = options.zoom ?? canvas.getZoom() ?? 1
  if (!options.skipLogicalAssign) {
    setCanvasLogicalSize(canvas, w, h, source)
  }
  const dw = w * z
  const dh = h * z
  console.log('[setDimensions]', source, dw, dh, `(logical ${w}×${h} @zoom ${z})`)
  canvas.setDimensions({ width: dw, height: dh })
  ensureCanvasLogicalSizeFromViewBox(canvas, `${source}:afterSetDimensions`)
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

/**
 * 논리 캔버스 크기 변경 — 모든 오브젝트(템플릿·사용자 추가)를 동일 비율로 스케일
 * @param {import('fabric').Canvas} canvas
 * @param {number} newWidth
 * @param {number} newHeight
 */
export function resizeCanvasLogicalSize(canvas, newWidth, newHeight) {
  const logical = getLogicalSizeFromCanvas(canvas)
  const oldW = logical.width
  const oldH = logical.height
  const nw = Math.max(1, Number(newWidth) || 1)
  const nh = Math.max(1, Number(newHeight) || 1)

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

  const z = canvas.getZoom() || 1
  setCanvasLogicalSize(canvas, nw, nh, 'resizeCanvasLogicalSize')
  setCanvasLogicalDimensions(canvas, nw, nh, 'resizeCanvasLogicalSize', {
    zoom: z,
    skipLogicalAssign: true,
  })
  canvas.calcOffset()
  canvas.requestRenderAll()

  return { scaleX, scaleY, oldWidth: oldW, oldHeight: oldH, newWidth: nw, newHeight: nh }
}

/** @param {import('fabric').Canvas} canvas */
export function getLogicalSizeFromCanvas(canvas) {
  if (canvas.__logicalSize?.width > 0 && canvas.__logicalSize?.height > 0) {
    return {
      width: Number(canvas.__logicalSize.width),
      height: Number(canvas.__logicalSize.height),
    }
  }
  if (canvas.__viewBox?.width > 0 && canvas.__viewBox?.height > 0) {
    return {
      width: Number(canvas.__viewBox.width),
      height: Number(canvas.__viewBox.height),
    }
  }
  const z = canvas.getZoom() || 1
  return {
    width: canvas.getWidth() / z,
    height: canvas.getHeight() / z,
  }
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
 * @param {import('fabric').FabricObject} group
 * @param {{ minX: number; minY: number; width: number; height: number }} viewBox
 */
function alignTemplateGroupToViewBox(group, viewBox) {
  group.set({ originX: 'left', originY: 'top' })
  group.setCoords()
  const br = group.getBoundingRect(true, true)
  group.set({
    left: (group.left ?? 0) + (viewBox.minX - br.left),
    top: (group.top ?? 0) + (viewBox.minY - br.top),
  })
  group.setCoords()
}

/**
 * 템플릿 논리 크기 = viewBox 소수값 그대로 (반올림 없음)
 * @param {{ width: number; height: number }} viewBox
 */
export function logicalSizeFromViewBox(viewBox) {
  return {
    width: preserveLogicalPx(viewBox.width),
    height: preserveLogicalPx(viewBox.height),
  }
}

/** @param {import('fabric').FabricObject} group */
export function logicalSizeFromTemplateGroup(group) {
  group.setCoords()
  const br = group.getBoundingRect(true, true)
  return {
    width: preserveLogicalPx(br.width),
    height: preserveLogicalPx(br.height),
    boundingRect: br,
  }
}

/** @param {import('fabric').FabricObject} group @param {{ width: number; height: number }} [viewBox] */
export function measureTemplateLogicalSize(group, viewBox) {
  return { ...logicalSizeFromTemplateGroup(group), viewBox }
}

/**
 * 정렬만 viewBox 기준, 캔버스·__logicalSize는 템플릿 getBoundingRect() 크기
 * @param {import('fabric').Canvas} canvas
 * @param {import('fabric').FabricObject} group
 * @param {{ minX: number; minY: number; width: number; height: number }} svgViewBox
 */
function applyCanvasDimensionsToTemplateBounds(canvas, group, svgViewBox) {
  alignTemplateGroupToViewBox(group, svgViewBox)
  const { width, height } = logicalSizeFromTemplateGroup(group)
  canvas.__viewBox = cloneViewBox(svgViewBox)
  const z = canvas.getZoom() || 1
  setCanvasLogicalDimensions(canvas, width, height, 'templateBounds', { zoom: z })
  canvas.calcOffset()
  return measureTemplateLogicalSize(group, svgViewBox)
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
  console.log(`[editor/template-size] ${label}`, {
    'canvas.width': canvas.width,
    'canvas.height': canvas.height,
    'canvas.getWidth()': canvas.getWidth(),
    'canvas.getHeight()': canvas.getHeight(),
    'canvas.getZoom()': canvas.getZoom(),
    '__logicalSize.width': logical?.width,
    '__logicalSize.height': logical?.height,
    'template getBoundingRect().width': br?.width,
    'template getBoundingRect().height': br?.height,
    'viewBox width': viewBox?.width,
    'viewBox height': viewBox?.height,
  })
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} width
 * @param {number} height
 * @param {{ minX?: number; minY?: number; width?: number; height?: number }} [viewBox]
 */
export function applyTemplateCanvasDimensions(canvas, width, height, viewBox) {
  console.log('[applyTemplate START]', width, height, viewBox)
  let w
  let h
  if (viewBox?.width > 0 && viewBox?.height > 0) {
    const vb = cloneViewBox(viewBox)
    canvas.__viewBox = vb
    w = vb.width
    h = vb.height
    console.log('[viewBox set]', 'applyTemplateCanvasDimensions', w, h)
  } else {
    w = preserveLogicalPx(width)
    h = preserveLogicalPx(height)
  }
  const z = canvas.getZoom() || 1
  setCanvasLogicalDimensions(canvas, w, h, 'applyTemplateCanvasDimensions', { zoom: z })
  canvas.calcOffset()
}

/** @param {import('fabric').Canvas} canvas */
export function syncCanvasToTemplateBounds(canvas) {
  const template = canvas.getObjects().find((o) => isTemplateLayerObject(o))
  if (!template) return null
  const svgViewBox = canvas.__viewBox
  if (!(svgViewBox?.width > 0 && svgViewBox?.height > 0)) {
    return null
  }
  return applyCanvasDimensionsToTemplateBounds(canvas, template, svgViewBox)
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {string} svgUrl
 * @param {string} [svgRaw]
 */
export async function loadTemplateOntoCanvas(canvas, svgUrl, svgRaw) {
  console.log('[loadTemplate START]')
  if (!svgRaw) {
    throw new Error('SVG raw string required for viewBox parsing')
  }

  const parsedViewBox = parseViewBoxFromSvgString(svgRaw)
  if (!parsedViewBox) {
    throw new Error('SVG template has no viewBox')
  }
  const viewBox = cloneViewBox(parsedViewBox)

  let parsed = await loadSVGFromURL(svgUrl)
  let objects = (parsed.objects ?? []).filter(Boolean)

  if (objects.length === 0 && svgRaw) {
    parsed = await loadSVGFromString(svgRaw)
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

  const measured = applyCanvasDimensionsToTemplateBounds(canvas, grouped, viewBox)
  const { width, height } = measured
  logTemplateCanvasMetrics(canvas, grouped, 'after loadTemplateOntoCanvas')

  canvas.requestRenderAll()

  return { width, height, viewBox, templateObject: grouped, boundingRect: measured.boundingRect }
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
  applyTemplateCanvasDimensions(canvas, w, h, viewBox)
  canvas.requestRenderAll()

  return { width: w, height: h, viewBox }
}

/** @param {import('fabric').Canvas} canvas */
export function buildTemplateExportObject(canvas) {
  const { width, height } = getLogicalSizeFromCanvas(canvas)
  const json = canvas.toJSON()
  return { ...json, width, height }
}
