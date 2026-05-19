/**
 *보내기용 한글·웹폰트 로드 및 SVG @font-face 임베드
 */

import notoSansKrRegularWoff2 from '../assets/fonts/NotoSansKR-Regular.woff2?url'
import notoSansKrSemiBoldWoff2 from '../assets/fonts/NotoSansKR-SemiBold.woff2?url'
import { loadCanvasTextFontsAndRender } from './appFonts'

/**
 * 로컬 번들 폰트 (woff2만 — TTF는 Google CDN, 예전 로컬 TTF는 Thin이 Regular로 잘못 들어가 있었음)
 * @type {Record<string, { woff2Regular?: string; woff2SemiBold?: string }>}
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

/** @type {Record<string, { ttf?: string; woff2?: string }>} */
export const REMOTE_FONT_URLS = {
  'Noto Sans KR': {
    ttf: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR-Regular.ttf',
    /** 편집기 기본 굵기(600)와 동일 — PDF bold 슬롯에 사용 */
    ttfSemiBold:
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR-SemiBold.ttf',
    woff2:
      'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.woff2',
  },
  'Nanum Gothic': {
    ttf: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf',
    woff2:
      'https://cdn.jsdelivr.net/fontsource/fonts/nanum-gothic@latest/korean-400-normal.woff2',
  },
}

const fontBinaryCache = new Map()

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

