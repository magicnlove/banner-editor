import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { loadServerFontsForFamilies } from './pdfFonts.js'

chromium.setGraphicsMode = false

function escapeCssFontFamily(family) {
  return String(family).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
 * @param {string} html
 * @param {string} fontFaceCss
 */
function embedFontsInHtml(html, fontFaceCss) {
  if (!fontFaceCss) return html

  const styleBlock = `<style>\n${fontFaceCss}\n</style>`

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}\n${styleBlock}`)
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${styleBlock}
</head>
<body>${html}</body>
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

/** Vercel serverless: HTML(SVG + 텍스트 레이어) → PDF */
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
    const { html, width, height, usedFonts, fonts: customFonts } = req.body ?? {}

    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'html is required' })
    }

    const w = Number(width)
    const h = Number(height)
    if (!(w > 0 && h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ error: 'width and height must be positive numbers' })
    }
    const pdfW = Math.round(w)
    const pdfH = Math.round(h)

    const fontFamilies = Array.isArray(usedFonts) ? usedFonts : ['Noto Sans KR']
    const allFonts = resolvePdfFonts(fontFamilies, customFonts)
    const fontFaceCss = buildFontFaceCss(allFonts)
    const htmlWithFonts = embedFontsInHtml(html, fontFaceCss)

    console.log('usedFonts:', fontFamilies)
    console.log('server + custom font rules:', allFonts.length)
    console.log('font-face rules length:', fontFaceCss.length)
    console.log('html length:', htmlWithFonts.length)

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: null,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.setViewport({
      width: pdfW,
      height: pdfH,
      deviceScaleFactor: 1,
    })

    await page.setContent(htmlWithFonts, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })

    await page.evaluateHandle('document.fonts.ready')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await page.emulateMediaType('screen')

    const pdf = await page.pdf({
      width: `${pdfW}px`,
      height: `${pdfH}px`,
      printBackground: true,
      tagged: true,
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
