/**
 * PDF용 Fabric toSVG reviver 및 SVG pattern/image 보정
 */

const XLINK_NS = 'http://www.w3.org/1999/xlink'
const SVG_NS = 'http://www.w3.org/2000/svg'

/** @param {string | undefined} align */
export function textAlignToAnchor(align) {
  switch (align) {
    case 'center':
      return 'middle'
    case 'right':
    case 'end':
      return 'end'
    default:
      return 'start'
  }
}

/**
 * Fabric charSpacing(1/1000 em) → SVG letter-spacing(px)
 * @param {number} fontSize
 * @param {number} charSpacing
 */
export function charSpacingToLetterSpacingPx(fontSize, charSpacing) {
  const spacing = Number(charSpacing) || 0
  if (spacing === 0) return null
  const px = (Number(fontSize) * spacing) / 1000
  if (!Number.isFinite(px) || px === 0) return null
  return `${px}px`
}

/** @param {import('fabric').FabricObject} obj */
function isTextObject(obj) {
  const t = obj?.type
  return t === 'text' || t === 'i-text' || t === 'textbox'
}

/**
 * Fabric SVG export 순서와 동일하게 텍스트 오브젝트 수집
 * @param {import('fabric').Canvas} canvas
 */
export function collectTextObjectsForPdfExport(canvas) {
  /** @type {import('fabric').FabricObject[]} */
  const texts = []

  /** @param {import('fabric').FabricObject} obj */
  function walk(obj) {
    if (!obj || obj.excludeFromExport) return
    if (isTextObject(obj)) {
      texts.push(obj)
      return
    }
    if (obj.type === 'group' && typeof obj.getObjects === 'function') {
      for (const child of obj.getObjects()) {
        walk(child)
      }
    }
  }

  for (const obj of canvas.getObjects()) {
    walk(obj)
  }
  return texts
}

/**
 * @param {string} markup
 * @param {import('fabric').FabricObject} textObj
 */
export function applyPdfTextAttrsToMarkup(markup, textObj) {
  const anchor = textAlignToAnchor(textObj.textAlign)
  const letterSpacing = charSpacingToLetterSpacingPx(
    textObj.fontSize,
    textObj.charSpacing ?? 0,
  )

  return markup.replace(/<text\b([^>]*)>/i, (_, attrs) => {
    let a = attrs

    if (/font-family\s*=/i.test(a)) {
      a = a.replace(/font-family\s*=\s*["'][^"']*["']/gi, 'font-family="NotoSansKR"')
    } else {
      a = ` font-family="NotoSansKR"${a}`
    }

    if (/text-anchor\s*=/i.test(a)) {
      a = a.replace(/text-anchor\s*=\s*["'][^"']*["']/gi, `text-anchor="${anchor}"`)
    } else {
      a += ` text-anchor="${anchor}"`
    }

    if (letterSpacing) {
      if (/style\s*=\s*"/i.test(a)) {
        a = a.replace(/style\s*=\s*"([^"]*)"/i, (__, style) => {
          const cleaned = style.replace(/letter-spacing\s*:[^;]*;?/gi, '').trim()
          const sep = cleaned && !cleaned.endsWith(';') ? '; ' : ''
          return `style="${cleaned}${sep}letter-spacing: ${letterSpacing}"`
        })
      } else {
        a += ` style="letter-spacing: ${letterSpacing}"`
      }
    }

    return `<text${a}>`
  })
}

/**
 * @param {import('fabric').FabricObject[]} textQueue
 */
export function createPdfSvgReviver(textQueue) {
  return function pdfSvgReviver(markup) {
    if (!markup || typeof markup !== 'string') return markup

    let out = fixPatternMarkupSync(markup)
    if (!/<text\b/i.test(out)) return out

    out = out.replace(/<text\b[^>]*>[\s\S]*?<\/text>/gi, (textMarkup) => {
      const obj = textQueue.shift()
      if (!obj) return textMarkup
      return applyPdfTextAttrsToMarkup(textMarkup, obj)
    })

    return out
  }
}

/**
 * reviver 단계에서 할 수 있는 pattern 동기 보정 (네임스페이스·href 중복)
 * @param {string} markup
 */
