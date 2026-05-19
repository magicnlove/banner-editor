import { useMemo, useState, useCallback } from 'react'
import { EditorProvider } from '../context/EditorContext'
import { getTemplate, parseViewBoxFromSvgString } from '../lib/template'
import { FabricWorkspace } from './FabricWorkspace'
import { ToolPanel } from './ToolPanel'
import { PropertiesPanel } from './PropertiesPanel'
import { EditorHeader } from './EditorHeader'
import { EditorDirtyBridge } from './EditorDirtyBridge'
import { cmToPx } from '../lib/units'

/** @param {{ config: import('../lib/template').EditorConfig, onHome: () => void, onDirtyChange?: (dirty: boolean) => void }} props */
export function EditorLayout({ config, onHome, onDirtyChange }) {
  const isFree = config.type === 'free'
  const template = useMemo(
    () => (isFree ? null : getTemplate(config.templateKey)),
    [config, isFree],
  )

  const initialSize = useMemo(() => {
    if (isFree) {
      return { width: config.widthPx, height: config.heightPx }
    }
    const vb = template?.raw ? parseViewBoxFromSvgString(template.raw) : null
    if (vb) {
      return {
        width: Math.max(1, Math.round(vb.width)),
        height: Math.max(1, Math.round(vb.height)),
      }
    }
    return { width: Math.round(cmToPx(30)), height: Math.round(cmToPx(20)) }
  }, [config, isFree, template])

  const [canvasWidth, setCanvasWidth] = useState(initialSize.width)
  const [canvasHeight, setCanvasHeight] = useState(initialSize.height)
  const [customFonts, setCustomFonts] = useState([])

  const onTemplateLoaded = useCallback(({ width, height }) => {
    setCanvasWidth(width)
    setCanvasHeight(height)
  }, [])

  const onCanvasSizeChange = useCallback((w, h) => {
    const nw = Math.min(8000, Math.max(38, Number(w) || 38))
    const nh = Math.min(8000, Math.max(38, Number(h) || 38))
    setCanvasWidth(nw)
    setCanvasHeight(nh)
  }, [])

  const onCustomFont = useCallback((entry) => {
    setCustomFonts((prev) => [...prev, entry])
  }, [])

  return (
    <EditorProvider>
      <EditorDirtyBridge onDirtyChange={onDirtyChange} />
      <div className="flex h-full min-h-0 flex-col bg-[#f6f7f9]">
        <EditorHeader
          onHome={onHome}
          customFonts={customFonts}
          editorConfig={config}
          onWorkStateLoaded={({ logicalSize }) => {
            setCanvasWidth(logicalSize.width)
            setCanvasHeight(logicalSize.height)
          }}
        />
        <div className="flex min-h-0 min-w-0 flex-1">
          <ToolPanel />
          <FabricWorkspace
            width={canvasWidth}
            height={canvasHeight}
            isFree={isFree}
            templateSvgUrl={template?.url ?? null}
            templateSvgRaw={template?.raw ?? null}
            onTemplateLoaded={onTemplateLoaded}
          />
          <PropertiesPanel
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onCanvasSizeChange={onCanvasSizeChange}
            customFonts={customFonts}
            onCustomFont={onCustomFont}
          />
        </div>
      </div>
    </EditorProvider>
  )
}
