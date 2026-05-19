import {
  TEMPLATE_LAYER_PROP,
  cloneViewBox,
  getLogicalSizeFromCanvas,
  getTemplate,
  isTemplateLayerObject,
  parseViewBoxFromSvgString,
  setCanvasDocumentSize,
} from './template'

export const WORK_STATE_VERSION = 1

const FABRIC_PROPS = [TEMPLATE_LAYER_PROP]

/**
 * @param {import('../lib/template').EditorConfig} editorConfig
 */
export function defaultWorkName(editorConfig) {
  if (editorConfig.type === 'free') return '자유형'
  if (editorConfig.templateKey === 'vertical') return '세로형'
  return '가로형'
}

/**
 * @param {string} workName
 */
export function formatWorkStateFilename(workName) {
  const safe =
    String(workName || '작업')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 80) || '작업'
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `banner-${safe}-${y}-${m}-${day}.json`
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {import('../lib/template').EditorConfig} editorConfig
 * @param {string} [workName]
 */
export function buildWorkStateExport(canvas, editorConfig, workName = '') {
  const logicalSize = getLogicalSizeFromCanvas(canvas)
  const fabric = canvas.toJSON(FABRIC_PROPS)

  return {
    version: WORK_STATE_VERSION,
    workName: workName.trim() || defaultWorkName(editorConfig),
    savedAt: new Date().toISOString(),
    editorConfig,
    logicalSize,
    viewBox: canvas.__viewBox ? { ...canvas.__viewBox } : null,
    fabric,
  }
}

/** @param {import('fabric').FabricObject} obj */
function applyTemplateLayerLock(obj) {
  if (!isTemplateLayerObject(obj)) return
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
}

/** @param {import('fabric').FabricObject} obj */
function walkObjects(obj, visit) {
  if (!obj) return
  visit(obj)
  if (obj.type === 'group' && typeof obj.getObjects === 'function') {
    for (const child of obj.getObjects()) {
      walkObjects(child, visit)
    }
  }
}

/** @param {import('fabric').Canvas} canvas */
export function reapplyTemplateLayerMarkers(canvas) {
  for (const obj of canvas.getObjects()) {
    walkObjects(obj, applyTemplateLayerLock)
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {unknown} data
 * @returns {Promise<{ logicalSize: { width: number; height: number }; editorConfig: import('../lib/template').EditorConfig | null; workName: string }>}
 */
export function loadWorkStateOntoCanvas(canvas, data) {
  if (!data || typeof data !== 'object') {
    throw new Error('올바른 작업 파일이 아닙니다.')
  }

  const payload = /** @type {Record<string, unknown>} */ (data)
  const fabric = payload.fabric
  if (!fabric || typeof fabric !== 'object') {
    throw new Error('캔버스 데이터가 없습니다.')
  }

  const logicalSize = payload.logicalSize
  const savedViewBox =
    payload.viewBox && typeof payload.viewBox === 'object'
      ? /** @type {{ width?: number; height?: number }} */ (payload.viewBox)
      : null
  let width =
    Number(logicalSize?.width) > 0
      ? Number(logicalSize.width)
      : Number(savedViewBox?.width) > 0
        ? Number(savedViewBox.width)
        : Number(payload.width) > 0
          ? Number(payload.width)
          : null
  let height =
    Number(logicalSize?.height) > 0
      ? Number(logicalSize.height)
      : Number(savedViewBox?.height) > 0
        ? Number(savedViewBox.height)
        : Number(payload.height) > 0
          ? Number(payload.height)
          : null

  if (!width || !height) {
    throw new Error('캔버스 크기 정보가 없습니다.')
  }

  const editorConfig =
    payload.editorConfig && typeof payload.editorConfig === 'object'
      ? /** @type {import('../lib/template').EditorConfig} */ (payload.editorConfig)
      : null

  return new Promise((resolve, reject) => {
    canvas.loadFromJSON(fabric, () => {
      try {
        const viewBox =
          payload.viewBox && typeof payload.viewBox === 'object'
            ? /** @type {{ minX?: number; minY?: number; width: number; height: number }} */ (
                payload.viewBox
              )
            : { minX: 0, minY: 0, width, height }

        reapplyTemplateLayerMarkers(canvas)

        if (editorConfig?.type === 'template' && editorConfig.templateKey) {
          try {
            const template = getTemplate(editorConfig.templateKey)
            const vb = template.raw ? parseViewBoxFromSvgString(template.raw) : null
            if (vb) {
              canvas.__viewBox = cloneViewBox(vb)
            }
          } catch {
            canvas.__viewBox = cloneViewBox(viewBox)
          }
        }

        setCanvasDocumentSize(canvas, width, height, viewBox)

        const resolvedLogical = getLogicalSizeFromCanvas(canvas)
        canvas.discardActiveObject()
        canvas.requestRenderAll()

        resolve({
          logicalSize: resolvedLogical,
          editorConfig,
          workName: String(payload.workName || ''),
        })
      } catch (err) {
        reject(err)
      }
    })
  })
}
