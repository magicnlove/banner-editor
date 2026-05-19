import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, 'fonts')

/** @type {Record<string, Array<{ file: string; format: 'woff2' | 'truetype'; weight: string }>>} */
export const SERVER_FONT_CATALOG = {
  'Noto Sans KR': [
    { file: 'NotoSansKR-Regular.woff2', format: 'woff2', weight: 'normal' },
    { file: 'NotoSansKR-SemiBold.woff2', format: 'woff2', weight: 'bold' },
  ],
  Hanwha: [
    { file: 'HanwhaR.woff2', format: 'woff2', weight: 'normal' },
    { file: 'HanwhaR.woff2', format: 'woff2', weight: 'bold' },
  ],
  'HGG Gothic 40': [
    { file: 'HGGGothicssi_40g.woff2', format: 'woff2', weight: 'normal' },
    { file: 'HGGGothicssi_40g.woff2', format: 'woff2', weight: 'bold' },
  ],
  'HGG Gothic 99': [
    { file: 'HGGGothicssi_99g.woff2', format: 'woff2', weight: 'normal' },
    { file: 'HGGGothicssi_99g.woff2', format: 'woff2', weight: 'bold' },
  ],
}

/** @type {Map<string, string>} */
const fontFileBase64Cache = new Map()

/**
 * @param {string} filename
 */
function readFontFileBase64(filename) {
  if (fontFileBase64Cache.has(filename)) {
    return fontFileBase64Cache.get(filename)
  }
  const filePath = join(FONTS_DIR, filename)
  const base64 = readFileSync(filePath).toString('base64')
  fontFileBase64Cache.set(filename, base64)
  return base64
}

/**
 * @param {string[]} usedFonts
 * @returns {Array<{ family: string; weight: string; base64: string; format: string }>}
 */
export function loadServerFontsForFamilies(usedFonts) {
  if (!Array.isArray(usedFonts)) return []

  /** @type {Array<{ family: string; weight: string; base64: string; format: string }>} */
  const fonts = []
  const seen = new Set()

  for (const family of usedFonts) {
    const entries = SERVER_FONT_CATALOG[family]
    if (!entries) {
      console.warn('[pdfFonts] unknown server font family:', family)
      continue
    }

    for (const { file, format, weight } of entries) {
      const key = `${family}::${weight}::${file}`
      if (seen.has(key)) continue
      seen.add(key)

      try {
        fonts.push({
          family,
          weight,
          base64: readFontFileBase64(file),
          format,
        })
      } catch (err) {
        console.error('[pdfFonts] failed to read font file:', file, err)
      }
    }
  }

  return fonts
}
