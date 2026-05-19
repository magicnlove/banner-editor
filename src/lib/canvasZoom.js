import { ensureCanvasLogicalSizeFromViewBox, getLogicalSizeFromCanvas } from './template'

/**
 * 줌: canvas.setZoom + setDimensions(논리×줌). 논리 크기는 __viewBox → __logicalSize 순.
 */
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 3

export const FIT_VIEWPORT_PADDING = 32

export function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

/** @param {import('fabric').Canvas} canvas @param {{ width?: number; height?: number }} [fallback] */
export function getCanvasLogicalSize(canvas, fallback) {
  return getLogicalSizeFromCanvas(canvas, fallback)
}

/**
 * DOM 표시 크기 = __logicalSize×줌. setZoom + setDimensions 동기화.
 * @returns {number} 적용된 줌 (0.1~3)
 */
export function applyDisplayZoom(canvas, logicalW, logicalH, zoom) {
  const z = clampZoom(zoom)
  const logical = getLogicalSizeFromCanvas(canvas, {
    width: logicalW,
    height: logicalH,
  })
  canvas.setZoom(z)
  const dw = logical.width * z
  const dh = logical.height * z
  console.log('[setDimensions]', 'applyDisplayZoom', {
    width: dw,
    height: dh,
    zoom: z,
    logicalW: logical.width,
    logicalH: logical.height,
    passedW: logicalW,
    passedH: logicalH,
    __viewBox: canvas.__viewBox,
    __logicalSize: canvas.__logicalSize,
  })
  canvas.setDimensions({
    width: dw,
    height: dh,
  })
  ensureCanvasLogicalSizeFromViewBox(canvas, 'applyDisplayZoom')
  canvas.calcOffset()
  canvas.requestRenderAll()
  return z
}

/** @param {number} zoom */
export function zoomPercentFromZoom(zoom) {
  return Math.round(clampZoom(zoom) * 100)
}

/** 현재 줌 유지하며 DOM 크기만 논리 크기에 맞춤 */
export function syncCanvasDisplayZoom(canvas) {
  const logical = getCanvasLogicalSize(canvas)
  applyDisplayZoom(canvas, logical.width, logical.height, canvas.getZoom() || 1)
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
  console.log(`[editor/fit] ${label}`, data)
}

export function applyFitToScreen(
  canvas,
  vw,
  vh,
  logicalW,
  logicalH,
  padding = FIT_VIEWPORT_PADDING,
) {
  const z = computeFitZoom(vw, vh, logicalW, logicalH, padding)
  const applied = applyDisplayZoom(canvas, logicalW, logicalH, z)

  logFitDebug('applyFitToScreen', {
    viewport: { vw, vh, padding },
    logicalSize: { width: logicalW, height: logicalH },
    zoom: applied,
    getZoom: canvas.getZoom(),
    canvasWidth: canvas.getWidth(),
    canvasHeight: canvas.getHeight(),
    __logicalSize: canvas.__logicalSize,
  })

  return applied
}

export function setUniformZoom(canvas, logicalW, logicalH, targetZoom) {
  return applyDisplayZoom(canvas, logicalW, logicalH, targetZoom)
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

/**보내기 전 논리 해상도(줌 1)로 복원 */
export function prepareCanvasForExport(canvas) {
  const logical = getCanvasLogicalSize(canvas)
  return {
    logical,
    savedZoom: canvas.getZoom() || 1,
    savedWidth: canvas.getWidth(),
    savedHeight: canvas.getHeight(),
    savedVp: [...canvas.viewportTransform],
  }
}

export function restoreCanvasAfterExport(canvas, saved) {
  canvas.setZoom(saved.savedZoom)
  console.log('[setDimensions]', 'restoreCanvasAfterExport', {
    width: saved.savedWidth,
    height: saved.savedHeight,
    zoom: saved.savedZoom,
    __viewBox: canvas.__viewBox,
    __logicalSize: canvas.__logicalSize,
  })
  canvas.setDimensions({ width: saved.savedWidth, height: saved.savedHeight })
  canvas.setViewportTransform(saved.savedVp)
  canvas.calcOffset()
  canvas.requestRenderAll()
}

export function resetCanvasToLogicalForExport(canvas, logicalW, logicalH) {
  const logical = getLogicalSizeFromCanvas(canvas, {
    width: logicalW,
    height: logicalH,
  })
  canvas.setZoom(1)
  console.log('[setDimensions]', 'resetCanvasToLogicalForExport', {
    width: logical.width,
    height: logical.height,
    zoom: 1,
    passedW: logicalW,
    passedH: logicalH,
    __viewBox: canvas.__viewBox,
    __logicalSize: canvas.__logicalSize,
  })
  canvas.setDimensions({ width: logical.width, height: logical.height })
  ensureCanvasLogicalSizeFromViewBox(canvas, 'resetCanvasToLogicalForExport')
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  canvas.calcOffset()
  canvas.requestRenderAll()
}
