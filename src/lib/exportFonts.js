/**
 *보내기용 한글·웹폰트 로드 및 SVG @font-face 임베드
 */

import notoSansKrRegularWoff2 from '../assets/fonts/NotoSansKR-Regular.woff2?url'
import notoSansKrSemiBoldWoff2 from '../assets/fonts/NotoSansKR-SemiBold.woff2?url'
import { BUNDLED_FONT_URL_BY_FAMILY } from './bundledFonts'
import { loadCanvasTextFontsAndRender } from './appFonts'

/**
 * 로컬 번들 폰트 (src/assets/fonts, Vite ?url)
 * @type {Record<string, { woff2Regular: string; woff2SemiBold: string }>}
 */
const LOCAL_APP_FONT_URLS = {
  'Noto Sans KR': {
    woff2Regular: notoSansKrRegularWoff2,
    woff2SemiBold: notoSansKrSemiBoldWoff2,
  },
}

/** 시스템 폰트 →보내기 시 임베드 가능한 폰트로 대체 */
export const FONT_EXPORT_SUBSTITUTE = {
  'Malgun Gothic': 'Noto Sans KR',
  'Apple SD Gothic Neo': 'Noto Sans KR',
  '맑은 고딕': 'Noto Sans KR',
  Arial: 'Noto Sans KR',
  Georgia: 'Noto Sans KR',
}

const bundledAssetBase64Cache = new Map()

export function splitFontFamilyList(value) {
  if (!value || typeof value !== 'string') return []
  return value
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

/** @param {import('fabric').FabricObject} obj */
function walkFabricObject(obj, visit) {
  if (!obj) return
  visit(obj)
  if (obj.type === 'group' && typeof obj.getObjects === 'function') {
    for (const child of obj.getObjects()) {
      walkFabricObject(child, visit)
    }
  }
}

/** @param {import('fabric').Canvas} canvas */
export function collectFontFamiliesFromCanvas(canvas) {
  const set = new Set()
  let hasText = false

  for (const obj of canvas.getObjects()) {
    walkFabricObject(obj, (o) => {
      if (o.type === 'text' || o.type === 'i-text' || o.type === 'textbox' || o.fontFamily) {
        hasText = true
        for (const f of splitFontFamilyList(o.fontFamily)) {
          if (f) set.add(f)
        }
      }
    })
  }

  if (hasText) {
    set.add('Noto Sans KR')
  }

  return [...set]
}

export function resolveExportFontFamily(family) {
  return FONT_EXPORT_SUBSTITUTE[family] ?? family
}

function uint8ToBinaryString(u8) {
  const chunk = 0x8000
  let s = ''
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk))
  }
  return s
}

export function binaryToBase64(binaryString) {
  return btoa(binaryString)
}

/** @param {ArrayBuffer | Uint8Array} buffer */
export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return binaryToBase64(uint8ToBinaryString(bytes))
}

/** @param {string} base64 */
function base64ToBinaryString(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return uint8ToBinaryString(bytes)
}

/**
 * 번들된 woff2/폰트 에셋 URL(Vite)을 fetch → base64
 * @param {string} assetUrl
 */
export async function fetchBundledAssetAsBase64(assetUrl) {
  if (bundledAssetBase64Cache.has(assetUrl)) {
    return bundledAssetBase64Cache.get(assetUrl)
  }
  const res = await fetch(assetUrl)
  if (!res.ok) {
    throw new Error(`로컬 폰트 로드 실패 (${res.status}): ${assetUrl}`)
  }
  const base64 = arrayBufferToBase64(await res.arrayBuffer())
  bundledAssetBase64Cache.set(assetUrl, base64)
  return base64
}

/** @returns {Promise<{ regular: string; semiBold: string }>} */
export async function loadLocalNotoSansKrWoff2Base64() {
  const [regular, semiBold] = await Promise.all([
    fetchBundledAssetAsBase64(notoSansKrRegularWoff2),
    fetchBundledAssetAsBase64(notoSansKrSemiBoldWoff2),
  ])
  return { regular, semiBold }
}

/**
 * @param {string} resolved
 * @param {string} family
 * @param {number} cssWeight
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 */
function loadCustomFontBinary(family, resolved, customFonts) {
  const custom = customFonts.find(
    (c) => c.family === family || c.family === resolved,
  )
  if (!custom?.fileData) return null
  return {
    binary: uint8ToBinaryString(new Uint8Array(custom.fileData)),
    format: 'truetype',
  }
}

