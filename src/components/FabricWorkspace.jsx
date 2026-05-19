import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { Canvas, FabricImage } from 'fabric'
import {
  getLogicalSizeFromCanvas,
  isTemplateLayerObject,
  loadTemplateOntoCanvas,
  initBlankCanvas,
  resizeCanvasLogicalSize,
  applyTemplateCanvasDimensions,
  logTemplateCanvasMetrics,
  setCanvasLogicalSize,
  syncCanvasToTemplateBounds,
} from '../lib/template'
import { placeObjectAtCanvasCenter } from '../lib/fabricPlacement'
import { useEditor } from '../context/EditorContext'
import { CanvasZoomBar } from './CanvasZoomBar'
import {
  applyDisplayZoom,
  centerViewportScrollAndSyncFabric,
  clampZoom,
  computeFitZoom,
  logFitDebug,
  panScrollViewport,
  scrollHostDimensions,
  zoomPercentFromZoom,
} from '../lib/canvasZoom'
import { ensureAppFontsReady, loadCanvasTextFontsAndRender } from '../lib/appFonts'
import { attachCanvasTextOverlay } from '../lib/fabricTextOverlay'

const ZOOM_BTN_FACTOR = 1.12

/** viewBox 기준 논리 크기 (__logicalSize) */
function logicalSizeOf(inst, width, height) {
  if (!inst) return { width, height }
  return getLogicalSizeFromCanvas(inst)
}

/** 편집 영역(중앙 패널) 실제 DOM 크기 */
function viewportInnerPixels(vp) {
  const r = vp.getBoundingClientRect()
  const vw = Math.max(8, Math.floor(r.width) || vp.clientWidth || 8)
  const vh = Math.max(8, Math.floor(r.height) || vp.clientHeight || 8)
  return { vw, vh }
}

