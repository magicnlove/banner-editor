import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

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

/** Vercel serverless: HTML → PDF (Puppeteer + Chromium) */
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
    const { html, width, height, fonts } = req.body ?? {}

    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'html is required' })
    }

    const w = Math.round(Number(width))
    const h = Math.round(Number(height))
    if (!(w > 0 && h > 0)) {
      return res.status(400).json({ error: 'width and height must be positive numbers' })
    }

    const fontFaceCss = buildFontFaceCss(fonts)
    const htmlWithFonts = embedFontsInHtml(html, fontFaceCss)
    console.log('fonts count:', Array.isArray(fonts) ? fonts.length : 0)
    console.log('font-face rules length:', fontFaceCss.length)

    console.log('launching browser...')
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: w, height: h },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })
    console.log('browser launched')

    const page = await browser.newPage()
    await page.setViewport({ width: w, height: h })

    console.log('setting page content...')
    await page.setContent(htmlWithFonts, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })
    console.log('page content set')

    await page.evaluateHandle('document.fonts.ready')
    console.log('fonts ready')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('font load delay done')

    console.log('generating pdf...')
    const pdf = await page.pdf({
      width: `${w}px`,
      height: `${h}px`,
      printBackground: true,
      preferCSSPageSize: true,
    })
    console.log('PDF generated, size:', pdf.length)

    await browser.close()
    browser = undefined

    const pdfBuffer = Buffer.from(pdf)
    console.log('Buffer size:', pdfBuffer.length)

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