async function fetchFontBinary(url) {
  if (fontBinaryCache.has(url)) return fontBinaryCache.get(url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  const bin = uint8ToBinaryString(buf)
  fontBinaryCache.set(url, bin)
  return bin
}

/**
 * @param {string} resolved
 * @param {string} family
 * @param {number} [cssWeight] 400 | 600 | 700
 */
async function loadTtfBinary(resolved, family, cssWeight = 400) {
  const urls = REMOTE_FONT_URLS[resolved] ?? REMOTE_FONT_URLS[family]
  if (!urls) return null

  if (cssWeight >= 600 && urls.ttfSemiBold) {
    try {
      const binary = await fetchFontBinary(urls.ttfSemiBold)
      return { binary, format: 'truetype' }
    } catch {
      /* fall through to regular */
    }
  }

  if (urls.ttf) {
    const binary = await fetchFontBinary(urls.ttf)
    return { binary, format: 'truetype' }
  }
  return null
}

/**
 * @param {string} resolved
 * @param {string} family
 * @param {number} [cssWeight]
 */
async function loadWoff2Binary(resolved, family, cssWeight = 400) {
  const local = LOCAL_APP_FONT_URLS[resolved] ?? LOCAL_APP_FONT_URLS[family]
  if (local?.woff2Regular || local?.woff2SemiBold) {
    const url =
      cssWeight >= 600 && local.woff2SemiBold
        ? local.woff2SemiBold
        : local.woff2Regular
    if (url) {
      const binary = await fetchFontBinary(url)
      return { binary, format: 'woff2' }
    }
  }

  const urls = REMOTE_FONT_URLS[resolved] ?? REMOTE_FONT_URLS[family]
  if (urls?.woff2) {
    const binary = await fetchFontBinary(urls.woff2)
    return { binary, format: 'woff2' }
  }
  return null
}

/**
 * @param {string} family
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 * @param {{ preferTtf?: boolean }} [options] PDF·일러스트 호환 시 TTF 우선
 * @returns {Promise<{ binary: string; format: 'woff2' | 'truetype' } | null>}
 */
export async function loadFontBinaryForExport(family, customFonts = [], options = {}) {
  const { preferTtf = false } = options
  const resolved = resolveExportFontFamily(family)

  const custom = customFonts.find((c) => c.family === family || c.family === resolved)
  if (custom?.fileData) {
    return {
      binary: uint8ToBinaryString(new Uint8Array(custom.fileData)),
      format: 'truetype',
    }
  }

  if (preferTtf) {
    try {
      return await loadTtfBinary(resolved, family)
    } catch {
      return null
    }
  }

  try {
    const w2 = await loadWoff2Binary(resolved, family)
    if (w2) return w2
  } catch {
    /* fall through */
  }

  try {
    return await loadTtfBinary(resolved, family)
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
export async function loadNotoSansKrRegularTtfBase64(customFonts = []) {
  const loaded = await loadFontBinaryForExport('Noto Sans KR', customFonts, {
    preferTtf: true,
  })
  if (!loaded || loaded.format !== 'truetype') return null
  return binaryToBase64(loaded.binary)
}

/**
 * @param {string} svgInner
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 */
export async function embedNotoSansKrFontFaceInSvg(svgInner, customFonts = []) {
  const rules = []
  const regular = await loadFontBinaryForExport('Noto Sans KR', customFonts, {
    preferTtf: true,
  })
  if (regular?.format === 'truetype') {
    const b64 = binaryToBase64(regular.binary)
    rules.push(buildFontFaceRule('Noto Sans KR', b64, 'truetype', '400'))
  }

  const boldLoaded = await loadTtfBinary('Noto Sans KR', 'Noto Sans KR', 700)
  if (boldLoaded?.format === 'truetype') {
    rules.push(
      buildFontFaceRule(
        'Noto Sans KR',
        binaryToBase64(boldLoaded.binary),
        'truetype',
        '700',
      ),
    )
  } else if (regular?.format === 'truetype') {
    const b64 = binaryToBase64(regular.binary)
    rules.push(buildFontFaceRule('Noto Sans KR', b64, 'truetype', '700'))
  }

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
    return embedNotoSansKrFontFaceInSvg(svgInner, customFonts)
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
    const regularLoaded = await loadTtfBinary(resolved, family, 400)
    if (!regularLoaded) return null
    const boldLoaded = await loadTtfBinary(resolved, family, 700)
    return {
      regular: regularLoaded.binary,
      bold: boldLoaded?.binary ?? regularLoaded.binary,
    }
  }

  const regularLoaded = await loadFontBinaryForExport(family, customFonts, {
    preferTtf: true,
  })
  if (!regularLoaded || regularLoaded.format !== 'truetype') return null
  return { regular: regularLoaded.binary, bold: regularLoaded.binary }
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
 * Puppeteer PDF API용 폰트 base64 목록 (Noto + 커스텀 + 캔버스 사용 폰트)
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 * @returns {Promise<PdfFontPayload[]>}
 */
export async function collectPdfFontsForExport(canvas, customFonts = []) {
  /** @type {PdfFontPayload[]} */
  const fonts = []
  const seen = new Set()

  /**
   * @param {string} family
   * @param {string} weight
   * @param {string} base64
   * @param {string} [format]
   */
  const pushFont = (family, weight, base64, format = 'truetype') => {
    const cssWeight = weight === 'bold' ? 'bold' : 'normal'
    const key = `${family}|${cssWeight}`
    if (!family || !base64 || seen.has(key)) return
    seen.add(key)
    fonts.push({
      family,
      weight: cssWeight,
      base64,
      format: format === 'woff2' ? 'woff2' : 'truetype',
    })
  }

  const notoBins = await loadPdfFontBinaries('Noto Sans KR', customFonts)
  if (notoBins?.regular) {
    pushFont('Noto Sans KR', 'normal', binaryToBase64(notoBins.regular), 'truetype')
  }
  if (notoBins?.bold) {
    pushFont('Noto Sans KR', 'bold', binaryToBase64(notoBins.bold), 'truetype')
  }

  for (const entry of customFonts) {
    if (!entry?.family || !entry?.fileData) continue
    const bin = uint8ToBinaryString(new Uint8Array(entry.fileData))
    pushFont(entry.family, 'normal', binaryToBase64(bin), 'truetype')
  }

  const families = canvas ? collectFontFamiliesFromCanvas(canvas) : []
  for (const fam of families) {
    const resolved = resolveExportFontFamily(fam)
    if (resolved === 'Noto Sans KR') continue

    const loaded = await loadFontBinaryForExport(fam, customFonts, {
      preferTtf: true,
    })
    if (!loaded) continue

    const format = loaded.format === 'woff2' ? 'woff2' : 'truetype'
    pushFont(fam, 'normal', binaryToBase64(loaded.binary), format)
    if (resolved !== fam) {
      pushFont(resolved, 'normal', binaryToBase64(loaded.binary), format)
    }
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