/**
 * @param {string} resolved
 * @param {string} family
 * @param {number} [cssWeight]
 */
async function loadWoff2Binary(resolved, family, cssWeight = 400) {
  const local = LOCAL_APP_FONT_URLS[resolved] ?? LOCAL_APP_FONT_URLS[family]
  if (!local?.woff2Regular) return null

  const assetUrl =
    cssWeight >= 600 && local.woff2SemiBold
      ? local.woff2SemiBold
      : local.woff2Regular

  const base64 = await fetchBundledAssetAsBase64(assetUrl)
  return { binary: base64ToBinaryString(base64), format: 'woff2' }
}

/**
 * @param {string} resolved
 * @param {string} family
 */
async function loadBundledTtfBinary(resolved, family) {
  const assetUrl =
    BUNDLED_FONT_URL_BY_FAMILY[resolved] ?? BUNDLED_FONT_URL_BY_FAMILY[family]
  if (!assetUrl) return null

  const base64 = await fetchBundledAssetAsBase64(assetUrl)
  return { binary: base64ToBinaryString(base64), format: 'truetype' }
}

/**
 * @param {string} family
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 * @param {{ cssWeight?: number }} [options]
 * @returns {Promise<{ binary: string; format: 'woff2' | 'truetype' } | null>}
 */
export async function loadFontBinaryForExport(
  family,
  customFonts = [],
  options = {},
) {
  const { cssWeight = 400 } = options
  const resolved = resolveExportFontFamily(family)

  const custom = loadCustomFontBinary(family, resolved, customFonts)
  if (custom) return custom

  if (resolved === 'Noto Sans KR') {
    try {
      return await loadWoff2Binary(resolved, family, cssWeight)
    } catch {
      return null
    }
  }

  try {
    return await loadBundledTtfBinary(resolved, family)
  } catch {
    return null
  }
}

/**
 * @param {string[]} families
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 */
export async function ensureFontsReady(families, customFonts = []) {
  await document.fonts.ready

  const toLoad = new Set()
  for (const fam of families) {
    toLoad.add(fam)
    const sub = resolveExportFontFamily(fam)
    if (sub !== fam) toLoad.add(sub)
  }
  toLoad.add('Noto Sans KR')

  await Promise.all(
    [...toLoad].map(async (fam) => {
      try {
        await document.fonts.load(`400 16px "${fam}"`)
        await document.fonts.load(`600 16px "${fam}"`)
      } catch {
        /* ignore */
      }
      await loadFontBinaryForExport(fam, customFonts).catch(() => null)
    }),
  )

  await new Promise((r) => {
    requestAnimationFrame(() => requestAnimationFrame(r))
  })
}

function buildFontFaceRule(family, base64, format, fontWeight = '100 900') {
  const mime = format === 'woff2' ? 'font/woff2' : 'font/truetype'
  const fmt = format === 'woff2' ? 'woff2' : 'truetype'
  const safeName = family.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `@font-face {
  font-family: '${safeName}';
  src: url('data:${mime};base64,${base64}') format('${fmt}');
  font-weight: ${fontWeight};
  font-style: normal;
  font-display: swap;
}`
}

/**
 * Noto Sans KR Regular TTF → base64 @font-face (일러스트·SVG/PDF 호환)
 * @returns {Promise<string | null>} base64
 */
export async function loadNotoSansKrRegularTtfBase64() {
  const { regular } = await loadLocalNotoSansKrWoff2Base64()
  return regular
}

/**
 * @param {string} svgInner
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 */
export async function embedNotoSansKrFontFaceInSvg(svgInner) {
  const { regular, semiBold } = await loadLocalNotoSansKrWoff2Base64()
  const rules = [
    buildFontFaceRule('Noto Sans KR', regular, 'woff2', '400'),
    buildFontFaceRule('Noto Sans KR', semiBold, 'woff2', '700'),
  ]

  if (rules.length === 0) return svgInner

  const styleBlock = `<style type="text/css">\n${rules.join('\n\n')}\n</style>`
  const defsMatch = svgInner.match(/<defs[^>]*>/i)
  if (defsMatch) {
    return svgInner.replace(defsMatch[0], `${defsMatch[0]}\n${styleBlock}`)
  }
  const svgOpen = svgInner.match(/<svg[^>]*>/i)
  if (svgOpen) {
    return svgInner.replace(
      svgOpen[0],
      `${svgOpen[0]}\n<defs>\n${styleBlock}\n</defs>`,
    )
  }
  return `<defs>\n${styleBlock}\n</defs>\n${svgInner}`
}

