import { IText, Rect, Circle, Triangle, FabricImage, Line } from 'fabric'
import { FONT_FAMILY_NOTO, loadCanvasTextFontsAndRender } from './appFonts'
import { placeObjectAtCanvasCenter } from './fabricPlacement'

const DEFAULT_LINE_LENGTH = 200

export async function addTextToCanvas(canvas) {
  const text = new IText('텍스트를 입력하세요', {
    fontFamily: FONT_FAMILY_NOTO,
    fontSize: 56,
    fill: '#1a1d24',
    fontWeight: '600',
    editable: false,
    originX: 'center',
    originY: 'center',
  })
  placeObjectAtCanvasCenter(canvas, text)
  canvas.add(text)
  canvas.setActiveObject(text)
  await document.fonts.load(`600 56px "${FONT_FAMILY_NOTO}"`)
  await loadCanvasTextFontsAndRender(canvas)
}

export function addRectToCanvas(canvas) {
  const r = new Rect({
    width: 280,
    height: 160,
    fill: '#ffedd5',
    stroke: '#fdba74',
    strokeWidth: 2,
    rx: 12,
    ry: 12,
    originX: 'center',
    originY: 'center',
  })
  placeObjectAtCanvasCenter(canvas, r)
  canvas.add(r)
  canvas.setActiveObject(r)
  canvas.requestRenderAll()
}

export function addCircleToCanvas(canvas) {
  const c = new Circle({
    radius: 90,
    fill: '#dbeafe',
    stroke: '#93c5fd',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
  })
  placeObjectAtCanvasCenter(canvas, c)
  canvas.add(c)
  canvas.setActiveObject(c)
  canvas.requestRenderAll()
}

export function addTriangleToCanvas(canvas) {
  const t = new Triangle({
    width: 200,
    height: 200,
    fill: '#dcfce7',
    stroke: '#86efac',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
  })
  placeObjectAtCanvasCenter(canvas, t)
  canvas.add(t)
  canvas.setActiveObject(t)
  canvas.requestRenderAll()
}

export function addLineToCanvas(canvas) {
  const line = new Line([0, 0, DEFAULT_LINE_LENGTH, 0], {
    stroke: '#1a1d24',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
  })
  placeObjectAtCanvasCenter(canvas, line)
  canvas.add(line)
  canvas.setActiveObject(line)
  canvas.requestRenderAll()
}

export function addImageFromFile(canvas, file) {
  const url = URL.createObjectURL(file)
  return FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    .then((img) => {
      img.set({ originX: 'center', originY: 'center' })
      placeObjectAtCanvasCenter(canvas, img)
      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.requestRenderAll()
      URL.revokeObjectURL(url)
    })
    .catch(() => {
      URL.revokeObjectURL(url)
    })
}

/** @param {import('fabric').Line} line */
export function getLineLengthPx(line) {
  const x1 = line.x1 ?? 0
  const y1 = line.y1 ?? 0
  const x2 = line.x2 ?? 0
  const y2 = line.y2 ?? 0
  const dx = x2 - x1
  const dy = y2 - y1
  const base = Math.sqrt(dx * dx + dy * dy) || 1
  return Math.max(1, base * (line.scaleX ?? 1))
}

/** @param {import('fabric').Line} line @param {number} lengthPx */
export function setLineLengthPx(line, lengthPx) {
  const x1 = line.x1 ?? 0
  const y1 = line.y1 ?? 0
  const x2 = line.x2 ?? 0
  const y2 = line.y2 ?? 0
  const dx = x2 - x1
  const dy = y2 - y1
  const base = Math.sqrt(dx * dx + dy * dy) || 1
  const len = Math.max(1, lengthPx)
  line.set({
    scaleX: len / base,
    scaleY: 1,
    originX: 'center',
    originY: 'center',
  })
  line.setCoords()
}
