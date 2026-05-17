/**
 * Fabric 텍스트 객체에 문자열을 직접 반영 (IText 내부 편집/IME 우회)
 *
 * @param {import('fabric').FabricObject} obj
 * @param {string} text
 * @param {import('fabric').Canvas} [canvas]
 */
export function applyTextToFabricObject(obj, text, canvas) {
  if (!obj) return

  if (obj.isEditing && typeof obj.exitEditing === 'function') {
    obj.exitEditing()
  }

  const value = String(text ?? '')

  obj.set({ text: value })
  if (typeof obj._splitText === 'function') {
    obj._splitText()
  } else if (typeof obj.initDimensions === 'function') {
    obj.initDimensions()
  }
  obj.set?.('dirty', true)
  obj.setCoords?.()
  canvas?.requestRenderAll()
}
