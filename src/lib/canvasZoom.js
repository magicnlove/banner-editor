import { getLogicalSizeFromCanvas } from './template'

/**
 * 화면 줌: __logicalSize는 고정, setZoom + DOM = 논리×줌
 */
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 3

export const FIT_VIEWPORT_PADDING = 32

export function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

/** @param {import('fabric').Canvas} canvas */
export function getCanvasLogicalSize(canvas) {
  return getLogicalSizeFromCanvas(canvas)
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} zoom
 * @returns {number} 적용된 줌
 */
export function applyDisplayZoom(canvas, zoom) {
  const z = clampZoom(zoom)
  const { width: logicalW, height: logicalH } = getLogicalSizeFromCanvas(canvas)

  canvas.setZoom(z)
  canvas.setDimensions({
    width: Math.round(logicalW * z),
    height: Math.round(logicalH * z),
  })
  canvas.calcOffset()
  canvas.requestRenderAll()
  return z
}

/** @param {number} zoom */
export function zoomPercentFromZoom(zoom) {
  return Math.round(clampZoom(zoom) * 100)
}

/** @param {import('fabric').Canvas} canvas */
export function syncCanvasDisplayZoom(canvas) {
  applyDisplayZoom(canvas, canvas.getZoom() || 1)
}

export function computeDisplaySize(
  vw,
  vh,
  docW,
  docH,
  padding = FIT_VIEWPORT_PADDING,
) {
  const availW = Math.max(8, vw - padding * 2)
  const availH = Math.max(8, vh - padding * 2)
  const ar = docW / docH
  let dw = availW
  let dh = dw / ar
  if (dh > availH) {
    dh = availH
    dw = dh * ar
  }
  return { width: dw, height: dh }
}

export function computeFitZoom(
  vw,
  vh,
  logicalW,
  logicalH,
  padding = FIT_VIEWPORT_PADDING,
) {
  const { width: dispW, height: dispH } = computeDisplaySize(
    vw,
    vh,
    logicalW,
    logicalH,
    padding,
  )
  return clampZoom(Math.min(dispW / logicalW, dispH / logicalH))
}

export function logFitDebug(label, data) {
  if (import.meta.env.DEV) {
    console.log(`[editor/fit] ${label}`, data)
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} vw
 * @param {number} vh
 * @param {number} [padding]
 */
export function applyFitToScreen(canvas, vw, vh, padding = FIT_VIEWPORT_PADDING) {
  const { width, height } = getLogicalSizeFromCanvas(canvas)
  const z = computeFitZoom(vw, vh, width, height, padding)
  const applied = applyDisplayZoom(canvas, z)

  logFitDebug('applyFitToScreen', {
    viewport: { vw, vh, padding },
    logicalSize: { width, height },
    zoom: applied,
    __logicalSize: canvas.__logicalSize,
  })

  return applied
}

/** @param {import('fabric').Canvas} canvas @param {number} targetZoom */
export function setUniformZoom(canvas, targetZoom) {
  return applyDisplayZoom(canvas, targetZoom)
}

export function zoomPercent(canvas) {
  return zoomPercentFromZoom(canvas.getZoom() || 1)
}

export function scrollHostDimensions(vw, vh, logicalW, logicalH, canvas) {
  if (vw < 8 || vh < 8) {
    return { innerW: vw, innerH: vh }
  }
  const z = clampZoom(canvas.getZoom() || 1)
  const docCssW = logicalW * z
  const docCssH = logicalH * z
  return {
    innerW: Math.max(vw, Math.ceil(docCssW)),
    innerH: Math.max(vh, Math.ceil(docCssH)),
  }
}

function readViewportClient(vp) {
  let vw = vp.clientWidth
  let vh = vp.clientHeight
  if (vw < 8 || vh < 8) {
    const r = vp.getBoundingClientRect()
    vw = Math.max(8, r.width)
    vh = Math.max(8, r.height)
  }
  return { vw, vh }
}

export function centerViewportScroll(vp, canvas, innerW, innerH) {
  const { vw, vh } = readViewportClient(vp)
  const maxSl = Math.max(0, innerW - vw)
  const maxSt = Math.max(0, innerH - vh)
  vp.scrollLeft = maxSl / 2
  vp.scrollTop = maxSt / 2
}

export function panScrollViewport(vp, dx, dy) {
  const maxSl = Math.max(0, vp.scrollWidth - vp.clientWidth)
  const maxSt = Math.max(0, vp.scrollHeight - vp.clientHeight)
  vp.scrollLeft = Math.min(maxSl, Math.max(0, vp.scrollLeft + dx))
  vp.scrollTop = Math.min(maxSt, Math.max(0, vp.scrollTop + dy))
}

export function centerViewportScrollAndSyncFabric(
  canvas,
  vp,
  logicalW,
  logicalH,
  innerW,
  innerH,
) {
  centerViewportScroll(vp, canvas, innerW, innerH)
}

/** @param {import('fabric').Canvas} canvas */
export function prepareCanvasForExport(canvas) {
  const logical = getLogicalSizeFromCanvas(canvas)
  return {
    logical,
    savedZoom: canvas.getZoom() || 1,
    savedWidth: canvas.getWidth(),
    savedHeight: canvas.getHeight(),
    savedVp: [...canvas.viewportTransform],
  }
}

/** @param {import('fabric').Canvas} canvas @param {ReturnType<typeof prepareCanvasForExport>} saved */
export function restoreCanvasAfterExport(canvas, saved) {
  canvas.setZoom(saved.savedZoom)
  canvas.setDimensions({ width: saved.savedWidth, height: saved.savedHeight })
  canvas.setViewportTransform(saved.savedVp)
  canvas.calcOffset()
  canvas.requestRenderAll()
}

/** @param {import('fabric').Canvas} canvas */
export function resetCanvasToLogicalForExport(canvas) {
  const { width, height } = getLogicalSizeFromCanvas(canvas)
  canvas.setZoom(1)
  canvas.setDimensions({ width, height })
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  canvas.calcOffset()
  canvas.requestRenderAll()
}
