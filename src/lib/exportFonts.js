/**
 *보내기용 한글·웹폰트 로드 및 SVG @font-face 임베드
 */

import notoSansKrRegularWoff2 from '../assets/fonts/NotoSansKR-Regular.woff2?url'
import notoSansKrRegularTtf from '../assets/fonts/NotoSansKR-Regular.ttf?url'

/** 앱에 번들된 로컬 폰트 (보내기·오프라인 우선) */
const LOCAL_APP_FONT_URLS = {
  'Noto Sans KR': {
    ttf: notoSansKrRegularTtf,
    woff2: notoSansKrRegularWoff2,
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

async function loadTtfBinary(resolved, family) {
  const local = LOCAL_APP_FONT_URLS[resolved] ?? LOCAL_APP_FONT_URLS[family]
  if (local?.ttf) {
    const binary = await fetchFontBinary(local.ttf)
    return { binary, format: 'truetype' }
  }
  const urls = REMOTE_FONT_URLS[resolved] ?? REMOTE_FONT_URLS[family]
  if (urls?.ttf) {
    const binary = await fetchFontBinary(urls.ttf)
    return { binary, format: 'truetype' }
  }
  return null
}

async function loadWoff2Binary(resolved, family) {
  const local = LOCAL_APP_FONT_URLS[resolved] ?? LOCAL_APP_FONT_URLS[family]
  if (local?.woff2) {
    const binary = await fetchFontBinary(local.woff2)
    return { binary, format: 'woff2' }
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
 * @param {{ preferTtf?: boolean }} [options] PDF·svg2pdf는 TTF 필수
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

function buildFontFaceRule(family, base64, format) {
  const mime = format === 'woff2' ? 'font/woff2' : 'font/truetype'
  const fmt = format === 'woff2' ? 'woff2' : 'truetype'
  const safeName = family.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `@font-face{font-family:'${safeName}';src:url(data:${mime};base64,${base64}) format('${fmt}');font-weight:100 900;font-style:normal;font-display:swap;}`
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

  const styleBlock = `<style type="text/css"><![CDATA[\n${rules.join('\n')}\n]]></style>`
  const defsMatch = svgInner.match(/<defs[^>]*>/i)
  if (defsMatch) {
    return svgInner.replace(defsMatch[0], `${defsMatch[0]}\n${styleBlock}`)
  }
  const svgOpen = svgInner.match(/<svg[^>]*>/i)
  if (svgOpen) {
    return svgInner.replace(svgOpen[0], `${svgOpen[0]}\n<defs>\n${styleBlock}\n</defs>`)
  }
  return `${styleBlock}\n${svgInner}`
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

/** @param {import('fabric').Canvas} canvas */
export async function prepareCanvasForRasterExport(canvas, customFonts = []) {
  const families = collectFontFamiliesFromCanvas(canvas)
  await ensureFontsReady(families, customFonts)
  canvas.requestRenderAll()
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}
