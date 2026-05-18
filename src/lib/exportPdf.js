/**
 * Fabric → SVG(@font-face) → Vercel Puppeteer API → PDF
 */
import { exportFabricToSvg } from './exportSvg'
import { getLogicalSizeFromCanvas } from './template'

const PDF_API_URL =
  import.meta.env.VITE_PDF_API_URL || '/api/generate-pdf'

/**
 * @param {number} width
 * @param {number} height
 * @param {string} svgInner
 */
function buildPdfHtmlDocument(width, height, svgInner) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    body { display: block; }
    svg { display: block; width: ${width}px; height: ${height}px; }
  </style>
</head>
<body>${svgInner}</body>
</html>`
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 * @returns {Promise<Blob>}
 */
export async function exportFabricToPdf(canvas, customFonts = []) {
  const logical = getLogicalSizeFromCanvas(canvas)
  const width = logical.width
  const height = logical.height

  if (
    !(width > 0 && height > 0) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    throw new Error('캔버스 크기를 확인할 수 없습니다.')
  }

  const svgInner = await exportFabricToSvg(canvas, customFonts, logical, {
    preferTtf: true,
    notoOnly: true,
  })

  const html = buildPdfHtmlDocument(width, height, svgInner)

  const res = await fetch(PDF_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, width, height }),
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const errBody = await res.json()
      detail = errBody.message || errBody.error || detail
    } catch {
      /* ignore */
    }
    throw new Error(`PDF 생성 실패 (${res.status}): ${detail}`)
  }

  return res.blob()
}
