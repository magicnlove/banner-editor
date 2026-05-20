import { useCallback, useRef, useState } from 'react'
import { useWorkspaceOverlay } from '../../context/WorkspaceOverlayContext'

const GUIDE_LINE_COLOR = '#5c6370'
const HIT = 6

/**
 * @param {{
 *   guides: Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>;
 *   metrics: {
 *     zoom: number;
 *     logicalW: number;
 *     logicalH: number;
 *     displayW: number;
 *     displayH: number;
 *   };
 *   visible: boolean;
 *   previewGuide?: { orientation: 'horizontal' | 'vertical'; position: number } | null;
 * }} props
 */
export function CanvasGuidesLayer({
  guides,
  metrics,
  visible,
  previewGuide = null,
}) {
  const { updateGuide, removeGuide } = useWorkspaceOverlay()
  const dragRef = useRef(
    /** @type {{ id: string; startPos: number; startClient: number; vertical: boolean } | null} */ (
      null
    ),
  )
  const [draggingId, setDraggingId] = useState(/** @type {string | null} */ (null))

  const onPointerMove = useCallback(
    (e) => {
      const d = dragRef.current
      if (!d) return
      const deltaClient = (d.vertical ? e.clientX : e.clientY) - d.startClient
      const deltaLogical = deltaClient / metrics.zoom
      const next = Math.max(0, d.startPos + deltaLogical)
      const cap = d.vertical ? metrics.logicalW : metrics.logicalH
      updateGuide(d.id, Math.min(cap, next))
    },
    [metrics, updateGuide],
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
    setDraggingId(null)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
  }, [onPointerMove])

  const startDrag = useCallback(
    (e, guide) => {
      e.preventDefault()
      e.stopPropagation()
      const vertical = guide.orientation === 'vertical'
      dragRef.current = {
        id: guide.id,
        startPos: guide.position,
        startClient: vertical ? e.clientX : e.clientY,
        vertical,
      }
      setDraggingId(guide.id)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', endDrag)
    },
    [onPointerMove, endDrag],
  )

  const { zoom, displayW, displayH } = metrics
  const showGuides = visible || previewGuide

  if (!showGuides) return null

  const allGuides = previewGuide
    ? [
        ...guides,
        {
          id: '__preview__',
          orientation: previewGuide.orientation,
          position: previewGuide.position,
        },
      ]
    : guides

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ width: displayW, height: displayH }}
      aria-hidden
    >
      {allGuides.map((g) => {
        const vertical = g.orientation === 'vertical'
        const screen = g.position * zoom
        const isPreview = g.id === '__preview__'
        const isDrag = draggingId === g.id
        if (isPreview) {
          return (
            <div
              key={g.id}
              className="pointer-events-none absolute"
              style={
                vertical
                  ? {
                      left: screen,
                      top: 0,
                      width: 1,
                      height: displayH,
                      background: GUIDE_LINE_COLOR,
                      opacity: 0.7,
                    }
                  : {
                      left: 0,
                      top: screen,
                      width: displayW,
                      height: 1,
                      background: GUIDE_LINE_COLOR,
                      opacity: 0.7,
                    }
              }
            />
          )
        }
        return (
          <div
            key={g.id}
            className="pointer-events-auto absolute"
            style={
              vertical
                ? {
                    left: screen - HIT,
                    top: 0,
                    width: HIT * 2,
                    height: displayH,
                    cursor: 'col-resize',
                  }
                : {
                    left: 0,
                    top: screen - HIT,
                    width: displayW,
                    height: HIT * 2,
                    cursor: 'row-resize',
                  }
            }
            onPointerDown={(e) => startDrag(e, g)}
            onDoubleClick={() => removeGuide(g.id)}
            title="드래그: 이동 · 더블클릭: 삭제"
          >
            <div
              className="absolute"
              style={
                vertical
                  ? {
                      left: HIT - 0.5,
                      top: 0,
                      width: 1,
                      height: '100%',
                      background: GUIDE_LINE_COLOR,
                      opacity: isDrag ? 1 : 0.9,
                    }
                  : {
                      left: 0,
                      top: HIT - 0.5,
                      width: '100%',
                      height: 1,
                      background: GUIDE_LINE_COLOR,
                      opacity: isDrag ? 1 : 0.9,
                    }
              }
            />
          </div>
        )
      })}
    </div>
  )
}
