/**
 * SVG viewBox 좌표를 (0,0) 기준으로 정규화합니다.
 * 사용: node scripts/normalize-svg.js
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TARGETS = [
  join(ROOT, 'src/templates/horizontal.svg'),
  join(ROOT, 'src/templates/vertical.svg'),
]

/** @param {string} svgRaw */
function parseViewBox(svgRaw) {
  const match = svgRaw.match(/viewBox\s*=\s*["']([^"']+)["']/i)
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

/** @param {string} svg @param {{ minX: number, minY: number, width: number, height: number }} viewBox */
function replaceViewBox(svg, viewBox) {
  const next = `0 0 ${viewBox.width} ${viewBox.height}`
  return svg.replace(/viewBox\s*=\s*["'][^"']+["']/i, `viewBox="${next}"`)
}

/**
 * </style> 직후(또는 <svg> 직후) 첫 최상위 <g>에 translate 적용
 * @param {string} svg
 * @param {number} minX
 * @param {number} minY
 */
function applyTopLevelGTransform(svg, minX, minY) {
  const translate = `translate(${-minX},${-minY})`

  const afterStyle = /(<\/style>\s*)(<g)(\s[^>]*)?(>)/i
  if (afterStyle.test(svg)) {
    return svg.replace(afterStyle, (_m, prefix, tag, attrs = '', close) => {
      const cleaned = stripTransformAttr(attrs)
      return `${prefix}${tag} transform="${translate}"${cleaned}${close}`
    })
  }

  const afterSvg = /(<svg\b[^>]*>\s*)(<g)(\s[^>]*)?(>)/i
  return svg.replace(afterSvg, (_m, prefix, tag, attrs = '', close) => {
    const cleaned = stripTransformAttr(attrs)
    return `${prefix}${tag} transform="${translate}"${cleaned}${close}`
  })
}

/** @param {string} attrs */
function stripTransformAttr(attrs) {
  return attrs.replace(/\s*transform\s*=\s*["'][^"']*["']/gi, '')
}

/** @param {string} filePath */
function normalizeSvgFile(filePath) {
  const original = readFileSync(filePath, 'utf8')
  const viewBox = parseViewBox(original)

  if (!viewBox) {
    throw new Error(`${filePath}: viewBox not found`)
  }

  let svg = original
  svg = removeEnableBackground(svg)
  svg = replaceViewBox(svg, viewBox)
  svg = applyTopLevelGTransform(svg, viewBox.minX, viewBox.minY)

  writeFileSync(filePath, svg, 'utf8')

  return {
    file: filePath,
    from: {
      minX: viewBox.minX,
      minY: viewBox.minY,
      width: viewBox.width,
      height: viewBox.height,
    },
    to: {
      viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
      transform: `translate(${-viewBox.minX},${-viewBox.minY})`,
    },
  }
}

for (const filePath of TARGETS) {
  const result = normalizeSvgFile(filePath)
  console.log(`Normalized: ${result.file}`)
  console.log(`  viewBox: ${result.from.minX} ${result.from.minY} ${result.from.width} ${result.from.height}`)
  console.log(`       → ${result.to.viewBox}`)
  console.log(`  <g transform="${result.to.transform}">`)
}

console.log('Done.')
