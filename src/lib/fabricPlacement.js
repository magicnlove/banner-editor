import { getLogicalSizeFromCanvas } from './template'

/** @param {import('fabric').Canvas} canvas */
export function getCanvasCenter(canvas) {
  const { width, height } = getLogicalSizeFromCanvas(canvas)
  return { left: width / 2, top: height / 2 }
}

/** @param {import('fabric').Canvas} canvas @param {import('fabric').FabricObject} obj */
export function placeObjectAtCanvasCenter(canvas, obj) {
  const { left, top } = getCanvasCenter(canvas)
  obj.set({
    left,
    top,
    originX: 'center',
    originY: 'center',
  })
  obj.setCoords()
}

/** @param {import('fabric').FabricObject} obj @param {number} w @param {number} h */
export function setObjectScaledSizeCentered(obj, w, h) {
  const baseW = obj.width || 1
  const baseH = obj.height || 1
  obj.set({
    scaleX: w / baseW,
    scaleY: h / baseH,
    originX: 'center',
    originY: 'center',
  })
  obj.setCoords()
}
