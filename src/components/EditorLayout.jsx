import { useMemo, useState, useCallback } from 'react'
import { EditorProvider } from '../context/EditorContext'
import { getTemplate } from '../lib/template'
import { FabricWorkspace } from './FabricWorkspace'
import { ToolPanel } from './ToolPanel'
import { PropertiesPanel } from './PropertiesPanel'
import { EditorHeader } from './EditorHeader'

export function EditorLayout({ templateKey, onHome }) {
  const template = useMemo(() => getTemplate(templateKey), [templateKey])

  const [canvasWidth, setCanvasWidth] = useState(800)
  const [canvasHeight, setCanvasHeight] = useState(600)
  const [customFonts, setCustomFonts] = useState([])

  const onTemplateLoaded = useCallback(({ width, height }) => {
    setCanvasWidth(width)
    setCanvasHeight(height)
  }, [])

  const onCanvasSizeChange = useCallback((w, h) => {
    const nw = Math.min(8000, Math.max(100, Number(w) || 100))
    const nh = Math.min(8000, Math.max(100, Number(h) || 100))
    setCanvasWidth(nw)
    setCanvasHeight(nh)
  }, [])

  const onCustomFont = useCallback((entry) => {
    setCustomFonts((prev) => [...prev, entry])
  }, [])

  return (
    <EditorProvider>
      <div className="flex h-full min-h-0 flex-col bg-[#f6f7f9]">
        <EditorHeader onHome={onHome} customFonts={customFonts} />
        <div className="flex min-h-0 min-w-0 flex-1">
          <ToolPanel />
          <FabricWorkspace
            width={canvasWidth}
            height={canvasHeight}
            templateSvgUrl={template.url}
            templateSvgRaw={template.raw}
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
