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

  canvas.__logicalSize = { width: nw, height: nh }
  const z = canvas.getZoom() || 1
  canvas.setDimensions({ width: nw * z, height: nh * z })
  canvas.calcOffset()
  canvas.requestRenderAll()

  return { scaleX, scaleY, oldWidth: oldW, oldHeight: oldH, newWidth: nw, newHeight: nh }
}

/** @param {import('fabric').Canvas} canvas */
export function getLogicalSizeFromCanvas(canvas) {
  if (canvas.__logicalSize?.width > 0 && canvas.__logicalSize?.height > 0) {
    return { ...canvas.__logicalSize }
  }
  if (canvas.__viewBox?.width > 0 && canvas.__viewBox?.height > 0) {
    return { width: canvas.__viewBox.width, height: canvas.__viewBox.height }
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
 * 템플릿 그룹 실제 픽셀 크기 (viewBox보다 작으면 bbox 기준 — 캔버스 여백 방지)
 * @param {import('fabric').FabricObject} group
 * @param {{ width: number; height: number }} viewBox
 */
/** @param {number} measured @param {number} viewDim */
function pickTemplateDimension(measured, viewDim) {
  if (!(measured > 0)) return viewDim
  if (Math.abs(measured - viewDim) <= 1) return viewDim
  if (measured < viewDim) return measured
  return viewDim
}

export function measureTemplateLogicalSize(group, viewBox) {
  group.setCoords()
  const br = group.getBoundingRect(true, true)
  const width = pickTemplateDimension(br.width, viewBox.width)
  const height = pickTemplateDimension(br.height, viewBox.height)
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
    boundingRect: br,
  }
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
  const w = Math.max(1, Number(width) || 1)
  const h = Math.max(1, Number(height) || 1)
  const z = canvas.getZoom() || 1
  canvas.__logicalSize = { width: w, height: h }
  if (viewBox) {
    canvas.__viewBox = {
      minX: viewBox.minX ?? 0,
      minY: viewBox.minY ?? 0,
      width: viewBox.width ?? w,
      height: viewBox.height ?? h,
    }
  }
  canvas.setDimensions({ width: w * z, height: h * z })
  canvas.calcOffset()
}

/** @param {import('fabric').Canvas} canvas */
export function syncCanvasToTemplateBounds(canvas) {
  const template = canvas.getObjects().find((o) => isTemplateLayerObject(o))
  const viewBox = canvas.__viewBox
  if (!template || !viewBox) return null

  alignTemplateGroupToViewBox(template, viewBox)
  const measured = measureTemplateLogicalSize(template, viewBox)
  applyTemplateCanvasDimensions(canvas, measured.width, measured.height, {
    ...viewBox,
    width: measured.width,
    height: measured.height,
  })
  return measured
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

  const viewBox = parseViewBoxFromSvgString(svgRaw)
  if (!viewBox) {
    throw new Error('SVG template has no viewBox')
  }

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
  alignTemplateGroupToViewBox(grouped, viewBox)
  canvas.sendObjectToBack(grouped)

  const measured = measureTemplateLogicalSize(grouped, viewBox)
  const { width, height } = measured
  applyTemplateCanvasDimensions(canvas, width, height, {
    ...viewBox,
    width,
    height,
  })
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
