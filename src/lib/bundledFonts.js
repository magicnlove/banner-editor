import hanwhaRUrl from '../assets/fonts/HanwhaR.ttf?url'
import hggGothic40Url from '../assets/fonts/HGGGothicssi_40g.ttf?url'
import hggGothic99Url from '../assets/fonts/HGGGothicssi_99g.ttf?url'

/** @typedef {{ family: string; label: string; url: string }} BundledFontEntry */

/** @type {BundledFontEntry[]} */
export const BUNDLED_KOREAN_FONTS = [
  { family: 'Hanwha', label: 'Hanwha', url: hanwhaRUrl },
  { family: 'HGG Gothic 40', label: 'HGG Gothic 40', url: hggGothic40Url },
  { family: 'HGG Gothic 99', label: 'HGG Gothic 99', url: hggGothic99Url },
]

/** @type {Record<string, string>} */
export const BUNDLED_FONT_URL_BY_FAMILY = Object.fromEntries(
  BUNDLED_KOREAN_FONTS.map((f) => [f.family, f.url]),
)

export const BUNDLED_FONT_FAMILY_NAMES = BUNDLED_KOREAN_FONTS.map((f) => f.family)
