import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

chromium.setGraphicsMode = false

/** Vercel serverless: HTML → PDF (Puppeteer + Chromium) */
export default async function handler(req, res) {
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

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: w, height: h },
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

    const pdf = await page.pdf({
      width: `${w}px`,
      height: `${h}px`,
      printBackground: true,
      preferCSSPageSize: true,
    })

    await browser.close()
    browser = undefined

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=banner.pdf')
    return res.status(200).send(pdf)
  } catch (err) {
    console.error('[generate-pdf]', err)
    if (browser) {
      try {
        await browser.close()
      } catch {
        /* ignore */
      }
    }
    return res.status(500).json({
      error: 'PDF generation failed',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
