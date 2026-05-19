import { loadSVGFromString, util, Rect } from 'fabric'
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

/** @param {unknown} value */
export function preserveLogicalPx(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

/**
 * canvas.setDimensions 호출 추적 (919px 등 원인 디버그)
 * @param {import('fabric').Canvas} canvas
 * @param {number} width
 * @param {number} height
 * @param {string} source
 */
export function setCanvasDimensionsWithLog(canvas, width, height, source) {
  const w = Number(width)
  const h = Number(height)
  console.log('[canvas.setDimensions]', source, {
    width: w,
    height: h,
    __logicalSize: canvas.__logicalSize,
    __viewBox: canvas.__viewBox,
    zoom: canvas.getZoom?.() ?? 1,
    beforeGetWidth: canvas.getWidth?.(),
    beforeGetHeight: canvas.getHeight?.(),
  })
  canvas.setDimensions({ width: w, height: h })
}

/**
 * 문서 논리 크기 =보내기 해상도 (줌과 무관)
 * @param {import('fabric').Canvas} canvas
 * @param {number} width
 * @param {number} height
 */
export function setCanvasLogicalSize(canvas, width, height) {
  canvas.__logicalSize = {
    width: Math.ceil(preserveLogicalPx(width)),
    height: Math.ceil(preserveLogicalPx(height)),
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
  setCanvasDimensionsWithLog(
    canvas,
    Math.round(width * z),
    Math.round(height * z),
    'template.js:syncCanvasBufferToLogicalZoom',
  )
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
  setCanvasDimensionsWithLog(canvas, w, h, 'template.js:setCanvasDocumentSize')
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

  // 스케일 리셋 후 (0,0) 배치
  group.set({
    scaleX: 1,
    scaleY: 1,
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
  })
  group.setCoords()

  const br = group.getBoundingRect(true, true)
  if (!(br.width > 0 && br.height > 0)) return

  const scaleX = cw / br.width
  const scaleY = ch / br.height

  group.set({ scaleX, scaleY, left: -br.left * scaleX, top: -br.top * scaleY })
  group.setCoords()
}

/** @param {import('fabric').Canvas} canvas */
export function fitTemplateToCanvas(canvas) {
  const template = canvas.getObjects().find((o) => isTemplateLayerObject(o))
  if (!template) return null
  const { width, height } = getLogicalSizeFromCanvas(canvas)
  fitTemplateGroupToCanvas(template, width, height)
  return { width, height }
}

/** @param {import('fabric').Canvas} canvas */
export function captureTemplateTransform(canvas) {
  const template = canvas.getObjects().find((o) => isTemplateLayerObject(o))
  if (!template) return null
  return {
    left: template.left ?? 0,
    top: template.top ?? 0,
    scaleX: template.scaleX ?? 1,
    scaleY: template.scaleY ?? 1,
    originX: template.originX ?? 'left',
    originY: template.originY ?? 'top',
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {ReturnType<typeof captureTemplateTransform>} state
 */
export function restoreTemplateTransform(canvas, state) {
  if (!state) return
  const template = canvas.getObjects().find((o) => isTemplateLayerObject(o))
  if (!template) return
  template.set(state)
  template.setCoords()
}

/**
 * @param {import('fabric').FabricObject} obj
 * @param {number} scaleX
 * @param {number} scaleY
 */
function scaleObjectForCanvasResize(obj, scaleX, scaleY) {
  const strokeScale = (scaleX + scaleY) / 2
  const patch = {
    left: (obj.left ?? 0) * scaleX,
    top: (obj.top ?? 0) * scaleY,
    scaleX: (obj.scaleX ?? 1) * scaleX,
    scaleY: (obj.scaleY ?? 1) * scaleY,
  }
  if (obj.strokeWidth != null && obj.strokeWidth > 0) {
    patch.strokeWidth = obj.strokeWidth * strokeScale
  }
  const type = obj.type
  if ((type === 'textbox' || type === 'i-text' || type === 'text') && obj.width != null) {
    patch.width = (obj.width ?? 0) * scaleX
  }
  obj.set(patch)
  obj.setCoords()
}

/**
 * 논리 캔버스 크기 변경 — 템플릿 포함 모든 오브젝트에 동일 비율 스케일
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
    scaleObjectForCanvasResize(obj, scaleX, scaleY)
  }

  setCanvasLogicalSize(canvas, nw, nh)
  if (canvas.__viewBox) {
    canvas.__viewBox = cloneViewBox({
      minX: canvas.__viewBox.minX,
      minY: canvas.__viewBox.minY,
      width: nw,
      height: nh,
    })
  }

  const z = canvas.getZoom() || 1
  canvas.setDimensions({
    width: Math.round(nw * z),
    height: Math.round(nh * z),
  })
  canvas.calcOffset()
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
    throw new Error('SVG raw string required')
  }

  const parsedViewBox = parseViewBoxFromSvgString(svgRaw)
  if (!parsedViewBox) {
    throw new Error('SVG template has no viewBox')
  }
  const viewBox = cloneViewBox(parsedViewBox)

  const parsed = await loadSVGFromString(svgRaw)
  const objects = (parsed.objects ?? []).filter(Boolean)

  if (objects.length === 0) {
    throw new Error('SVG template could not be parsed')
  }

  const grouped = util.groupSVGElements(objects, parsed.options)
  markAsTemplateLayer(grouped)

  canvas.clear()
  canvas.backgroundColor = '#ffffff'

  canvas.setDimensions({ width: viewBox.width, height: viewBox.height })
  setCanvasLogicalSize(canvas, viewBox.width, viewBox.height)
  canvas.__viewBox = viewBox

  canvas.add(grouped)
  canvas.sendObjectToBack(grouped)

  const { width, height } = getLogicalSizeFromCanvas(canvas)
  canvas.clipPath = new Rect({
    left: 0,
    top: 0,
    width,
    height,
    absolutePositioned: true,
  })

  canvas.requestRenderAll()

  return {
    width: viewBox.width,
    height: viewBox.height,
    viewBox,
    templateObject: grouped,
  }
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