/**
 * @param {string} svgInner
 * @param {string[]} families
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 */
export async function embedFontsInSvgString(
  svgInner,
  families,
  customFonts = [],
  options = {},
) {
  const { notoOnly = false } = options

  if (notoOnly) {
    return embedNotoSansKrFontFaceInSvg(svgInner)
  }

  const embeddedFamilies = new Set()
  const rules = []

  const targets = new Set(families.map(resolveExportFontFamily))
  targets.add('Noto Sans KR')

  for (const fam of targets) {
    if (embeddedFamilies.has(fam)) continue
    const loaded = await loadFontBinaryForExport(fam, customFonts, options)
    if (!loaded) continue
    const b64 = binaryToBase64(loaded.binary)
    rules.push(buildFontFaceRule(fam, b64, loaded.format))
    embeddedFamilies.add(fam)
  }

  if (rules.length === 0) return svgInner

  const styleBlock = `<style type="text/css">\n${rules.join('\n\n')}\n</style>`
  const defsMatch = svgInner.match(/<defs[^>]*>/i)
  if (defsMatch) {
    return svgInner.replace(defsMatch[0], `${defsMatch[0]}\n${styleBlock}`)
  }
  const svgOpen = svgInner.match(/<svg[^>]*>/i)
  if (svgOpen) {
    return svgInner.replace(svgOpen[0], `${svgOpen[0]}\n<defs>\n${styleBlock}\n</defs>`)
  }
  return `<defs>\n${styleBlock}\n</defs>\n${svgInner}`
}

/** @param {string} styleStr */
function parseInlineStyle(styleStr) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!styleStr || typeof styleStr !== 'string') return out
  for (const part of styleStr.split(';')) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim().toLowerCase()
    const val = part.slice(idx + 1).trim()
    if (key) out[key] = val
  }
  return out
}

/**
 * drawSvg가 읽을 수 있게 CSS 색 → #rrggbb
 * @param {string | null | undefined} color
 */
function cssColorToHex(color) {
  if (!color || typeof color !== 'string') return null
  const c = color.trim().toLowerCase()
  if (c === 'none' || c === 'transparent') return null
  if (c.startsWith('#')) {
    if (c.length === 4) {
      const r = c[1]
      const g = c[2]
      const b = c[3]
      return `#${r}${r}${g}${g}${b}${b}`
    }
    return c.length === 7 ? c : null
  }
  const m = c.match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/)
  if (!m) return null
  const toByte = (v) =>
    Math.min(255, Math.max(0, Math.round(Number.parseFloat(v))))
  const r = toByte(m[1])
  const g = toByte(m[2])
  const b = toByte(m[3])
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * PDF drawSvg용 font-weight 정규화.
 * 편집기: 400=Regular, 600=SemiBold → PDF: normal=Regular TTF, bold=SemiBold TTF
 * @param {string} svgInner
 */
export function normalizeSvgTextForPdf(svgInner) {
  let out = substituteNonEmbeddableFontsInSvg(svgInner)

  out = out.replace(/font-weight\s*=\s*["'](\d+)["']/gi, (_, w) => {
    const n = Number.parseInt(w, 10)
    return `font-weight="${!Number.isFinite(n) || n < 600 ? 'normal' : 'bold'}"`
  })

  out = out.replace(
    /font-weight\s*:\s*(\d+)/gi,
    (_, w) => {
      const n = Number.parseInt(w, 10)
      return `font-weight:${!Number.isFinite(n) || n < 600 ? 'normal' : 'bold'}`
    },
  )

  out = out.replace(
    /<text\b([^>]*)>/gi,
    (match, attrs) => {
      if (/font-family\s*=/i.test(attrs)) return match
      return `<text font-family="Noto Sans KR"${attrs}>`
    },
  )

  return out
}

const PDF_TEXT_DEFAULT_FILL = '#1a1d24'

/**
 * drawSvg는 &lt;text&gt;의 style·tspan·opacity 상속을 제대로 처리하지 못함.
 * fill / fill-opacity / font-weight를 속성으로 고정합니다.
 * @param {string} svgInner
 */
