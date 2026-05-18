/** 96dpi 기준: 1cm = 37.795px */
export const PX_PER_CM = 37.795

export function cmToPx(cm) {
  return cm * PX_PER_CM
}

export function pxToCm(px) {
  return px / PX_PER_CM
}

/** cm → PDF 포인트 (72pt/in) */
export function cmToPt(cm) {
  return (cm * 72) / 2.54
}

/** @param {number} px */
export function formatCmFromPx(px) {
  return (px / PX_PER_CM).toFixed(1)
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
