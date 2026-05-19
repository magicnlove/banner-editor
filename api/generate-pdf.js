import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { loadServerFontsForFamilies } from './pdfFonts.js'

chromium.setGraphicsMode = false

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeCssFontFamily(family) {
  return String(family).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function cssFontWeight(fontWeight) {
  if (fontWeight === 'bold') return 'bold'
  const n = Number(fontWeight)
  return Number.isFinite(n) && n >= 600 ? 'bold' : 'normal'
}

/**
 * @param {Array<{ family?: string; weight?: string; base64?: string; format?: string }>} fonts
 */
function buildFontFaceCss(fonts) {
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
 * @param {object} t
 */
function buildTextDivHtml(t) {
  const fontSize = Math.max(1, Number(t.fontSize || 16) * Number(t.scaleY || 1))
  const scaleX = Number(t.scaleX) || 1
  const lineHeight = t.lineHeight ?? 1.16
  const charSpacing = Number(t.charSpacing) || 0
  const letterSpacing =
    charSpacing !== 0 ? `${(fontSize * charSpacing) / 1000}px` : 'normal'
  const family = escapeCssFontFamily(String(t.fontFamily || 'Noto Sans KR'))
  const angle = Number(t.angle) || 0
  const width = Number(t.width) > 0 ? `width: ${Number(t.width)}px;` : ''
  const minHeight =
    Number(t.height) > 0
      ? `min-height: ${Number(t.height)}px;`
      : `min-height: ${fontSize * lineHeight}px;`

  const transforms = []
  if (Math.abs(scaleX - 1) > 0.001) transforms.push(`scaleX(${scaleX})`)
  if (Math.abs(angle) > 0.001) transforms.push(`rotate(${angle}deg)`)
  const transform = transforms.length ? `transform: ${transforms.join(' ')};` : ''
  const transformOrigin =
    transforms.length > 0 ? 'transform-origin: top left;' : ''

  return `<div class="pdf-text" style="
    position: absolute;
    left: ${Number(t.left) || 0}px;
    top: ${Number(t.top) || 0}px;
    ${width}
    ${minHeight}
    font-size: ${fontSize}px;
    font-family: '${family}', 'Noto Sans KR', sans-serif;
    font-weight: ${cssFontWeight(t.fontWeight)};
    color: ${escapeHtml(t.fill || '#1a1d24')};
    text-align: ${t.textAlign || 'left'};
    line-height: ${lineHeight};
    letter-spacing: ${letterSpacing};
    white-space: pre;
    opacity: ${Number(t.opacity ?? 1)};
    ${transform}
    ${transformOrigin}
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  ">${escapeHtml(t.text ?? '')}</div>`
}

/**
 * @param {number} width
 * @param {number} height
 * @param {string} bgImage
 * @param {object[]} textObjects
 * @param {string} fontFaceCss
 */
function buildPdfHtmlDocument(width, height, bgImage, textObjects, fontFaceCss) {
  const textLayer = (Array.isArray(textObjects) ? textObjects : [])
    .map(buildTextDivHtml)
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
${fontFaceCss}

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    .pdf-canvas {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      font-family: 'Noto Sans KR', sans-serif;
    }
    .pdf-bg {
      position: absolute;
      left: 0;
      top: 0;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: fill;
    }
    .pdf-text-layer {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      pointer-events: none;
    }
    .pdf-text {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div class="pdf-canvas">
    <img class="pdf-bg" src="${bgImage}" width="${width}" height="${height}" alt="" />
    <div class="pdf-text-layer">${textLayer}</div>
  </div>
</body>
</html>`
}

/**
 * @param {string[]} usedFonts
 * @param {Array<{ family?: string; weight?: string; base64?: string; format?: string }>} customFonts
 */
function resolvePdfFonts(usedFonts, customFonts) {
  const serverFonts = loadServerFontsForFamilies(usedFonts)
  const uploaded = Array.isArray(customFonts) ? customFonts : []
  return [...serverFonts, ...uploaded]
}

/** Vercel serverless: JPEG 배경 + 텍스트 레이어 → PDF */
export default async function handler(req, res) {
  console.log('=== PDF API called ===')
  console.log('method:', req.method)
  console.log('body keys:', Object.keys(req.body || {}))

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let browser
  try {
    const {
      bgImage,
      width,
      height,
      usedFonts,
      textObjects,
      fonts: customFonts,
    } = req.body ?? {}

    if (!bgImage || typeof bgImage !== 'string') {
      return res.status(400).json({ error: 'bgImage is required' })
    }

    const w = Number(width)
    const h = Number(height)
    if (!(w > 0 && h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ error: 'width and height must be positive numbers' })
    }

    const fontFamilies = Array.isArray(usedFonts) ? usedFonts : ['Noto Sans KR']
    const allFonts = resolvePdfFonts(fontFamilies, customFonts)
    const fontFaceCss = buildFontFaceCss(allFonts)
    const html = buildPdfHtmlDocument(
      w,
      h,
      bgImage,
      textObjects,
      fontFaceCss,
    )

    console.log('usedFonts:', fontFamilies)
    console.log('textObjects:', Array.isArray(textObjects) ? textObjects.length : 0)
    console.log('server + custom font rules:', allFonts.length)
    console.log('html length:', html.length)

    console.log('launching browser...')
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: null,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.setViewport({ width: w, height: h })

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })

    await page.evaluateHandle('document.fonts.ready')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await page.emulateMediaType('screen')

    const pdf = await page.pdf({
      width: `${w}px`,
      height: `${h}px`,
      printBackground: true,
      tagged: true,
      preferCSSPageSize: false,
    })

    await browser.close()
    browser = undefined

    const pdfBuffer = Buffer.from(pdf)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=banner.pdf')
    res.setHeader('Content-Length', pdfBuffer.length)
    res.end(pdfBuffer)
    return
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    console.error('ERROR:', message)
    console.error('STACK:', stack)

    if (browser) {
      try {
        await browser.close()
      } catch {
        /* ignore */
      }
    }

    return res.status(500).json({ error: message, stack })
  }
}
