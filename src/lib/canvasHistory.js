import { util } from 'fabric'
import { TEMPLATE_LAYER_PROP, isTemplateLayerObject } from './template'

export const MAX_CANVAS_HISTORY = 50

const FABRIC_HISTORY_PROPS = [TEMPLATE_LAYER_PROP]

/**
 * @param {import('fabric').FabricObject | import('fabric').ActiveSelection | undefined} target
 */
function eventTouchesTemplate(target) {
  if (!target) return false
  if (isTemplateLayerObject(target)) return true
  if (target.type === 'activeselection' || target.type === 'activeSelection') {
    const objs =
      typeof target.getObjects === 'function' ? target.getObjects() : []
    return objs.some((o) => isTemplateLayerObject(o))
  }
  return false
}

/**
 * @param {import('fabric').Canvas} canvas
 */
function captureUserCanvasState(canvas) {
  const json = canvas.toJSON(FABRIC_HISTORY_PROPS)
  json.objects = (json.objects || []).filter(
    (o) => !o?.[TEMPLATE_LAYER_PROP],
  )
  return JSON.stringify(json)
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {string} snapshot
 */
async function applyUserCanvasState(canvas, snapshot) {
  const state = JSON.parse(snapshot)
  const toRemove = canvas.getObjects().filter((o) => !isTemplateLayerObject(o))
  for (const obj of toRemove) {
    canvas.remove(obj)
  }

  const objects = await util.enlivenObjects(state.objects || [])
  const template = canvas.getObjects().find((o) => isTemplateLayerObject(o))

  for (const obj of objects) {
    canvas.add(obj)
  }
  if (template) {
    canvas.sendObjectToBack(template)
  }

  canvas.discardActiveObject()
  canvas.requestRenderAll()
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {{ onChange?: () => void }} [options]
 */
export function attachCanvasHistory(canvas, options = {}) {
  const { onChange } = options

  /** @type {string[]} */
  let states = []
  let index = -1
  let restoring = true
  let disposed = false

  const notify = () => {
    if (!disposed) onChange?.()
  }

  const capture = () => captureUserCanvasState(canvas)

  const pushState = () => {
    if (restoring || disposed) return
    const snap = capture()
    if (index >= 0 && states[index] === snap) return

    states = states.slice(0, index + 1)
    states.push(snap)
    while (states.length > MAX_CANVAS_HISTORY) {
      states.shift()
      index -= 1
    }
    index = states.length - 1
    notify()
  }

  const reset = () => {
    restoring = true
    states = [capture()]
    index = 0
    restoring = false
    notify()
  }

  const canUndo = () => !disposed && index > 0

  const canRedo = () => !disposed && index < states.length - 1

  const undo = async () => {
    if (!canUndo()) return false
    restoring = true
    try {
      index -= 1
      await applyUserCanvasState(canvas, states[index])
      notify()
      return true
    } finally {
      restoring = false
    }
  }

  const redo = async () => {
    if (!canRedo()) return false
    restoring = true
    try {
      index += 1
      await applyUserCanvasState(canvas, states[index])
      notify()
      return true
    } finally {
      restoring = false
    }
  }

  /** @param {import('fabric').TEvent} e */
  const onCanvasChange = (e) => {
    if (eventTouchesTemplate(e?.target)) return
    pushState()
  }

  canvas.on('object:added', onCanvasChange)
  canvas.on('object:modified', onCanvasChange)
  canvas.on('object:removed', onCanvasChange)

  const dispose = () => {
    if (disposed) return
    disposed = true
    canvas.off('object:added', onCanvasChange)
    canvas.off('object:modified', onCanvasChange)
    canvas.off('object:removed', onCanvasChange)
    states = []
    index = -1
  }

  return {
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    dispose,
    /** @param {boolean} value */
    setSuppressRecording(value) {
      restoring = value
    },
  }
}
