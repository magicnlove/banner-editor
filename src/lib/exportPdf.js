/**
 * Fabric 캔버스 → PDF (고해상도 래스터)
 * 화면에 보이는 그대로 PNG를 PDF에 넣어 한글·폰트 깨짐을 방지합니다.
 * (svg2pdf 벡터 경로는 CJK 폰트/인코딩 이슈가 잦음)
 */
import { jsPDF } from 'jspdf'
import { prepareCanvasForRasterExport } from './exportFonts'

/** CSS px → mm (96dpi) */
export function pxToMm(px) {
  return (px * 25.4) / 96
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {Array<{ family: string; fileData?: ArrayBuffer }>} customFonts
 * @returns {Promise<Blob>}
 */
export async function exportFabricToPdf(canvas, customFonts = []) {
  const wPx = canvas.getWidth()
  const hPx = canvas.getHeight()
  const wMm = pxToMm(wPx)
  const hMm = pxToMm(hPx)

  await prepareCanvasForRasterExport(canvas, customFonts)

  const multiplier = Math.min(3, Math.max(2, 2400 / Math.max(wPx, hPx)))

  const dataUrl = canvas.toDataURL({
    format: 'png',
    multiplier,
    enableRetinaScaling: true,
  })

  const doc = new jsPDF({
    orientation: wMm >= hMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [wMm, hMm],
    compress: true,
  })

  doc.addImage(dataUrl, 'PNG', 0, 0, wMm, hMm, undefined, 'MEDIUM')
  return doc.output('blob')
}