export function prepareSvgTextForPdfDraw(svgInner) {
  let out = normalizeSvgTextForPdf(svgInner)

  if (typeof DOMParser === 'undefined') return out

  const wrapped = out.trim().startsWith('<svg')
    ? out
    : `<svg xmlns="http://www.w3.org/2000/svg">${out}</svg>`

  const doc = new DOMParser().parseFromString(wrapped, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return out

  for (const textEl of doc.querySelectorAll('text')) {
    const style = parseInlineStyle(textEl.getAttribute('style'))
    const firstTspan = textEl.querySelector('tspan')
    const tspanStyle = parseInlineStyle(firstTspan?.getAttribute('style'))

    let fill =
      textEl.getAttribute('fill') ||
      style.fill ||
      tspanStyle.fill ||
      PDF_TEXT_DEFAULT_FILL

    const hex = cssColorToHex(fill) || PDF_TEXT_DEFAULT_FILL
    textEl.setAttribute('fill', hex)

    const fillOpacityRaw = style['fill-opacity'] ?? tspanStyle['fill-opacity']
    const opacityRaw = style.opacity ?? tspanStyle.opacity
    let alpha = 1
    if (fillOpacityRaw !== undefined && fillOpacityRaw !== '') {
      alpha = Number.parseFloat(fillOpacityRaw)
    } else if (opacityRaw !== undefined && opacityRaw !== '') {
      alpha = Number.parseFloat(opacityRaw)
    }
    if (!Number.isFinite(alpha) || alpha <= 0) alpha = 1
    textEl.setAttribute('fill-opacity', String(Math.min(1, alpha)))

    const fwAttr = textEl.getAttribute('font-weight')
    const fwStyle = style['font-weight'] || tspanStyle['font-weight']
    const fw = fwAttr || fwStyle || 'normal'
    const n = Number.parseInt(String(fw), 10)
    textEl.setAttribute(
      'font-weight',
      fw === 'bold' || (Number.isFinite(n) && n >= 600) ? 'bold' : 'normal',
    )

    if (!textEl.getAttribute('font-family')) {
      textEl.setAttribute('font-family', 'Noto Sans KR')
    }

    delete style.fill
    delete style['fill-opacity']
    delete style.opacity
    const styleRest = Object.entries(style)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')
    if (styleRest) textEl.setAttribute('style', styleRest)
    else textEl.removeAttribute('style')
  }

  return doc.documentElement.outerHTML
}

/**
 * PDF용 Regular + SemiBold TTF (화면 굵기와 맞춤)
 * @param {string} family
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 * @returns {Promise<{ regular: string; bold: string } | null>}
 */
/**
 * svg2pdf + jsPDF용 Noto Sans KR TTF VFS 등록 (한글 필수)
 * @param {import('jspdf').jsPDF} doc
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 */
export async function registerNotoSansKrWithJsPdf(doc, customFonts = []) {
  const bins = await loadPdfFontBinaries('Noto Sans KR', customFonts)
  if (!bins) {
    throw new Error('Noto Sans KR TTF를 불러오지 못했습니다.')
  }

  const regularB64 = binaryToBase64(bins.regular)
  const boldB64 = binaryToBase64(bins.bold)

  doc.addFileToVFS('NotoSansKR-Regular.ttf', regularB64)
  doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal')
  doc.addFileToVFS('NotoSansKR-SemiBold.ttf', boldB64)
  doc.addFont('NotoSansKR-SemiBold.ttf', 'NotoSansKR', 'bold')

  doc.addFont('NotoSansKR-Regular.ttf', 'Noto Sans KR', 'normal')
  doc.addFont('NotoSansKR-SemiBold.ttf', 'Noto Sans KR', 'bold')
}

/** @param {string} binary */
export function binaryStringToUint8Array(binary) {
  const u8 = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    u8[i] = binary.charCodeAt(i) & 0xff
  }
  return u8
}

/**
 * pdf-lib embedFont용 Noto Sans KR TTF
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 * @returns {Promise<{ regular: Uint8Array; semiBold: Uint8Array } | null>}
 */
export async function loadPdfFontUint8Arrays(customFonts = []) {
  const bins = await loadPdfFontBinaries('Noto Sans KR', customFonts)
  if (!bins) return null
  return {
    regular: binaryStringToUint8Array(bins.regular),
    semiBold: binaryStringToUint8Array(bins.bold),
  }
}

