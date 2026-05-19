/**
 * SVG 내부 좌표를 (0,0) 기준으로 직접 정규화 (translate 래퍼 제거)
 * 사용: node scripts/normalize-svg.js
 */
import { readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TARGETS = [
  join(ROOT, 'src/templates/horizontal.svg'),
  join(ROOT, 'src/templates/vertical.svg'),
]

/** @type {Record<string, { minX: number, minY: number }>} */
const FILE_OFFSETS = {
  'horizontal.svg': { minX: 396, minY: 951.82 },
  'vertical.svg': { minX: 878, minY: 809.82 },
}

const COORD_ATTRS = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy'])

/** @param {number} n */
function formatCoord(n) {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 10000) / 10000
  return String(r).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

/** @param {string} svg */
function parseViewBox(svg) {
  const match = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i)
  if (!match) return null
  const parts = match[1]
    .trim()
    .split(/[\s,]+/)
    .map((n) => Number.parseFloat(n))
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [minX, minY, width, height] = parts
  if (width <= 0 || height <= 0) return null
  return { minX, minY, width, height }
}

/** @param {string} svg */
function removeEnableBackground(svg) {
  return svg.replace(/\s*style="enable-background:[^"]*"/gi, '')
}

/** @param {string} svg @param {{ width: number, height: number }} viewBox */
function replaceViewBox(svg, viewBox) {
  const next = `0 0 ${viewBox.width} ${viewBox.height}`
  return svg.replace(/viewBox\s*=\s*["'][^"']+["']/i, `viewBox="${next}"`)
}

/** @param {string} attrs */
function stripTransformAttr(attrs) {
  return attrs.replace(/\s*transform\s*=\s*["'][^"']*["']/gi, '').replace(/\s+/g, ' ')
}

/** @param {string} svg */
function removeAllGTransforms(svg) {
  return svg.replace(/<g(\s[^>]*)>/gi, (_m, attrs) => {
    const cleaned = stripTransformAttr(attrs || '').trim()
    return cleaned ? `<g ${cleaned}>` : '<g>'
  })
}

/**
 * @param {string} value
 * @param {number} minX
 * @param {number} minY
 */
function transformPointsAttr(value, minX, minY) {
  const nums = value
    .trim()
    .split(/[\s,]+/)
    .map((n) => Number.parseFloat(n))
    .filter((n) => Number.isFinite(n))
  const out = []
  for (let i = 0; i < nums.length; i += 2) {
    if (i + 1 < nums.length) {
      out.push(formatCoord(nums[i] - minX), formatCoord(nums[i + 1] - minY))
    } else {
      out.push(formatCoord(nums[i] - minX))
    }
  }
  return out.join(' ')
}

/**
 * @param {string} d
 * @param {number} minX
 * @param {number} minY
 */
function transformPathD(d, minX, minY) {
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let out = ''
  let m
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1]
    const paramStr = m[2]
    const nums = paramStr
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((n) => Number.parseFloat(n))

    const upper = cmd.toUpperCase()
    const relative = cmd !== upper

    if (upper === 'Z') {
      out += cmd
      continue
    }

    if (relative) {
      out += cmd + paramStr
      continue
    }

    const t = [...nums]
    let i = 0

    switch (upper) {
      case 'M':
      case 'L':
        while (i + 1 < t.length) {
          t[i] -= minX
          t[i + 1] -= minY
          i += 2
        }
        break
      case 'H':
        while (i < t.length) {
          t[i] -= minX
          i += 1
        }
        break
      case 'V':
        while (i < t.length) {
          t[i] -= minY
          i += 1
        }
        break
      case 'C':
        while (i + 5 < t.length) {
          t[i] -= minX
          t[i + 1] -= minY
          t[i + 2] -= minX
          t[i + 3] -= minY
          t[i + 4] -= minX
          t[i + 5] -= minY
          i += 6
        }
        break
      case 'S':
      case 'Q':
        while (i + 3 < t.length) {
          t[i] -= minX
          t[i + 1] -= minY
          t[i + 2] -= minX
          t[i + 3] -= minY
          i += 4
        }
        break
      case 'T':
        while (i + 1 < t.length) {
          t[i] -= minX
          t[i + 1] -= minY
          i += 2
        }
        break
      case 'A':
        while (i + 6 < t.length) {
          t[i + 5] -= minX
          t[i + 6] -= minY
          i += 7
        }
        break
      default:
        break
    }

    const transformed = t

    out += cmd + transformed.map(formatCoord).join(' ')
  }
  return out
}

/** @param {string} svg */
function fixSvgRootXY(svg) {
  return svg.replace(/<svg(\s[^>]*)>/i, (_m, attrs) => {
    const a = attrs
      .replace(/\bx\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\by\s*=\s*["'][^"']*["']/gi, '')
    return `<svg${a} x="0px" y="0px">`
  })
}

/**
 * @param {string} svg
 * @param {number} minX
 * @param {number} minY
 */
function transformSvgCoordinates(svg, minX, minY) {
  const rootMatch = svg.match(/^[\s\S]*?<svg[^>]*>/i)
  if (!rootMatch) return svg
  const head = rootMatch[0]
  let body = svg.slice(head.length)
  let out = body

  out = out.replace(/\bpoints\s*=\s*["']([^"']+)["']/gi, (_m, pts) => {
    return `points="${transformPointsAttr(pts, minX, minY)}"`
  })

  out = out.replace(/\bd\s*=\s*["']([^"']+)["']/gi, (_m, d) => {
    return `d="${transformPathD(d, minX, minY)}"`
  })

  for (const attr of COORD_ATTRS) {
    const attrRe = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'gi')
    out = out.replace(attrRe, (_m, val) => {
      const n = Number.parseFloat(val)
      if (!Number.isFinite(n)) return _m
      const next = attr === 'x' || attr === 'x1' || attr === 'x2' || attr === 'cx' ? n - minX : n - minY
      return `${attr}="${formatCoord(next)}"`
    })
  }

  return head + out
}

/** @param {string} filePath */
function normalizeSvgFile(filePath) {
  const name = basename(filePath)
  const offset = FILE_OFFSETS[name]
  if (!offset) {
    throw new Error(`${filePath}: no offset config for ${name}`)
  }

  const { minX, minY } = offset
  const original = readFileSync(filePath, 'utf8')
  const viewBox = parseViewBox(original)
  if (!viewBox) {
    throw new Error(`${filePath}: viewBox not found`)
  }

  let svg = original
  svg = removeEnableBackground(svg)
  svg = replaceViewBox(svg, viewBox)
  svg = removeAllGTransforms(svg)
  svg = transformSvgCoordinates(svg, minX, minY)
  svg = fixSvgRootXY(svg)

  writeFileSync(filePath, svg, 'utf8')

  return {
    file: filePath,
    offset: { minX, minY },
    viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
  }
}

for (const filePath of TARGETS) {
  const result = normalizeSvgFile(filePath)
  console.log(`Normalized: ${result.file}`)
  console.log(`  offset: x-${result.offset.minX}, y-${result.offset.minY}`)
  console.log(`  viewBox: ${result.viewBox}`)
}

console.log('Done.')
