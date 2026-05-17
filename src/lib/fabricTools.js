import { IText, Rect, Circle, Triangle, FabricImage } from 'fabric'
import { FONT_FAMILY_NOTO, loadCanvasTextFontsAndRender } from './appFonts'

export async function addTextToCanvas(canvas) {
  const text = new IText('텍스트를 입력하세요', {
    left: 120,
    top: 120,
    fontFamily: FONT_FAMILY_NOTO,
    fontSize: 56,
    fill: '#1a1d24',
    fontWeight: '600',
    editable: false,
  })
  canvas.add(text)
  canvas.setActiveObject(text)
  await document.fonts.load(`600 56px "${FONT_FAMILY_NOTO}"`)
  await loadCanvasTextFontsAndRender(canvas)
}

export function addRectToCanvas(canvas) {
  const r = new Rect({
    left: 100,
    top: 100,
    width: 280,
    height: 160,
    fill: '#ffedd5',
    stroke: '#fdba74',
    strokeWidth: 2,
    rx: 12,
    ry: 12,
  })
  canvas.add(r)
  canvas.setActiveObject(r)
  canvas.requestRenderAll()
}

export function addCircleToCanvas(canvas) {
  const c = new Circle({
    left: 140,
    top: 140,
    radius: 90,
    fill: '#dbeafe',
    stroke: '#93c5fd',
    strokeWidth: 2,
  })
  canvas.add(c)
  canvas.setActiveObject(c)
  canvas.requestRenderAll()
}

export function addTriangleToCanvas(canvas) {
  const t = new Triangle({
    left: 160,
    top: 120,
    width: 200,
    height: 200,
    fill: '#dcfce7',
    stroke: '#86efac',
    strokeWidth: 2,
  })
  canvas.add(t)
  canvas.setActiveObject(t)
  canvas.requestRenderAll()
}

export function addImageFromFile(canvas, file) {
  const url = URL.createObjectURL(file)
  return FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    .then((img) => {
      img.set({ left: 60, top: 60 })
      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.requestRenderAll()
      URL.revokeObjectURL(url)
    })
    .catch(() => {
      URL.revokeObjectURL(url)
    })
}
