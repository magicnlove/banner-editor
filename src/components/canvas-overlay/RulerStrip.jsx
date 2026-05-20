import { useEffect, useRef } from 'react'
import { formatRulerLabel, pickRulerTickStep } from '../../lib/rulerTicks'
import { pointerToLogicalGuidePos } from '../../hooks/useFabricCanvasMetrics'

const RULER_SIZE = 24
const BRAND = '#FF6600'

/**
 * @param {{
 *   orientation: 'horizontal' | 'vertical';
 *   metrics: {
 *     zoom: number;
 *     logicalW: number;
 *     logicalH: number;
 *     displayW: number;
 *     displayH: number;
 *     wrapperLeft: number;
 *     wrapperTop: number;
 *     viewportClientW: number;
 *     viewportClientH: number;
 *   };
 *   unit: 'px' | 'cm';
 *   enabled?: boolean;
 *   onPreviewGuide?: (orientation: 'horizontal' | 'vertical', position: number) => void;
 *   onClearPreview?: () => void;
 *   onCreateGuide?: (orientation: 'horizontal' | 'vertical', logicalPos: number) => void;
 * }} props
 */
export function RulerStrip({
  orientation,
  metrics,
  unit,
  enabled = true,
  onPreviewGuide,
  onClearPreview,
  onCreateGuide,
}) {
  const canvasRef = useRef(null)
  const isH = orientation === 'horizontal'
  const guideOrientation = isH ? 'vertical' : 'horizontal'

  useEffect(() => {
    const el = canvasRef.current
    if (!el || !metrics) return

    const dpr = window.devicePixelRatio || 1
    const cssW = isH ? metrics.viewportClientW : RULER_SIZE
    const cssH = isH ? RULER_SIZE : metrics.viewportClientH
    el.width = Math.floor(cssW * dpr)
    el.height = Math.floor(cssH * dpr)
    el.style.width = `${cssW}px`
    el.style.height = `${cssH}px`

    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    ctx.fillStyle = '#f0f2f6'
    ctx.fillRect(0, 0, cssW, cssH)
    ctx.strokeStyle = '#d5dae3'
    ctx.fillStyle = '#5c6370'
    ctx.font = '10px "Noto Sans KR", sans-serif'
    ctx.lineWidth = 1

    const { zoom, logicalW, logicalH, wrapperLeft, wrapperTop } = metrics
    const { major, labelUnit } = pickRulerTickStep(zoom, unit)
    const minor = major / 5
    const docLen = isH ? logicalW : logicalH
    const offset = isH ? wrapperLeft : wrapperTop

    const startLogical = Math.floor(Math.max(0, -offset / zoom) / minor) * minor
    const endLogical = Math.min(
      docLen,
      Math.ceil(((isH ? cssW : cssH) - offset) / zoom / minor) * minor +
        minor,
    )

    for (let v = startLogical; v <= endLogical; v += minor) {
      const screen = offset + v * zoom
      if (screen < -2 || screen > (isH ? cssW : cssH) + 2) continue
      const isMajor =
        Math.abs(v % major) < 0.001 ||
        Math.abs((v % major) - major) < 0.001
      const tickLen = isMajor ? 10 : 5

      if (isH) {
        ctx.beginPath()
        ctx.moveTo(screen + 0.5, cssH)
        ctx.lineTo(screen + 0.5, cssH - tickLen)
        ctx.stroke()
        if (isMajor && v <= docLen) {
          ctx.fillText(formatRulerLabel(v, labelUnit), screen + 2, 10)
        }
      } else {
        ctx.beginPath()
        ctx.moveTo(cssW, screen + 0.5)
        ctx.lineTo(cssW - tickLen, screen + 0.5)
        ctx.stroke()
        if (isMajor && v <= docLen) {
          const label = formatRulerLabel(v, labelUnit)
          ctx.save()
          ctx.translate(2, screen + 2)
          ctx.rotate(-Math.PI / 2)
          ctx.fillText(label, 0, 0)
          ctx.restore()
        }
      }
    }

    ctx.strokeStyle = BRAND
    ctx.lineWidth = 2
    if (isH) {
      ctx.beginPath()
      ctx.moveTo(0, cssH - 0.5)
      ctx.lineTo(cssW, cssH - 0.5)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(cssW - 0.5, 0)
      ctx.lineTo(cssW - 0.5, cssH)
      ctx.stroke()
    }
  }, [isH, metrics, unit])

  const handlePointerDown = (e) => {
    if (!enabled || !metrics || !onCreateGuide || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)

    const updatePreview = (ev) => {
      const pos = pointerToLogicalGuidePos(
        ev.clientX,
        ev.clientY,
        orientation,
        metrics,
      )
      onPreviewGuide?.(guideOrientation, pos)
    }

    const finish = (ev) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const pos = pointerToLogicalGuidePos(
        ev.clientX,
        ev.clientY,
        orientation,
        metrics,
      )
      onCreateGuide(guideOrientation, pos)
      onClearPreview?.()
      window.removeEventListener('pointermove', updatePreview)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }

    updatePreview(e)
    window.addEventListener('pointermove', updatePreview)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  return (
    <canvas
      ref={canvasRef}
      className={`block shrink-0 select-none ${
        enabled ? 'cursor-crosshair' : 'cursor-default opacity-60'
      } ${isH ? 'w-full' : 'w-6'} ${isH ? 'h-6' : 'flex-1'}`}
      style={isH ? { height: RULER_SIZE } : { width: RULER_SIZE }}
      onPointerDown={handlePointerDown}
      title={
        enabled
          ? '눌러 캔버스 쪽으로 드래그하면 안내선이 생깁니다'
          : '툴바에서 안내선을 켜 주세요'
      }
      aria-hidden
    />
  )
}

export const RULER_STRIP_SIZE = RULER_SIZE
