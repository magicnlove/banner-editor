import { BUNDLED_FONT_FAMILY_NAMES } from './bundledFonts'

/** 캔버스·UI 공통 한글 폰트 패밀리 */
export const FONT_FAMILY_NOTO = 'Noto Sans KR'

/**
 * 앱·Fabric 캔버스 초기화 전 호출 — @font-face 로컬 파일 로드 완료 대기
 */
export async function ensureAppFontsReady() {
  await document.fonts.ready
  const loads = [
    document.fonts.load(`400 16px "${FONT_FAMILY_NOTO}"`),
    document.fonts.load(`600 16px "${FONT_FAMILY_NOTO}"`),
    ...BUNDLED_FONT_FAMILY_NAMES.flatMap((family) => [
      document.fonts.load(`400 16px "${family}"`),
      document.fonts.load(`600 16px "${family}"`),
    ]),
  ]
  await Promise.all(loads.map((p) => p.catch(() => {})))
  await document.fonts.ready
}

function isTextLikeObject(obj) {
  return (
    obj &&
    (obj.type === 'text' ||
      obj.type === 'i-text' ||
      obj.type === 'textbox' ||
      typeof obj._renderText === 'function')
  )
}

function walkTextObjects(obj, visit) {
  if (!obj) return
  if (isTextLikeObject(obj)) visit(obj)
  if (obj.type === 'group' && typeof obj.getObjects === 'function') {
    for (const child of obj.getObjects()) walkTextObjects(child, visit)
  }
}

/**
 * 캔버스 텍스트에 쓰인 크기·굵기로 FontFace 로드 후 다시 그리기
 * @param {import('fabric').Canvas} canvas
 */
export async function loadCanvasTextFontsAndRender(canvas) {
  if (!canvas) return

  const loads = [
    document.fonts.load(`400 16px "${FONT_FAMILY_NOTO}"`),
    document.fonts.load(`600 16px "${FONT_FAMILY_NOTO}"`),
  ]

  for (const obj of canvas.getObjects()) {
    walkTextObjects(obj, (o) => {
      const families = (o.fontFamily || FONT_FAMILY_NOTO)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
      const size = Math.max(1, Math.round(o.fontSize || 16))
      const weight = o.fontWeight === 'bold' || Number(o.fontWeight) >= 600 ? 600 : 400
      for (const fam of families) {
        loads.push(document.fonts.load(`${weight} ${size}px "${fam}"`))
      }
    })
  }

  await Promise.all(loads.map((p) => p.catch(() => {})))
  await document.fonts.ready
  canvas.requestRenderAll()
}
