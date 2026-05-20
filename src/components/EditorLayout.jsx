import { useMemo, useState, useCallback } from 'react'
import { EditorProvider } from '../context/EditorContext'
import { WorkspaceOverlayProvider } from '../context/WorkspaceOverlayContext'
import { EditorCanvasToolbar } from './EditorCanvasToolbar'
import { getTemplate, parseViewBoxFromSvgString } from '../lib/template'
import { FabricWorkspace } from './FabricWorkspace'
import { ToolPanel } from './ToolPanel'
import { PropertiesPanel } from './PropertiesPanel'
import { EditorHeader } from './EditorHeader'
import { EditorDirtyBridge } from './EditorDirtyBridge'
import {
  CANVAS_SIZE_MAX_PX,
  CANVAS_SIZE_MIN_PX,
  cmToPx,
} from '../lib/units'

/** @param {{ config: import('../lib/template').EditorConfig, onHome: () => void, onDirtyChange?: (dirty: boolean) => void }} props */
export function EditorLayout({ config, onHome, onDirtyChange }) {
  const isFree = config.type === 'free'
  const template = useMemo(
    () => (isFree ? null : getTemplate(config.templateKey)),
    [config, isFree],
  )

  const templateViewBox = useMemo(() => {
    if (isFree || !template?.raw) return null
    return parseViewBoxFromSvgString(template.raw)
  }, [isFree, template])

  const initialSize = useMemo(() => {
    if (isFree) {
      return { width: config.widthPx, height: config.heightPx }
    }
    if (templateViewBox) {
      return {
        width: Math.max(1, templateViewBox.width),
        height: Math.max(1, templateViewBox.height),
      }
    }
    return { width: Math.round(cmToPx(30)), height: Math.round(cmToPx(20)) }
  }, [config, isFree, templateViewBox])

  const [canvasWidth, setCanvasWidth] = useState(initialSize.width)
  const [canvasHeight, setCanvasHeight] = useState(initialSize.height)
  const [customFonts, setCustomFonts] = useState([])

  const onTemplateLoaded = useCallback(({ width, height }) => {
    setCanvasWidth(width)
    setCanvasHeight(height)
  }, [])

  const onCanvasSizeChange = useCallback((w, h) => {
    const nw = Math.min(
      CANVAS_SIZE_MAX_PX,
      Math.max(CANVAS_SIZE_MIN_PX, Number(w) || CANVAS_SIZE_MIN_PX),
    )
    const nh = Math.min(
      CANVAS_SIZE_MAX_PX,
      Math.max(CANVAS_SIZE_MIN_PX, Number(h) || CANVAS_SIZE_MIN_PX),
    )
    setCanvasWidth(nw)
    setCanvasHeight(nh)
  }, [])

  const onCustomFont = useCallback((entry) => {
    setCustomFonts((prev) => [...prev, entry])
  }, [])

  return (
    <EditorProvider>
      <WorkspaceOverlayProvider>
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
          <EditorCanvasToolbar />
          <div className="flex min-h-0 min-w-0 flex-1">
          <ToolPanel />
          <FabricWorkspace
            width={canvasWidth}
            height={canvasHeight}
            isFree={isFree}
            templateSvgUrl={template?.url ?? null}
            templateSvgRaw={template?.raw ?? null}
            templateViewBox={templateViewBox}
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
      </WorkspaceOverlayProvider>
    </EditorProvider>
  )
}
