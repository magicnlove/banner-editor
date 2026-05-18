import { useRef } from 'react'
import {
  Type,
  Square,
  Circle as CircleIcon,
  Triangle as TriangleIcon,
  ImagePlus,
  Minus,
  ArrowUp,
  ArrowDown,
  Upload,
} from 'lucide-react'
import { useEditor } from '../context/EditorContext'
import { isTemplateLayerObject } from '../lib/template'
import {
  addTextToCanvas,
  addRectToCanvas,
  addCircleToCanvas,
  addTriangleToCanvas,
  addLineToCanvas,
  addImageFromFile,
} from '../lib/fabricTools'

function ToolBtn({ children, label, onClick }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#1a1d24] transition hover:bg-[#f0f2f6]"
    >
      {children}
    </button>
  )
}

export function ToolPanel() {
  const { canvas, bump } = useEditor()
  const imgInput = useRef(null)

  const run = (fn) => {
    if (!canvas) return
    const result = fn(canvas)
    if (result && typeof result.then === 'function') {
      result.then(() => bump()).catch(() => bump())
    } else {
      bump()
    }
  }

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#e8eaef] bg-white">
      <div className="border-b border-[#f0f1f4] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8b919c]">요소</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        <ToolBtn label="텍스트" onClick={() => run(addTextToCanvas)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff4ec] text-brand">
            <Type className="h-4 w-4" />
          </span>
          텍스트
        </ToolBtn>
        <ToolBtn label="사각형" onClick={() => run(addRectToCanvas)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef6ff] text-[#3b82f6]">
            <Square className="h-4 w-4" />
          </span>
          사각형
        </ToolBtn>
        <ToolBtn label="원" onClick={() => run(addCircleToCanvas)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3e8ff] text-[#9333ea]">
            <CircleIcon className="h-4 w-4" />
          </span>
          원
        </ToolBtn>
        <ToolBtn label="삼각형" onClick={() => run(addTriangleToCanvas)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#059669]">
            <TriangleIcon className="h-4 w-4" />
          </span>
          삼각형
        </ToolBtn>
        <ToolBtn label="선" onClick={() => run(addLineToCanvas)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#475569]">
            <Minus className="h-4 w-4" />
          </span>
          선
        </ToolBtn>
        <ToolBtn
          label="이미지"
          onClick={() => {
            imgInput.current?.click()
          }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fdf4ff] text-[#c026d3]">
            <ImagePlus className="h-4 w-4" />
          </span>
          이미지
        </ToolBtn>
      </nav>

      <input
        ref={imgInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file || !canvas) return
          addImageFromFile(canvas, file).then(() => bump())
          e.target.value = ''
        }}
      />

      <LayerPanel />

      <div className="mt-auto border-t border-[#f0f1f4] p-3 text-center text-xs leading-relaxed text-[#8b919c]">
        이미지 파일을 캔버스로 끌어다 놓을 수 있습니다.
      </div>
    </aside>
  )
}

export function LayerPanel() {
  const { canvas, revision, bump } = useEditor()
  const objects = canvas
    ? canvas.getObjects().filter((o) => !isTemplateLayerObject(o))
    : []
  const ordered = [...objects].reverse()

  const selectObj = (o) => {
    if (!canvas) return
    canvas.setActiveObject(o)
    canvas.requestRenderAll()
    bump()
  }

  const move = (dir) => {
    if (!canvas) return
    const a = canvas.getActiveObject()
    if (!a) return
    if (dir === 'up') canvas.bringObjectForward(a)
    else canvas.sendObjectBackwards(a)
    canvas.requestRenderAll()
    bump()
  }

  return (
    <div className="border-t border-[#f0f1f4] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8b919c]">레이어</p>
        <div className="flex gap-1">
          <button
            type="button"
            title="앞으로"
            onClick={() => move('up')}
            className="rounded-lg p-1.5 text-[#5c6370] hover:bg-[#f0f2f6]"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="뒤로"
            onClick={() => move('down')}
            className="rounded-lg p-1.5 text-[#5c6370] hover:bg-[#f0f2f6]"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ul className="max-h-40 space-y-1 overflow-auto text-sm" key={revision}>
        {ordered.length === 0 && (
          <li className="rounded-lg bg-[#f8f9fb] px-2 py-2 text-center text-xs text-[#8b919c]">
            요소가 없습니다
          </li>
        )}
        {ordered.map((o, i) => {
          const active = canvas?.getActiveObject() === o
          const isText = o.isType?.('Text', 'IText', 'FabricText', 'i-text')
          const isImg = o.isType?.('Image')
          const isLine = o.isType?.('Line')
          const rawText = isText ? o.text : ''
          const label = isText
            ? (rawText?.slice(0, 18) || '텍스트') + (rawText && rawText.length > 18 ? '…' : '')
            : isImg
              ? '이미지'
              : isLine
                ? '선'
                : o.type || '개체'
          return (
            <li key={`${o.type}-${i}-${revision}`}>
              <button
                type="button"
                onClick={() => selectObj(o)}
                className={`w-full truncate rounded-lg px-2 py-1.5 text-left transition ${
                  active ? 'bg-[#fff4ec] font-medium text-brand' : 'hover:bg-[#f0f2f6]'
                }`}
              >
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function FontUploadRow({ onFontLoaded }) {
  const inputRef = useRef(null)
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d5dae3] py-2.5 text-xs font-medium text-[#5c6370] transition hover:border-brand hover:bg-[#fff9f5] hover:text-brand"
      >
        <Upload className="h-3.5 w-3.5" />
        폰트 파일 (.ttf / .otf)
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf,font/ttf,font/otf"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          if (!/\.(ttf|otf)$/i.test(file.name)) {
            window.alert('TTF 또는 OTF 파일만 업로드할 수 있습니다.')
            e.target.value = ''
            return
          }
          const fileData = await file.arrayBuffer()
          const blob = new Blob([fileData])
          const url = URL.createObjectURL(blob)
          const base = file.name.replace(/\.(ttf|otf)$/i, '')
          const family = `${base.replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 7)}`
          try {
            const face = new FontFace(family, `url(${url})`)
            await face.load()
            document.fonts.add(face)
            onFontLoaded({ family, label: base, fileData: fileData.slice(0) })
          } catch {
            window.alert('폰트를 불러오지 못했습니다.')
          } finally {
            URL.revokeObjectURL(url)
            e.target.value = ''
          }
        }}
      />
    </div>
  )
}
