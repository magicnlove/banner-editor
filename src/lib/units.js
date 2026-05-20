/** 96dpi 기준: 1cm = 37.795px */
export const PX_PER_CM = 37.795

export function cmToPx(cm) {
  return cm * PX_PER_CM
}

/** 캔버스·개체 크기 입력 허용 범위 (cm) */
export const CANVAS_MIN_CM = 1
export const CANVAS_MAX_CM = 1000

/** @type {number} 논리 캔버스 최소 px (1cm) */
export const CANVAS_SIZE_MIN_PX = Math.round(cmToPx(CANVAS_MIN_CM))

/** @type {number} 논리 캔버스 최대 px (1000cm) */
export const CANVAS_SIZE_MAX_PX = Math.round(cmToPx(CANVAS_MAX_CM))

export function pxToCm(px) {
  return px / PX_PER_CM
}

/** cm → PDF 포인트 (72pt/in) */
export function cmToPt(cm) {
  return (cm * 72) / 2.54
}

/** @param {number} px @param {number} [fractionDigits] */
export function formatCmFromPx(px, fractionDigits = 1) {
  return (px / PX_PER_CM).toFixed(fractionDigits)
}

/** cm 입력 → px (선 두께 등 서브픽셀 허용) */
export function cmInputToPxFloat(cmStr) {
  const cm = parseCmInput(cmStr)
  if (cm == null) return null
  return cmToPx(cm)
}

/** @param {number} cm */
export function formatCm(cm) {
  return Number(cm).toFixed(1)
}

/** @param {string|number} cmStr */
export function parseCmInput(cmStr) {
  const n = Number.parseFloat(String(cmStr).replace(/,/g, '.'))
  return Number.isFinite(n) ? n : null
}

/** cm 입력 → px (내부용, 정수 반올림) */
export function cmInputToPx(cmStr) {
  const cm = parseCmInput(cmStr)
  if (cm == null) return null
  return Math.round(cmToPx(cm))
}

/** px → cm 숫자 (소수 1자리) */
export function pxToCmRounded(px) {
  return Math.round(pxToCm(px) * 10) / 10
}
