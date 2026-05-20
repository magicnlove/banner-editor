import { useEffect, useState } from 'react'

/**
 * @param {import('fabric').Canvas | null} canvas
 * @param {React.RefObject<HTMLElement | null>} viewportRef
 * @param {React.RefObject<HTMLCanvasElement | null>} hostRef
 * @param {number} logicalW
 * @param {number} logicalH
 * @param {number} layoutTick
 */
export function useFabricCanvasMetrics(
  canvas,
  viewportRef,
  hostRef,
  logicalW,
  logicalH,
  layoutTick,
) {
  const [metrics, setMetrics] = useState(
    /** @type {null | {
     *   zoom: number;
     *   logicalW: number;
     *   logicalH: number;
     *   displayW: number;
     *   displayH: number;
     *   wrapperLeft: number;
     *   wrapperTop: number;
     *   viewportClientW: number;
     *   viewportClientH: number;
     * }} */ (null),
  )

  useEffect(() => {
    const vp = viewportRef.current
    const host = hostRef.current
    if (!vp || !host || !canvas) {
      setMetrics(null)
      return
    }

    const wrapper = host.parentElement
    if (!wrapper) {
      setMetrics(null)
      return
    }

    const update = () => {
      const vpRect = vp.getBoundingClientRect()
      const wrapRect = wrapper.getBoundingClientRect()
      const zoom = canvas.getZoom() || 1
      setMetrics({
        zoom,
        logicalW,
        logicalH,
        displayW: canvas.getWidth(),
        displayH: canvas.getHeight(),
        wrapperLeft: wrapRect.left - vpRect.left,
        wrapperTop: wrapRect.top - vpRect.top,
        viewportClientW: vp.clientWidth,
        viewportClientH: vp.clientHeight,
      })
    }

    update()
    vp.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })

    const ro = new ResizeObserver(update)
    ro.observe(vp)
    ro.observe(wrapper)

    const anim = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(anim)
      vp.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      ro.disconnect()
    }
  }, [canvas, viewportRef, hostRef, logicalW, logicalH, layoutTick])

  return metrics
}

/**
 * @param {number} clientCoord
 * @param {NonNullable<ReturnType<typeof useFabricCanvasMetrics>>} metrics
 */
export function clientToLogicalX(clientCoord, metrics) {
  const { wrapperLeft, zoom } = metrics
  return (clientCoord - wrapperLeft) / zoom
}

/**
 * @param {number} clientCoord
 * @param {NonNullable<ReturnType<typeof useFabricCanvasMetrics>>} metrics
 */
export function clientToLogicalY(clientCoord, metrics) {
  const { wrapperTop, zoom } = metrics
  return (clientCoord - wrapperTop) / zoom
}

/**
 * 눈금자 드래그 → 논리 좌표 (viewport 기준 clientX/Y)
 * @param {number} clientX
 * @param {number} clientY
 * @param {'horizontal' | 'vertical'} rulerOrientation
 * @param {NonNullable<ReturnType<typeof useFabricCanvasMetrics>>} metrics
 */
export function pointerToLogicalGuidePos(
  clientX,
  clientY,
  rulerOrientation,
  metrics,
) {
  const vp = document.querySelector('.fabric-viewport')
  if (!vp) return 0
  const vpRect = vp.getBoundingClientRect()
  const { wrapperLeft, wrapperTop, zoom, logicalW, logicalH } = metrics

  if (rulerOrientation === 'horizontal') {
    const x = (clientX - vpRect.left - wrapperLeft) / zoom
    return Math.min(logicalW, Math.max(0, x))
  }
  const y = (clientY - vpRect.top - wrapperTop) / zoom
  return Math.min(logicalH, Math.max(0, y))
}
