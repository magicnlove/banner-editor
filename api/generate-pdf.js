import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

chromium.setGraphicsMode = false

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
    const { html, width, height } = req.body ?? {}

    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'html is required' })
    }

    const w = Math.round(Number(width))
    const h = Math.round(Number(height))
    if (!(w > 0 && h > 0)) {
      return res.status(400).json({ error: 'width and height must be positive numbers' })
    }

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
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })
    console.log('page content set')

    await page.evaluateHandle('document.fonts.ready')
    console.log('fonts ready')

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
