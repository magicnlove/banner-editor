/**
 * Fabric → JPEG 배경 + 텍스트 JSON → Puppeteer PDF
 */
import {
  collectUsedFontsForPdfApi,
  prepareCanvasForRasterExport,
} from './exportFonts'
import {
  getLogicalSizeFromCanvas,
  isTemplateLayerObject,
  logTemplateCanvasMetrics,
  fitTemplateToCanvas,
} from './template'
import {
  extractTextObjectsForPdf,
  withUserTextHidden,
} from './exportPdfHtmlText'
import {
  prepareCanvasForExport,
  resetCanvasToLogicalForExport,
  restoreCanvasAfterExport,
} from './canvasZoom'

const PDF_API_URL =
  import.meta.env.VITE_PDF_API_URL || '/api/generate-pdf'

/**
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 */
async function capturePdfBackground(canvas, customFonts) {
  await prepareCanvasForRasterExport(canvas, customFonts)

  return withUserTextHidden(canvas, async () => {
    canvas.requestRenderAll()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return canvas.toDataURL({ format: 'jpeg', quality: 0.85, multiplier: 1 })
  })
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 * @param {{ saved?: ReturnType<typeof prepareCanvasForExport> }} [options]
 * @returns {Promise<Blob>}
 */
export async function exportFabricToPdf(canvas, customFonts = [], options = {}) {
  const saved = options.saved ?? prepareCanvasForExport(canvas)
  if (!options.saved) {
    resetCanvasToLogicalForExport(canvas)
  }

  try {
    if (canvas.getObjects().some((o) => isTemplateLayerObject(o))) {
      fitTemplateToCanvas(canvas)
    }

    const logical = getLogicalSizeFromCanvas(canvas)
    const width = logical.width
    const height = logical.height

    const templateObj = canvas.getObjects().find((o) => isTemplateLayerObject(o))
    logTemplateCanvasMetrics(canvas, templateObj, 'before PDF export')

    if (
      !(width > 0 && height > 0) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      throw new Error('캔버스 크기를 확인할 수 없습니다.')
    }

    const bgImage = await capturePdfBackground(canvas, customFonts)
    if (!bgImage?.startsWith('data:image/')) {
      throw new Error('배경 이미지를 캡처하지 못했습니다.')
    }

    const textObjects = extractTextObjectsForPdf(canvas)
    const { usedFonts, customFonts: customFontPayloads } =
      collectUsedFontsForPdfApi(canvas, customFonts)

    const res = await fetch(PDF_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bgImage,
        width,
        height,
        usedFonts,
        textObjects,
        fonts: customFontPayloads,
      }),
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

    const buffer = await res.arrayBuffer()
    return new Blob([buffer], { type: 'application/pdf' })
  } finally {
    restoreCanvasAfterExport(canvas, saved)
    canvas.requestRenderAll()
  }
}