export function FabricWorkspace({
  width,
  height,
  isFree = false,
  templateSvgUrl,
  templateSvgRaw,
  templateViewBox = null,
  onTemplateLoaded,
}) {
  const hostRef = useRef(null)
  const viewportRef = useRef(null)
  const innerSizerRef = useRef(null)
  const fabricRef = useRef(null)
  const sizeRef = useRef({ width, height })
  const panningRef = useRef(false)
  const suppressScrollSyncRef = useRef(false)
  const scrollSizerRef = useRef({ innerW: 0, innerH: 0 })
  const canvasReadyRef = useRef(false)
  const appliedCanvasSizeRef = useRef(null)

  const [zoomPct, setZoomPct] = useState(100)
  const [scrollSizer, setScrollSizer] = useState({ innerW: 0, innerH: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const { registerCanvas, setSelected, bump, registerFitToScreen, runWithoutDirty } =
    useEditor()

  useLayoutEffect(() => {
    sizeRef.current = { width, height }
  }, [width, height])

  const pushScrollSurface = useCallback(
    (vp, inst) => {
      const { vw, vh } = viewportInnerPixels(vp)
      const logical = logicalSizeOf(inst, width, height)
      const { innerW, innerH } = scrollHostDimensions(
        vw,
        vh,
        logical.width,
        logical.height,
        inst,
      )
      const innerEl = innerSizerRef.current
      if (innerEl) {
        innerEl.style.width = `${innerW}px`
        innerEl.style.height = `${innerH}px`
      }
      scrollSizerRef.current = { innerW, innerH }
      setScrollSizer((prev) =>
        prev.innerW === innerW && prev.innerH === innerH ? prev : { innerW, innerH },
      )
      return { innerW, innerH, vw, vh }
    },
    [width, height],
  )

  const syncScrollCentered = useCallback(
    (vp, inst) => {
      pushScrollSurface(vp, inst)
      const { innerW, innerH } = scrollSizerRef.current
      if (innerW < 8 || innerH < 8) return
      suppressScrollSyncRef.current = true
      const logical = logicalSizeOf(inst, width, height)
      centerViewportScrollAndSyncFabric(
        inst,
        vp,
        logical.width,
        logical.height,
        innerW,
        innerH,
      )
      requestAnimationFrame(() => {
        suppressScrollSyncRef.current = false
      })
    },
    [width, height, pushScrollSurface],
  )

  /** 줌 적용 + React zoom % state 동기화 (휠·버튼·맞추기 공통) */
  const commitZoomLevel = useCallback(
    (zoomLevel, { centerScroll = true } = {}) => {
      const inst = fabricRef.current
      const vp = viewportRef.current
      if (!inst) return null

      const logical = logicalSizeOf(inst, width, height)
      const applied = applyDisplayZoom(
        inst,
        logical.width,
        logical.height,
        zoomLevel,
      )
      setZoomPct(zoomPercentFromZoom(applied))

      if (centerScroll && vp) {
        syncScrollCentered(vp, inst)
      } else if (vp) {
        pushScrollSurface(vp, inst)
      }
      bump()
      return applied
    },
    [width, height, bump, syncScrollCentered, pushScrollSurface],
  )

  const scheduleFit = useCallback(() => {
    const c = fabricRef.current
    const vp = viewportRef.current
    if (!c || !vp || !canvasReadyRef.current) return

    const runFit = () => {
      const { vw, vh } = viewportInnerPixels(vp)
      if (vw < 8 || vh < 8) return

      const logical = logicalSizeOf(c, width, height)
      sizeRef.current = { width: logical.width, height: logical.height }

      logFitDebug('scheduleFit (before apply)', {
        viewport: { vw, vh },
        logicalSize: logical,
        __logicalSize: c.__logicalSize,
        viewBox: c.__viewBox,
        canvasBuffer: { width: c.width, height: c.height },
      })

      const z = computeFitZoom(vw, vh, logical.width, logical.height)
      commitZoomLevel(z)
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        runFit()
        requestAnimationFrame(runFit)
      })
    })
  }, [width, height, commitZoomLevel])

  const scheduleFitRef = useRef(scheduleFit)

  useLayoutEffect(() => {
    scheduleFitRef.current = scheduleFit
  }, [scheduleFit])

  useEffect(() => {
    registerFitToScreen(() => scheduleFitRef.current?.())
    return () => registerFitToScreen(null)
  }, [registerFitToScreen])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    let cancelled = false
    let inst = null

    const onKey = (ev) => {
      if (!inst || (ev.key !== 'Delete' && ev.key !== 'Backspace')) return
      const active = inst.getActiveObject()
      if (!active || isTemplateLayerObject(active)) return
      const t = ev.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))
        return
      inst.remove(active)
      inst.discardActiveObject()
      inst.requestRenderAll()
      setSelected(null)
      bump()
    }

    const setup = async () => {
      await ensureAppFontsReady()
      if (cancelled) return

      let { width: w, height: h } = sizeRef.current
      if (!isFree && templateViewBox) {
        w = Math.max(1, templateViewBox.width)
        h = Math.max(1, templateViewBox.height)
        sizeRef.current = { width: w, height: h }
      }
      inst = new Canvas(el, {
        width: w,
        height: h,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true,
      })
      fabricRef.current = inst
      if (!isFree && templateViewBox) {
        applyTemplateCanvasDimensions(inst, w, h, templateViewBox)
      } else {
        setCanvasLogicalSize(inst, w, h, 'FabricWorkspace:canvasInit')
      }

      const onSelect = (e) => {
        const t = e?.selected?.[0] ?? e?.target ?? null
        setSelected(t ?? null)
      }

      inst.on('selection:created', onSelect)
      inst.on('selection:updated', onSelect)
      inst.on('selection:cleared', () => setSelected(null))
      const dirty = () => bump()
      inst.on('object:modified', dirty)
      inst.on('object:added', dirty)
      inst.on('object:removed', dirty)

      attachCanvasTextOverlay(inst)

      window.addEventListener('keydown', onKey)

      setLoading(true)
      setLoadError(null)
      try {
        let lw
        let lh
        let viewBox
        if (isFree) {
          const blank = initBlankCanvas(inst, w, h)
          lw = blank.width
          lh = blank.height
          viewBox = blank.viewBox
        } else {
          const loaded = await loadTemplateOntoCanvas(
            inst,
            templateSvgUrl,
            templateSvgRaw,
          )
          lw = loaded.width
          lh = loaded.height
          viewBox = loaded.viewBox
        }
        if (cancelled) return
        sizeRef.current = { width: lw, height: lh }
        appliedCanvasSizeRef.current = { width: lw, height: lh }
        if (!isFree) {
          syncCanvasToTemplateBounds(inst)
        } else {
          applyTemplateCanvasDimensions(inst, lw, lh, viewBox)
        }
        const logicalAfterLoad = getLogicalSizeFromCanvas(inst)
        lw = logicalAfterLoad.width
        lh = logicalAfterLoad.height
        await loadCanvasTextFontsAndRender(inst)
        if (cancelled) return
        const templateObj = inst
          .getObjects()
          .find((o) => isTemplateLayerObject(o))
        logTemplateCanvasMetrics(
          inst,
          templateObj,
          isFree ? 'after initBlankCanvas' : 'after template load (zoom=1)',
        )
        onTemplateLoaded?.({ width: lw, height: lh })
        runWithoutDirty(() => registerCanvas(inst))
        canvasReadyRef.current = true
        if (!cancelled) setLoading(false)
        requestAnimationFrame(() => {
          if (!cancelled) scheduleFitRef.current()
        })
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setLoadError(isFree ? '캔버스를 초기화하지 못했습니다.' : '템플릿을 불러오지 못했습니다.')
        setLoading(false)
      }
    }

    setup()

    return () => {
      cancelled = true
      window.removeEventListener('keydown', onKey)
      canvasReadyRef.current = false
      if (inst) {
        inst.dispose()
        fabricRef.current = null
        registerCanvas(null)
        setSelected(null)
      }
    }
  }, [
    isFree,
    templateSvgUrl,
    templateSvgRaw,
    templateViewBox,
    onTemplateLoaded,
    registerCanvas,
    setSelected,
    bump,
  ])

  useEffect(() => {
    const inst = fabricRef.current
    if (!inst || !canvasReadyRef.current || loading) return

    const isTemplateCanvas = inst.getObjects().some((o) => isTemplateLayerObject(o))
    const viewBox = inst.__viewBox

    if (isTemplateCanvas && viewBox) {
      syncCanvasToTemplateBounds(inst)
      const logical = getLogicalSizeFromCanvas(inst)
      sizeRef.current = logical
      appliedCanvasSizeRef.current = logical
      scheduleFit()
      return
    }

    const prev = appliedCanvasSizeRef.current
    const logical = getLogicalSizeFromCanvas(inst)
    const propsChanged =
      prev && (prev.width !== width || prev.height !== height)
    const alreadyLogical =
      Math.abs(logical.width - width) < 0.01 && Math.abs(logical.height - height) < 0.01

    if (propsChanged && !alreadyLogical) {
      resizeCanvasLogicalSize(inst, width, height)
      sizeRef.current = { width, height }
      scheduleFit()
      bump()
    } else if (propsChanged && alreadyLogical) {
      sizeRef.current = { width, height }
      applyTemplateCanvasDimensions(inst, logical.width, logical.height, inst.__viewBox)
      scheduleFit()
    }

    appliedCanvasSizeRef.current = getLogicalSizeFromCanvas(inst)
  }, [width, height, loading, scheduleFit, bump])

  useEffect(() => {
    if (loading || loadError || !canvasReadyRef.current) return
    scheduleFit()
  }, [loading, loadError, scheduleFit])

  useEffect(() => {
    const vp = viewportRef.current
    const inst = fabricRef.current
    if (!vp || !inst) return

    const onWheel = (e) => {
      if (!canvasReadyRef.current) return
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        const factor = Math.exp(-e.deltaY * 0.0018)
        const newZ = clampZoom((inst.getZoom() || 1) * factor)
        commitZoomLevel(newZ)
        return
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      const { innerW, innerH } = scrollSizerRef.current
      if (innerW < 8 || innerH < 8) return
      let dx = e.deltaX
      let dy = e.deltaY
      if (e.shiftKey && dx === 0) {
        dx = dy
        dy = 0
      }
      panScrollViewport(vp, dx, dy)
      bump()
    }

    vp.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => vp.removeEventListener('wheel', onWheel, { capture: true })
  }, [bump, width, height, commitZoomLevel])

  useEffect(() => {
    const vp = viewportRef.current
    const inst = fabricRef.current
    if (!vp || !inst) return

    const onMove = (e) => {
      if (!canvasReadyRef.current) return
      if (!panningRef.current || e.buttons !== 4) return
      e.preventDefault()
      const { innerW, innerH } = scrollSizerRef.current
      if (innerW < 8 || innerH < 8) return
      panScrollViewport(vp, -e.movementX, -e.movementY)
      bump()
    }
    const onUp = (e) => {
      if (e.button === 1) panningRef.current = false
    }
    const onDown = (e) => {
      if (e.button !== 1) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      e.preventDefault()
      panningRef.current = true
    }

    window.addEventListener('mousemove', onMove, { passive: false })
    window.addEventListener('mouseup', onUp)
    vp.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      vp.removeEventListener('mousedown', onDown)
    }
  }, [bump, width, height])

  useEffect(() => {
    const vp = viewportRef.current
    const inst = fabricRef.current
    if (!vp || !inst) return

    const ro = new ResizeObserver(() => {
      if (!canvasReadyRef.current) return
      const c = fabricRef.current
      if (!c) return
      commitZoomLevel(c.getZoom() || 1)
      const { innerW, innerH } = scrollSizerRef.current
      if (innerW >= 8 && innerH >= 8) {
        suppressScrollSyncRef.current = true
        syncScrollCentered(vp, c)
        requestAnimationFrame(() => {
          suppressScrollSyncRef.current = false
        })
      }
    })
    ro.observe(vp)
    return () => ro.disconnect()
  }, [width, height, commitZoomLevel, syncScrollCentered])

  const handleZoomOut = useCallback(() => {
    const inst = fabricRef.current
    if (!inst) return
    commitZoomLevel((inst.getZoom() || 1) / ZOOM_BTN_FACTOR)
  }, [commitZoomLevel])

  const handleZoomIn = useCallback(() => {
    const inst = fabricRef.current
    if (!inst) return
    commitZoomLevel((inst.getZoom() || 1) * ZOOM_BTN_FACTOR)
  }, [commitZoomLevel])

  const handleFit = useCallback(() => {
    const inst = fabricRef.current
    const vp = viewportRef.current
    if (!inst || !vp) return
    const logical = logicalSizeOf(inst, width, height)
    const { vw, vh } = viewportInnerPixels(vp)
    const z = computeFitZoom(vw, vh, logical.width, logical.height)
    commitZoomLevel(z)
  }, [width, height, commitZoomLevel])

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#e4e6ea]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault()
        const inst = fabricRef.current
        if (!inst) return
        const file = e.dataTransfer.files?.[0]
        if (!file || !file.type.startsWith('image/')) return
        const url = URL.createObjectURL(file)
        try {
          const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
          img.set({ originX: 'center', originY: 'center' })
          placeObjectAtCanvasCenter(inst, img)
          inst.add(img)
          inst.setActiveObject(img)
          inst.requestRenderAll()
          bump()
        } finally {
          URL.revokeObjectURL(url)
        }
      }}
    >
      {loading && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#e4e6ea]/90"
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[#d5dae3] border-t-[#FF6600]"
            aria-hidden
          />
          <p className="text-sm font-medium text-[#5c6370]">
            {isFree ? '캔버스 준비 중…' : '템플릿 불러오는 중…'}
          </p>
        </div>
      )}
      {loadError && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#e4e6ea]/95 px-6">
          <p className="text-center text-sm text-red-600">{loadError}</p>
        </div>
      )}
      <div
        ref={viewportRef}
        className="fabric-viewport fabric-scroll-host fabric-canvas-wrap relative min-h-0 min-w-0 w-full flex-1 overflow-x-auto overflow-y-auto p-4 pb-20"
        title="휠: 이동 · Ctrl+휠: 줌 · 가운데 버튼 드래그: 이동 · 스크롤바: 잘린 영역 이동"
      >
        <div
          ref={innerSizerRef}
          className="box-border flex items-center justify-center"
          style={{
            width:
              scrollSizer.innerW > 0 ? `${scrollSizer.innerW}px` : '100%',
            height:
              scrollSizer.innerH > 0 ? `${scrollSizer.innerH}px` : '100%',
          }}
        >
          <canvas ref={hostRef} className="block shrink-0" />
        </div>
      </div>
      <CanvasZoomBar
        percent={zoomPct}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
        onFit={handleFit}
      />
    </div>
  )
}