export function fixPatternMarkupSync(markup) {
  if (!/<pattern\b/i.test(markup)) return markup

  let out = markup
  if (!/xmlns:xlink\s*=/i.test(out) && /<image\b/i.test(out)) {
    out = out.replace(
      /<svg\b/i,
      (m) => `${m} xmlns:xlink="http://www.w3.org/1999/xlink"`,
    )
  }

  out = out.replace(/<image\b([^>]*?)(\/?)>/gi, (full, attrs, selfClose) => {
    const hrefMatch =
      attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i) ||
      attrs.match(/\bxlink:href\s*=\s*["']([^"']+)["']/i)
    if (!hrefMatch) return full

    const href = hrefMatch[1]
    let next = attrs
      .replace(/\bhref\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\bxlink:href\s*=\s*["'][^"']*["']/gi, '')

    next = ` href="${href}" xlink:href="${href}"${next}`
    return `<image${next}${selfClose || ''}>`
  })

  return out
}

/**
 * @param {string} href
 * @returns {Promise<string>}
 */
async function hrefToDataUrl(href) {
  if (!href || href.startsWith('data:')) return href

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 1
        const h = img.naturalHeight || img.height || 1
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(href)
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(href)
      }
    }
    img.onerror = () => resolve(href)
    img.src = href
  })
}

/**
 * @param {Element} img
 */
function setImageHref(img, href) {
  img.setAttribute('href', href)
  img.setAttributeNS(XLINK_NS, 'xlink:href', href)
}

/**
 * svg2pdf pattern/image 오류 대응 — blob·외부 URL을 data URL로, pattern 치수 보정
 * @param {SVGElement} svgElement
 */
export async function fixSvgPatternsForPdf(svgElement) {
  if (!svgElement?.querySelectorAll) return

  if (!svgElement.getAttribute('xmlns')) {
    svgElement.setAttribute('xmlns', SVG_NS)
  }
  if (!svgElement.getAttribute('xmlns:xlink')) {
    svgElement.setAttribute('xmlns:xlink', XLINK_NS)
  }

  const patterns = svgElement.querySelectorAll('pattern')
  for (const pattern of patterns) {
    const img = pattern.querySelector('image')
    if (!img) continue

    let href =
      img.getAttribute('href') ||
      img.getAttributeNS(XLINK_NS, 'href') ||
      img.getAttribute('xlink:href')

    if (href) {
      href = await hrefToDataUrl(href)
      setImageHref(img, href)
    }

    const pw = Number.parseFloat(pattern.getAttribute('width') || '0')
    const ph = Number.parseFloat(pattern.getAttribute('height') || '0')
    if (!(pw > 0) || !(ph > 0)) {
      const iw = Number.parseFloat(img.getAttribute('width') || '0')
      const ih = Number.parseFloat(img.getAttribute('height') || '0')
      if (iw > 0 && ih > 0) {
        pattern.setAttribute('width', String(iw))
        pattern.setAttribute('height', String(ih))
      } else {
        pattern.setAttribute('width', '1')
        pattern.setAttribute('height', '1')
      }
    }
  }

  for (const img of svgElement.querySelectorAll('image')) {
    if (img.parentElement?.localName === 'pattern') continue

    let href =
      img.getAttribute('href') ||
      img.getAttributeNS(XLINK_NS, 'href') ||
      img.getAttribute('xlink:href')

    if (!href || href.startsWith('data:')) {
      if (href) setImageHref(img, href)
      continue
    }

    href = await hrefToDataUrl(href)
    setImageHref(img, href)
  }

  for (const el of svgElement.querySelectorAll('[fill^="url("]')) {
    const fill = el.getAttribute('fill')
    const idMatch = fill?.match(/url\s*\(\s*#([^)]+)\s*\)/i)
    if (!idMatch) continue
    const id = idMatch[1].replace(/^#/, '')
    const pattern = svgElement.querySelector(`pattern#${CSS.escape(id)}`)
    if (!pattern) continue
    const patternImg = pattern.querySelector('image')
    const href =
      patternImg?.getAttribute('href') ||
      patternImg?.getAttributeNS(XLINK_NS, 'href')
    if (href?.startsWith('data:')) continue
    if (patternImg && href) {
      const dataUrl = await hrefToDataUrl(href)
      setImageHref(patternImg, dataUrl)
    }
  }
}
