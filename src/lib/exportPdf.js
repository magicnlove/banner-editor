/**
 * Fabric → SVG(도형) + HTML 텍스트 → Puppeteer PDF (텍스트 선택·복사 가능)
 */
import { collectUsedFontsForPdfApi } from './exportFonts'
import { exportFabricToSvg } from './exportSvg'
import {
  getLogicalSizeFromCanvas,
  isTemplateLayerObject,
  logTemplateCanvasMetrics,
  fitTemplateToCanvas,
  captureTemplateTransform,
  restoreTemplateTransform,
} from './template'
import {
  buildHtmlTextLayer,
  collectUserTextObjectsForPdf,
  exportSvgWithUserTextHidden,
} from './exportPdfHtmlText'
import {
  prepareCanvasForExport,
  resetCanvasToLogicalForExport,
  restoreCanvasAfterExport,
} from './canvasZoom'

const PDF_API_URL =
  import.meta.env.VITE_PDF_API_URL || '/api/generate-pdf'

/**
 * @typedef {ReturnType<typeof prepareCanvasForExport> & {
 *   templateState: ReturnType<typeof captureTemplateTransform>
 * }} PdfExportSavedState
 */

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {PdfExportSavedState}
 */
function prepareFullPdfExportState(canvas) {
  return {
    ...prepareCanvasForExport(canvas),
    templateState: captureTemplateTransform(canvas),
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {PdfExportSavedState} saved
 */
function restoreFullPdfExportState(canvas, saved) {
  restoreCanvasAfterExport(canvas, saved)
  restoreTemplateTransform(canvas, saved.templateState)
}

/**
 * @param {number} width
 * @param {number} height
 * @param {string} svgInner
 * @param {string} textLayerHtml
 */
function buildPdfHtmlDocument(width, height, svgInner, textLayerHtml) {
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
    .pdf-canvas {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      font-family: 'Noto Sans KR', sans-serif;
    }
    .pdf-canvas > svg {
      position: absolute;
      left: 0;
      top: 0;
      display: block;
      width: ${width}px;
      height: ${height}px;
    }
    .pdf-text-layer {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }
    .pdf-text {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div class="pdf-canvas">
    ${svgInner}
    ${textLayerHtml}
  </div>
</body>
</html>`
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} [customFonts]
 * @param {{ onAfterRestore?: () => void | Promise<void> }} [options]
 * @returns {Promise<Blob>}
 */
export async function exportFabricToPdf(canvas, customFonts = [], options = {}) {
  const saved = prepareFullPdfExportState(canvas)
  resetCanvasToLogicalForExport(canvas)

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

    const { usedFonts, customFonts: customFontPayloads } =
      collectUsedFontsForPdfApi(canvas, customFonts)

    const userTexts = collectUserTextObjectsForPdf(canvas)
    const textLayerHtml = buildHtmlTextLayer(userTexts)

    const svgInner = await exportSvgWithUserTextHidden(canvas, () =>
      exportFabricToSvg(
        canvas,
        customFonts,
        logical,
        { notoOnly: false },
        { embedFonts: false },
      ),
    )

    const html = buildPdfHtmlDocument(width, height, svgInner, textLayerHtml)

    const res = await fetch(PDF_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        width,
        height,
        usedFonts,
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
    restoreFullPdfExportState(canvas, saved)
    canvas.requestRenderAll()
    await options.onAfterRestore?.()
  }
}
