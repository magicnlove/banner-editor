import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ChevronDown,
  Download,
  FileImage,
  FileJson,
  FileText,
  FileType,
  Home,
} from 'lucide-react'
import { useEditor } from '../context/EditorContext'
import {
  prepareCanvasForExport,
  resetCanvasToLogicalForExport,
  restoreCanvasAfterExport,
} from '../lib/canvasZoom'
import { buildTemplateExportObject, getLogicalSizeFromCanvas } from '../lib/template'
import { exportFabricToPdf } from '../lib/exportPdf'
import { exportCanvasToDataUrl } from '../lib/exportRaster'
import { exportFabricToSvg } from '../lib/exportSvg'
import logo from '../assets/logo.png'

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function dataUrlToBlob(dataUrl) {
  const [head, data] = dataUrl.split(',')
  const mime = head.match(/data:(.*?);/)?.[1] || 'application/octet-stream'
  const binary = atob(data)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

export function EditorHeader({ onHome, customFonts = [] }) {
  const { canvas } = useEditor()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const runExport = useCallback(
    async (kind) => {
      if (!canvas) return

      const prev = canvas.getActiveObject()
      canvas.discardActiveObject()
      canvas.requestRenderAll()

      const logical = getLogicalSizeFromCanvas(canvas)
      const saved = prepareCanvasForExport(canvas)
      resetCanvasToLogicalForExport(canvas, logical.width, logical.height)

      try {
        if (kind === 'pdf') {
          try {
            const blob = await exportFabricToPdf(canvas, customFonts)
            downloadBlob(blob, 'banner.pdf')
          } catch (err) {
            console.error(err)
            window.alert(
              'PDF를 생성하지 못했습니다. 네트워크·폰트 파일 문제일 수 있으니 콘솔을 확인해 주세요.',
            )
          }
        } else if (kind === 'svg') {
          const inner = await exportFabricToSvg(canvas, customFonts)
          const full = `<?xml version="1.0" encoding="UTF-8"?>\n${inner}`
          downloadBlob(
            new Blob([full], { type: 'image/svg+xml;charset=utf-8' }),
            'banner.svg',
          )
        } else if (kind === 'png') {
          const url = await exportCanvasToDataUrl(canvas, 'png', customFonts)
          downloadBlob(dataUrlToBlob(url), 'banner.png')
        } else if (kind === 'jpg') {
          const url = await exportCanvasToDataUrl(
            canvas,
            'jpeg',
            customFonts,
            0.92,
          )
          downloadBlob(dataUrlToBlob(url), 'banner.jpg')
        } else if (kind === 'json') {
          const obj = buildTemplateExportObject(canvas)
          const blob = new Blob([JSON.stringify(obj, null, 2)], {
            type: 'application/json;charset=utf-8',
          })
          downloadBlob(blob, 'template.json')
        }
      } finally {
        restoreCanvasAfterExport(canvas, saved)
        if (prev) canvas.setActiveObject(prev)
        canvas.requestRenderAll()
        setOpen(false)
      }
    },
    [canvas, customFonts],
  )

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e8eaef] bg-white px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onHome}
          className="rounded-xl p-2 text-[#5c6370] hover:bg-[#f0f2f6]"
          title="템플릿 선택"
        >
          <Home className="h-5 w-5" />
        </button>
        <img src={logo} alt="" className="h-9 w-auto rounded-lg shadow-sm" width={200} height={48} />
        <h1 className="truncate text-base font-semibold tracking-tight text-[#1a1d24]">
          한화투자증권 현수막 생성기
        </h1>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <Download className="h-4 w-4" />
          보내기
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[#e8eaef] bg-white py-1 shadow-lg">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#f8f9fb]"
              onClick={() => void runExport('pdf')}
            >
              <FileText className="h-4 w-4 shrink-0 text-[#64748b]" />
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0">
                <span className="font-medium">PDF</span>
                <span className="text-xs font-normal text-brand">(권장)</span>
              </span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#f8f9fb]"
              onClick={() => void runExport('svg')}
            >
              <FileType className="h-4 w-4 text-[#64748b]" />
              SVG (보조)
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#f8f9fb]"
              onClick={() => void runExport('png')}
            >
              <FileImage className="h-4 w-4 text-[#64748b]" />
              PNG
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#f8f9fb]"
              onClick={() => void runExport('jpg')}
            >
              <FileImage className="h-4 w-4 text-[#64748b]" />
              JPG
            </button>
            <div className="my-1 border-t border-[#f0f1f4]" />
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#f8f9fb]"
              onClick={() => void runExport('json')}
            >
              <FileJson className="h-4 w-4 text-[#64748b]" />
              템플릿 JSON
            </button>
            <p className="px-4 pb-2 text-[10px] leading-snug text-[#8b919c]">
              템플릿 원본은 src/templates/*.svg 입니다.
            </p>
          </div>
        )}
      </div>
    </header>
  )
}