export async function loadPdfFontBinaries(family, customFonts = []) {
  const resolved = resolveExportFontFamily(family)

  if (resolved === 'Noto Sans KR') {
    const { regular, semiBold } = await loadLocalNotoSansKrWoff2Base64()
    return {
      regular: base64ToBinaryString(regular),
      bold: base64ToBinaryString(semiBold),
    }
  }

  const bundled = await loadBundledTtfBinary(resolved, family)
  if (bundled) {
    return { regular: bundled.binary, bold: bundled.binary }
  }

  const custom = loadCustomFontBinary(family, resolved, customFonts)
  if (!custom) return null
  return { regular: custom.binary, bold: custom.binary }
}

/** @param {string} svgInner */
export function substituteNonEmbeddableFontsInSvg(svgInner) {
  let out = svgInner
  for (const [from, to] of Object.entries(FONT_EXPORT_SUBSTITUTE)) {
    const patterns = [
      new RegExp(`font-family\\s*=\\s*["']${escapeRegExp(from)}["']`, 'gi'),
      new RegExp(`font-family\\s*:\\s*${escapeRegExp(from)}`, 'gi'),
    ]
    for (const re of patterns) {
      out = out.replace(re, (m) => m.replace(from, to))
    }
  }
  return out
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeCssFontFamily(family) {
  return String(family).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * @typedef {{ family: string; weight: string; base64: string; format: string }} PdfFontPayload
 */

/**
 * @param {PdfFontPayload[]} fonts
 */
export function buildPdfFontFaceCss(fonts) {
  if (!Array.isArray(fonts) || fonts.length === 0) return ''

  return fonts
    .filter((f) => f?.family && f?.base64)
    .map(({ family, weight, base64, format }) => {
      const fmt = format === 'woff2' ? 'woff2' : 'truetype'
      const mime = format === 'woff2' ? 'font/woff2' : 'font/truetype'
      const cssWeight =
        weight === 'bold' || weight === '700' || weight === '600'
          ? 'bold'
          : 'normal'
      const safeFamily = escapeCssFontFamily(family)
      return `@font-face {
  font-family: '${safeFamily}';
  src: url('data:${mime};base64,${base64}') format('${fmt}');
  font-weight: ${cssWeight};
  font-style: normal;
}`
    })
    .join('\n\n')
}

/**
 * Puppeteer PDF API용 폰트 base64 (로컬 woff2 + 업로드 커스텀 폰트만)
 * @param {import('fabric').Canvas} _canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 * @returns {Promise<PdfFontPayload[]>}
 */
export async function collectPdfFontsForExport(canvas, customFonts = []) {
  const { regular, semiBold } = await loadLocalNotoSansKrWoff2Base64()

  /** @type {PdfFontPayload[]} */
  const fonts = [
    {
      family: 'Noto Sans KR',
      weight: 'normal',
      base64: regular,
      format: 'woff2',
    },
    {
      family: 'Noto Sans KR',
      weight: 'bold',
      base64: semiBold,
      format: 'woff2',
    },
  ]

  const embeddedFamilies = new Set(['Noto Sans KR'])
  const families = canvas ? collectFontFamiliesFromCanvas(canvas) : []

  for (const fam of families) {
    const resolved = resolveExportFontFamily(fam)
    if (embeddedFamilies.has(resolved)) continue

    const loaded = await loadFontBinaryForExport(fam, customFonts)
    if (!loaded) continue

    const base64 = binaryToBase64(loaded.binary)
    embeddedFamilies.add(resolved)
    fonts.push({
      family: resolved,
      weight: 'normal',
      base64,
      format: loaded.format,
    })
    fonts.push({
      family: resolved,
      weight: 'bold',
      base64,
      format: loaded.format,
    })
  }

  for (const entry of customFonts) {
    if (!entry?.family || !entry?.fileData) continue
    if (embeddedFamilies.has(entry.family)) continue
    embeddedFamilies.add(entry.family)
    const base64 = arrayBufferToBase64(entry.fileData)
    fonts.push({
      family: entry.family,
      weight: 'normal',
      base64,
      format: 'truetype',
    })
    fonts.push({
      family: entry.family,
      weight: 'bold',
      base64,
      format: 'truetype',
    })
  }

  return fonts
}

/** @param {import('fabric').Canvas} canvas */
export async function prepareCanvasForRasterExport(canvas, customFonts = []) {
  const families = collectFontFamiliesFromCanvas(canvas)
  await ensureFontsReady(families, customFonts)

  await loadCanvasTextFontsAndRender(canvas)
  await document.fonts.ready

  canvas.requestRenderAll()
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}
