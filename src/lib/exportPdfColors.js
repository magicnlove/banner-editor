import { rgb } from 'pdf-lib'

const DEFAULT_TEXT_RGB = rgb(26 / 255, 29 / 255, 36 / 255)

/**
 * @param {string} hex
 */
function parseHexColor(hex) {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (h.length !== 6) return null
  const n = Number.parseInt(h, 16)
  if (!Number.isFinite(n)) return null
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  }
}

/**
 * Fabric fill → pdf-lib rgb()
 * @param {unknown} fill
 */
export function fillToPdfRgb(fill) {
  if (fill == null || fill === '') return DEFAULT_TEXT_RGB

  if (typeof fill === 'object' && fill !== null) {
    if (typeof fill.toHex === 'function') {
      const hex = fill.toHex()
      const parsed = parseHexColor(hex)
      if (parsed) {
        return rgb(parsed.r / 255, parsed.g / 255, parsed.b / 255)
      }
    }
    if (typeof fill.toRgb === 'function') {
      const c = fill.toRgb()
      if (c) return rgb(c.r / 255, c.g / 255, c.b / 255)
    }
  }

  if (typeof fill !== 'string') return DEFAULT_TEXT_RGB

  const value = fill.trim()
  if (!value || value === 'transparent' || value === 'none') {
    return DEFAULT_TEXT_RGB
  }

  if (value.startsWith('#')) {
    const parsed = parseHexColor(value)
    if (parsed) {
      return rgb(parsed.r / 255, parsed.g / 255, parsed.b / 255)
    }
  }

  const rgbMatch = value.match(
    /rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i,
  )
  if (rgbMatch) {
    const toUnit = (v) =>
      Math.min(1, Math.max(0, Number.parseFloat(v) / 255))
    return rgb(toUnit(rgbMatch[1]), toUnit(rgbMatch[2]), toUnit(rgbMatch[3]))
  }

  return DEFAULT_TEXT_RGB
}
