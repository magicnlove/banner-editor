import { PX_PER_CM } from './units'

const NICE_PX = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]

const NICE_CM = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

/**
 * @param {number} zoom
 * @param {'px' | 'cm'} unit
 */
export function pickRulerTickStep(zoom, unit) {
  const z = Math.max(0.05, zoom)
  const targetLogical = 80 / z

  if (unit === 'cm') {
    let stepCm = NICE_CM[NICE_CM.length - 1]
    for (const cm of NICE_CM) {
      if (cm * PX_PER_CM >= targetLogical) {
        stepCm = cm
        break
      }
    }
    return { major: stepCm * PX_PER_CM, labelUnit: 'cm', labelStep: stepCm }
  }

  let stepPx = NICE_PX[NICE_PX.length - 1]
  for (const px of NICE_PX) {
    if (px >= targetLogical) {
      stepPx = px
      break
    }
  }
  return { major: stepPx, labelUnit: 'px', labelStep: stepPx }
}

/**
 * @param {number} logical
 * @param {'px' | 'cm'} unit
 */
export function formatRulerLabel(logical, unit) {
  if (unit === 'cm') {
    const cm = logical / PX_PER_CM
    if (cm >= 100) return String(Math.round(cm))
    if (cm >= 10) return cm.toFixed(0)
    if (cm >= 1) return cm.toFixed(1)
    return cm.toFixed(2)
  }
  if (logical >= 1000) return String(Math.round(logical))
  return String(Math.round(logical))
}
