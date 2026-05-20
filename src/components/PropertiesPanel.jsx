import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Pipette,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from 'lucide-react'
import { useEditor } from '../context/EditorContext'
import { FontUploadRow } from './ToolPanel'
import { DimensionSizeFields } from './DimensionSizeFields'
import { isEyeDropperSupported } from '../lib/eyeDropper'
import { isTemplateLayerObject } from '../lib/template'
import { loadCanvasTextFontsAndRender } from '../lib/appFonts'
import { applyTextToFabricObject } from '../lib/fabricTextSync'
import { setObjectScaledSizeCentered } from '../lib/fabricPlacement'
import { getLineLengthPx, setLineLengthPx } from '../lib/fabricTools'
import {
  CANVAS_SIZE_MAX_PX,
  CANVAS_SIZE_MIN_PX,
  cmInputToPx,
  cmInputToPxFloat,
  cmToPx,
  formatCmFromPx,
} from '../lib/units'
import { BUNDLED_FONT_FAMILY_NAMES } from '../lib/bundledFonts'

const PRESETS = [
  '#FF6600',
  '#1a1d24',
  '#ffffff',
  '#f8f9fb',
  '#64748b',
  '#0ea5e9',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#ec4899',
]

const BASE_FONTS = [
  'Noto Sans KR',
  ...BUNDLED_FONT_FAMILY_NAMES,
  'Nanum Gothic',
  'Malgun Gothic',
  'Apple SD Gothic Neo',
  'Arial',
  'Georgia',
]

const EYEDROPPER_UNSUPPORTED_TITLE = 'Chrome/Edge에서만 지원됩니다'
const CANVAS_SIZE_MIN = CANVAS_SIZE_MIN_PX
const CANVAS_SIZE_MAX = CANVAS_SIZE_MAX_PX
const OBJECT_SIZE_MIN = Math.round(cmToPx(0.1))
const OBJECT_SIZE_MAX = CANVAS_SIZE_MAX_PX
const LINE_LENGTH_MIN = Math.round(cmToPx(0.5))
const LINE_LENGTH_MAX = CANVAS_SIZE_MAX_PX
const LINE_STROKE_MIN_CM = 0.01
const LINE_STROKE_MIN_PX = cmToPx(LINE_STROKE_MIN_CM)
const LINE_STROKE_MAX_PX = cmToPx(5)

function clampLineLen(px) {
  return Math.min(LINE_LENGTH_MAX, Math.max(LINE_LENGTH_MIN, px))
}

function clampLineStroke(px) {
  return Math.min(LINE_STROKE_MAX_PX, Math.max(LINE_STROKE_MIN_PX, px))
}

function fabricObjectKey(obj) {
  if (!obj) return 'none'
  return String(obj.uid ?? obj.__uid ?? obj.id ?? `${obj.type}-${obj.left}-${obj.top}`)
}

/** uncontrolled textarea — 조합 중 React state 갱신 없음 (IME 필수) */
function TextContentField({ fabricObject, canvas, text, onApplied }) {
  const inputRef = useRef(null)
  const composingRef = useRef(false)

  useEffect(() => {
    if (!canvas || !fabricObject) return

    const onTextChanged = (e) => {
      if (e.target !== fabricObject || composingRef.current) return
      const el = inputRef.current
      if (el) el.value = e.target.text ?? ''
    }

    canvas.on('text:changed', onTextChanged)
    return () => {
      canvas.off('text:changed', onTextChanged)
    }
  }, [canvas, fabricObject])

  const commit = (value) => {
    applyTextToFabricObject(fabricObject, value, canvas)
    void loadCanvasTextFontsAndRender(canvas)
    onApplied?.()
  }

  return (
    <textarea
      ref={inputRef}
      defaultValue={text ?? ''}
      rows={3}
      lang="ko"
      className="mt-1 w-full resize-y rounded-xl border border-[#e8eaef] px-2 py-2 text-sm"
      onFocus={() => {
        if (fabricObject?.isEditing) fabricObject.exitEditing()
      }}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false
        commit(e.currentTarget.value)
      }}
      onInput={(e) => {
        if (composingRef.current) return
        commit(e.target.value)
      }}
    />
  )
}

async function eyePick() {
  try {
    const ed = new window.EyeDropper()
    const { sRGBHex } = await ed.open()
    return sRGBHex
  } catch {
    return null
  }
}

