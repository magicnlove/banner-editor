/**
 * Fabric → 고해상도 PNG 배경 + pdf-lib 텍스트 드로잉
 */
import { PDFDocument, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {
  loadPdfFontUint8Arrays,
  prepareCanvasForRasterExport,
} from './exportFonts'
import { getLogicalSizeFromCanvas, isTemplateLayerObject } from './template'
import { collectTextObjectsForPdfExport } from './exportPdfSvg'
import { fillToPdfRgb } from './exportPdfColors'

const BG_CAPTURE_MULTIPLIER = 3
const ASCENDER_RATIO = 0.85

/**
 * @param {string} dataUrl
 */
function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('PNG 데이터를 읽지 못했습니다.')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** @param {import('fabric').Canvas} canvas */
function renderCanvasAll(canvas) {
  if (typeof canvas.renderAll === 'function') {
    canvas.renderAll()
  } else {
    canvas.requestRenderAll()
  }
}

/** @param {unknown} fontWeight */
function isBoldWeight(fontWeight) {
  if (fontWeight === 'bold') return true
  const n = Number(fontWeight)
  return Number.isFinite(n) && n >= 600
}

/**
 * @param {import('fabric').Canvas} canvas
 */
function collectUserTextObjects(canvas) {
  return collectTextObjectsForPdfExport(canvas).filter(
    (obj) => !isTemplateLayerObject(obj),
  )
}

/**
 * @param {import('fabric').FabricObject} textObj
 * @param {number} pageHeight
 * @param {{ regular: import('pdf-lib').PDFFont; semiBold: import('pdf-lib').PDFFont }} fonts
 * @param {import('pdf-lib').PDFPage} page
 */
function drawTextObjectOnPage(page, textObj, pageHeight, fonts) {
  const font = isBoldWeight(textObj.fontWeight) ? fonts.semiBold : fonts.regular
  const fontSize = Math.max(1, (textObj.fontSize || 16) * (textObj.scaleY ?? 1))
  const color = fillToPdfRgb(textObj.fill)
  const opacity =
    textObj.opacity != null && textObj.opacity !== 1
      ? Math.min(1, Math.max(0, Number(textObj.opacity)))
      : undefined

  const lines = String(textObj.text ?? '').split('\n')
  const lineHeight = textObj.lineHeight ?? 1.16
  const lineStep = fontSize * lineHeight
  const align = textObj.textAlign || 'left'

  textObj.setCoords?.()
  const bounds = textObj.getBoundingRect(true, true)
  const boxLeft = bounds.left
  const boxWidth = Math.max(bounds.width, 1)

  let pdfY = pageHeight - (textObj.top ?? bounds.top) - fontSize

  if (textObj.originY === 'center' || textObj.originY === 'bottom') {
    pdfY =
      pageHeight -
      bounds.top -
      fontSize * ASCENDER_RATIO
  }

  const angle = textObj.angle ?? 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const y = pdfY - i * lineStep

    if (!line) continue

    const textWidth = font.widthOfTextAtSize(line, fontSize)
    let x = boxLeft
    if (align === 'center') {
      x = boxLeft + (boxWidth - textWidth) / 2
    } else if (align === 'right' || align === 'end') {
      x = boxLeft + boxWidth - textWidth
    }

    const options = {
      x,
      y,
      size: fontSize,
      font,
      color,
    }
    if (opacity !== undefined) options.opacity = opacity

    if (angle) {
      page.drawText(line, {
        ...options,
        rotate: degrees(-angle),
      })
    } else {
      page.drawText(line, options)
    }
  }
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

  const fontBytes = await loadPdfFontUint8Arrays(customFonts)
  if (!fontBytes) {
    throw new Error('Noto Sans KR TTF를 불러오지 못했습니다.')
  }

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const regularFont = await pdfDoc.embedFont(fontBytes.regular, {
    subset: false,
  })
  const semiBoldFont = await pdfDoc.embedFont(fontBytes.semiBold, {
    subset: false,
  })

  const page = pdfDoc.addPage([width, height])
  const textObjects = collectUserTextObjects(canvas)

  const hiddenStates = textObjects.map((obj) => {
    const prevVisible = obj.visible
    obj.set({ visible: false })
    return { obj, prevVisible }
  })

  await prepareCanvasForRasterExport(canvas, customFonts)
  renderCanvasAll(canvas)
  await document.fonts.ready

  const pngDataUrl = canvas.toDataURL({
    format: 'png',
    multiplier: BG_CAPTURE_MULTIPLIER,
  })

  for (const { obj, prevVisible } of hiddenStates) {
    obj.set({ visible: prevVisible })
  }
  renderCanvasAll(canvas)

  const pngBytes = dataUrlToUint8Array(pngDataUrl)
  const pngImage = await pdfDoc.embedPng(pngBytes)
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width,
    height,
  })

  const fonts = { regular: regularFont, semiBold: semiBoldFont }
  for (const textObj of textObjects) {
    drawTextObjectOnPage(page, textObj, height, fonts)
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