function ColorRow({ label, value, onChange, onEye, eyeDropperSupported }) {
  const pipetteDisabled = !eyeDropperSupported
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#5c6370]">{label}</span>
        <button
          type="button"
          disabled={pipetteDisabled}
          title={pipetteDisabled ? EYEDROPPER_UNSUPPORTED_TITLE : '스포이드'}
          onClick={() => {
            if (!pipetteDisabled) onEye?.()
          }}
          className={`rounded-lg p-1.5 text-[#5c6370] ${
            pipetteDisabled
              ? 'cursor-not-allowed opacity-40'
              : 'hover:bg-[#f0f2f6] hover:text-brand'
          }`}
        >
          <Pipette className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className="h-7 w-7 rounded-lg border border-[#e8eaef] shadow-inner"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <input
        type="color"
        value={normalizeHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer rounded-xl border border-[#e8eaef] bg-white"
      />
    </div>
  )
}

function normalizeHex(c) {
  if (!c || typeof c !== 'string') return '#000000'
  if (c.startsWith('#')) return c.length >= 7 ? c.slice(0, 7) : '#000000'
  return '#000000'
}

/** @param {import('fabric').FabricObject} obj */
function getObjectScaledSize(obj) {
  return {
    width: Math.max(1, Math.round(obj.getScaledWidth())),
    height: Math.max(1, Math.round(obj.getScaledHeight())),
  }
}

function ToggleIconBtn({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition ${
        active
          ? 'border-brand/40 bg-[#fff5ef] text-brand'
          : 'border-[#e8eaef] text-[#5c6370] hover:bg-[#f0f2f6]'
      }`}
    >
      {children}
    </button>
  )
}

function TextFormattingControls({ selected, applyToSelection }) {
  const isBold = selected.fontWeight === 'bold' || selected.fontWeight === 700
  const isItalic = selected.fontStyle === 'italic'
  const isUnderline = Boolean(selected.underline)

  return (
    <div className="space-y-3">
      <div>
        <span className="text-xs font-medium text-[#5c6370]">정렬</span>
        <div className="mt-1.5 flex gap-1">
          {[
            { align: 'left', Icon: AlignLeft, title: '왼쪽 정렬' },
            { align: 'center', Icon: AlignCenter, title: '가운데 정렬' },
            { align: 'right', Icon: AlignRight, title: '오른쪽 정렬' },
          ].map(({ align, Icon, title }) => (
            <ToggleIconBtn
              key={align}
              title={title}
              active={(selected.textAlign || 'left') === align}
              onClick={() => applyToSelection({ textAlign: align })}
            >
              <Icon className="h-4 w-4" />
            </ToggleIconBtn>
          ))}
        </div>
      </div>
      <div>
        <span className="text-xs font-medium text-[#5c6370]">스타일</span>
        <div className="mt-1.5 flex gap-1">
          <ToggleIconBtn
            title="굵게"
            active={isBold}
            onClick={() =>
              applyToSelection({ fontWeight: isBold ? 'normal' : 'bold' })
            }
          >
            <Bold className="h-4 w-4" />
          </ToggleIconBtn>
          <ToggleIconBtn
            title="기울임"
            active={isItalic}
            onClick={() =>
              applyToSelection({ fontStyle: isItalic ? 'normal' : 'italic' })
            }
          >
            <Italic className="h-4 w-4" />
          </ToggleIconBtn>
          <ToggleIconBtn
            title="밑줄"
            active={isUnderline}
            onClick={() => applyToSelection({ underline: !isUnderline })}
          >
            <Underline className="h-4 w-4" />
          </ToggleIconBtn>
        </div>
      </div>
      <label className="block text-xs text-[#5c6370]">
        줄간격
        <input
          type="number"
          min={0.5}
          max={5}
          step={0.05}
          value={selected.lineHeight ?? 1.16}
          onChange={(e) =>
            applyToSelection({ lineHeight: Number(e.target.value) || 1.16 })
          }
          className="mt-1 w-full rounded-xl border border-[#e8eaef] px-2 py-2 text-sm"
        />
      </label>
      <label className="block text-xs text-[#5c6370]">
        글자간격 (cm)
        <input
          type="number"
          min={-1}
          max={5}
          step={0.1}
          value={formatCmFromPx(selected.charSpacing ?? 0)}
          onChange={(e) => {
            const px = cmInputToPx(e.target.value)
            if (px != null) applyToSelection({ charSpacing: px })
          }}
          className="mt-1 w-full rounded-xl border border-[#e8eaef] px-2 py-2 text-sm"
        />
      </label>
      <label className="block text-xs text-[#5c6370]">
        글자 크기 (cm)
        <input
          type="number"
          min={0.2}
          max={50}
          step={0.1}
          value={formatCmFromPx(selected.fontSize || 40)}
          onChange={(e) => {
            const px = cmInputToPx(e.target.value)
            if (px != null) applyToSelection({ fontSize: Math.max(1, px) })
          }}
          className="mt-1 w-full rounded-xl border border-[#e8eaef] px-2 py-2 text-sm"
        />
      </label>
    </div>
  )
}

export function PropertiesPanel({
  canvasWidth,
  canvasHeight,
  onCanvasSizeChange,
  customFonts,
  onCustomFont,
}) {
  const { canvas, selected, revision, setSelected, bump } = useEditor()
  const eyeOk = isEyeDropperSupported()

  const [canvasAspectLocked, setCanvasAspectLocked] = useState(false)
  const [objectAspectLocked, setObjectAspectLocked] = useState(false)

  const isTemplateLayer = isTemplateLayerObject(selected)
  const isText = selected?.isType?.('Text', 'IText', 'FabricText', 'i-text')
  const isLine = selected?.isType?.('Line')
  const isShape =
    selected && !isText && !isLine && !selected?.isType?.('Image')

  const objectSize =
    selected && !isTemplateLayer
      ? getObjectScaledSize(selected)
      : { width: 0, height: 0 }

  const applyToSelection = (patch) => {
    if (!selected || !canvas || isTemplateLayer) return
    if ('text' in patch) {
      applyTextToFabricObject(selected, patch.text, canvas)
      void loadCanvasTextFontsAndRender(canvas)
      bump()
      return
    }
    selected.set(patch)
    selected.setCoords?.()
    if (isText) {
      void loadCanvasTextFontsAndRender(canvas)
    } else {
      canvas.requestRenderAll()
    }
    bump()
  }

  const applyObjectSize = useCallback(
    (newW, newH) => {
      if (!selected || !canvas || isTemplateLayer) return
      setObjectScaledSizeCentered(selected, newW, newH)
      canvas.requestRenderAll()
      bump()
    },
    [selected, canvas, isTemplateLayer, bump],
  )

  const handleCanvasSize = useCallback(
    (w, h) => {
      const nw = Math.min(CANVAS_SIZE_MAX, Math.max(CANVAS_SIZE_MIN, w))
      const nh = Math.min(CANVAS_SIZE_MAX, Math.max(CANVAS_SIZE_MIN, h))
      onCanvasSizeChange(nw, nh)
    },
    [onCanvasSizeChange],
  )

  const deleteSelection = () => {
    if (!selected || !canvas || isTemplateLayer) return
    canvas.remove(selected)
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    setSelected(null)
    bump()
  }

  const setCanvasBg = (hex) => {
    if (!canvas) return
    // eslint-disable-next-line react-hooks/immutability -- Fabric.js API
    canvas.backgroundColor = hex
    canvas.requestRenderAll()
    bump()
  }

  const bg =
    canvas?.backgroundColor && typeof canvas.backgroundColor === 'string'
      ? canvas.backgroundColor
      : '#ffffff'

  const fontChoices = [...BASE_FONTS, ...customFonts.map((f) => f.family)]

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#e8eaef] bg-white">
      <div className="border-b border-[#f0f1f4] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8b919c]">속성</p>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-4">
        {!selected && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#1a1d24]">캔버스</h3>
            <DimensionSizeFields
              width={canvasWidth}
              height={canvasHeight}
              aspectLocked={canvasAspectLocked}
              onAspectLockedChange={setCanvasAspectLocked}
              onChange={(w, h) => handleCanvasSize(w, h)}
              min={CANVAS_SIZE_MIN}
              max={CANVAS_SIZE_MAX}
            />
            <ColorRow
              label="배경색"
              value={bg}
              onChange={setCanvasBg}
              eyeDropperSupported={eyeOk}
              onEye={async () => {
                const hex = await eyePick()
                if (hex) setCanvasBg(hex)
              }}
            />
          </section>
        )}

        {selected && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1a1d24]">선택 개체</h3>
              {!isTemplateLayer && (
                <button
                  type="button"
                  onClick={deleteSelection}
                  className="flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </button>
              )}
            </div>

            {isTemplateLayer ? (
              <p className="text-xs text-[#8b919c]">
                템플릿 레이어는 크기를 변경할 수 없습니다.
              </p>
            ) : isLine ? (
              <>
                <label className="block text-xs text-[#5c6370]">
                  길이 (cm)
                  <input
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={formatCmFromPx(getLineLengthPx(selected))}
                    onChange={(e) => {
                      const px = cmInputToPx(e.target.value)
                      if (px == null || !canvas) return
                      setLineLengthPx(selected, clampLineLen(px))
                      canvas.requestRenderAll()
                      bump()
                    }}
                    className="mt-1 w-full rounded-xl border border-[#e8eaef] px-2 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-[#5c6370]">
                  두께 (cm)
                  <input
                    type="number"
                    min={LINE_STROKE_MIN_CM}
                    max={5}
                    step={0.01}
                    value={formatCmFromPx(selected.strokeWidth ?? 2, 2)}
                    onChange={(e) => {
                      const px = cmInputToPxFloat(e.target.value)
                      if (px != null) applyToSelection({ strokeWidth: clampLineStroke(px) })
                    }}
                    className="mt-1 w-full rounded-xl border border-[#e8eaef] px-2 py-2 text-sm"
                  />
                </label>
                <ColorRow
                  label="선 색"
                  value={String(selected.stroke || '#1a1d24')}
                  onChange={(hex) => applyToSelection({ stroke: hex })}
                  eyeDropperSupported={eyeOk}
                  onEye={async () => {
                    const hex = await eyePick()
                    if (hex) applyToSelection({ stroke: hex })
                  }}
                />
              </>
            ) : (
              <DimensionSizeFields
                key={selected.uid ?? selected.id ?? revision}
                width={objectSize.width}
                height={objectSize.height}
                aspectLocked={objectAspectLocked}
                onAspectLockedChange={setObjectAspectLocked}
                onChange={(w, h) => applyObjectSize(w, h)}
                min={OBJECT_SIZE_MIN}
                max={OBJECT_SIZE_MAX}
              />
            )}

            <label className="block text-xs text-[#5c6370]">
              불투명도
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={selected.opacity ?? 1}
                onChange={(e) => applyToSelection({ opacity: Number(e.target.value) })}
                disabled={isTemplateLayer}
                className="mt-1 w-full accent-brand disabled:opacity-50"
              />
            </label>

            {isText && !isTemplateLayer && (
              <>
                <label className="block text-xs text-[#5c6370]">
                  텍스트 내용
                  <TextContentField
                    key={fabricObjectKey(selected)}
                    fabricObject={selected}
                    canvas={canvas}
                    text={selected.text ?? ''}
                    onApplied={bump}
                  />
                </label>
                <label className="block text-xs text-[#5c6370]">
                  글꼴
                  <select
                    value={selected.fontFamily || 'Noto Sans KR'}
                    onChange={(e) => applyToSelection({ fontFamily: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e8eaef] px-2 py-2 text-sm"
                  >
                    {fontChoices.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>
                        {customFonts.find((c) => c.family === f)?.label || f}
                      </option>
                    ))}
                  </select>
                </label>
                <FontUploadRow onFontLoaded={onCustomFont} />
                <p
                  className="flex gap-1.5 text-[11px] leading-snug text-[#999]"
                  role="note"
                >
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden
                  />
                  <span>
                    업로드한 폰트의 저작권은 사용자에게 있습니다.
                    <br />
                    상업적 사용 시 라이선스를 확인하세요.
                  </span>
                </p>
                <TextFormattingControls
                  selected={selected}
                  applyToSelection={applyToSelection}
                />
                <ColorRow
                  label="글자색"
                  value={String(selected.fill || '#111111')}
                  onChange={(hex) => applyToSelection({ fill: hex })}
                  eyeDropperSupported={eyeOk}
                  onEye={async () => {
                    const hex = await eyePick()
                    if (hex) applyToSelection({ fill: hex })
                  }}
                />
              </>
            )}

            {isShape && !isTemplateLayer && (
              <>
                <ColorRow
                  label="채우기 색"
                  value={String(selected.fill || '#cccccc')}
                  onChange={(hex) => applyToSelection({ fill: hex })}
                  eyeDropperSupported={eyeOk}
                  onEye={async () => {
                    const hex = await eyePick()
                    if (hex) applyToSelection({ fill: hex })
                  }}
                />
                <ColorRow
                  label="선 색"
                  value={String(selected.stroke || '#000000')}
                  onChange={(hex) => applyToSelection({ stroke: hex })}
                  eyeDropperSupported={eyeOk}
                  onEye={async () => {
                    const hex = await eyePick()
                    if (hex) applyToSelection({ stroke: hex })
                  }}
                />
                <label className="block text-xs text-[#5c6370]">
                  선 두께
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={selected.strokeWidth ?? 0}
                    onChange={(e) => applyToSelection({ strokeWidth: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-[#e8eaef] px-2 py-2 text-sm"
                  />
                </label>
              </>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}
