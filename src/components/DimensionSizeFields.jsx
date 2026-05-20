import { useCallback, useState } from 'react'
import { ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react'
import {
  CANVAS_SIZE_MAX_PX,
  CANVAS_SIZE_MIN_PX,
  PX_PER_CM,
  cmInputToPx,
  formatCmFromPx,
} from '../lib/units'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/**
 * 변경한 축만 반영. 비율 잠금 시에만 반대 축을 비율에 맞춤.
 * @param {'width' | 'height'} source
 */
function resolveSizePx(wPx, hPx, aspectLocked, source, prevWPx, prevHPx, min, max) {
  const w = clamp(Math.round(wPx), min, max)
  const h = clamp(Math.round(hPx), min, max)

  if (!aspectLocked || prevWPx <= 0 || prevHPx <= 0) {
    if (source === 'width') return { width: w, height: prevHPx }
    if (source === 'height') return { width: prevWPx, height: h }
    return { width: w, height: h }
  }

  const ratio = prevWPx / prevHPx
  if (source === 'width') {
    return { width: w, height: clamp(Math.round(w / ratio), min, max) }
  }
  return { width: clamp(Math.round(h * ratio), min, max), height: h }
}

/**
 * @param {object} props
 * @param {number} props.width — px (내부)
 * @param {number} props.height — px (내부)
 */
export function DimensionSizeFields({
  width,
  height,
  aspectLocked,
  onAspectLockedChange,
  onChange,
  min = CANVAS_SIZE_MIN_PX,
  max = CANVAS_SIZE_MAX_PX,
  disabled = false,
}) {
  const [editingW, setEditingW] = useState(false)
  const [editingH, setEditingH] = useState(false)
  const [draftW, setDraftW] = useState('')
  const [draftH, setDraftH] = useState('')

  const prevWPx = Math.round(width)
  const prevHPx = Math.round(height)

  const displayW = editingW ? draftW : formatCmFromPx(width)
  const displayH = editingH ? draftH : formatCmFromPx(height)

  const emit = useCallback(
    (nextW, nextH, source) => {
      onChange(nextW, nextH, source)
    },
    [onChange],
  )

  const commitSource = useCallback(
    (source, rawValue) => {
      const parsed =
        source === 'width'
          ? cmInputToPx(rawValue) ?? prevWPx
          : cmInputToPx(rawValue) ?? prevHPx

      const next =
        source === 'width'
          ? resolveSizePx(parsed, prevHPx, aspectLocked, 'width', prevWPx, prevHPx, min, max)
          : resolveSizePx(prevWPx, parsed, aspectLocked, 'height', prevWPx, prevHPx, min, max)

      emit(next.width, next.height, source)
    },
    [aspectLocked, prevWPx, prevHPx, min, max, emit],
  )

  const nudge = useCallback(
    (source, deltaCm) => {
      setEditingW(false)
      setEditingH(false)
      const deltaPx = Math.round(deltaCm * PX_PER_CM)
      if (deltaPx === 0) return

      const next =
        source === 'width'
          ? resolveSizePx(
              prevWPx + deltaPx,
              prevHPx,
              aspectLocked,
              'width',
              prevWPx,
              prevHPx,
              min,
              max,
            )
          : resolveSizePx(
              prevWPx,
              prevHPx + deltaPx,
              aspectLocked,
              'height',
              prevWPx,
              prevHPx,
              min,
              max,
            )

      emit(next.width, next.height, source)
    },
    [aspectLocked, prevWPx, prevHPx, min, max, emit],
  )

  const onWheel = (source) => (e) => {
    if (disabled) return
    e.preventDefault()
    const step = e.shiftKey ? 1 : 0.1
    const delta = e.deltaY < 0 ? step : -step
    nudge(source, delta)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#5c6370]">크기</span>
        <button
          type="button"
          disabled={disabled}
          title={aspectLocked ? '비율 유지 (클릭하여 해제)' : '비율 고정 해제 (클릭하여 잠금)'}
          onClick={() => onAspectLockedChange(!aspectLocked)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm ${
            disabled
              ? 'cursor-not-allowed border-[#e8eaef] text-[#c4c9d4]'
              : aspectLocked
                ? 'border-brand/40 bg-[#fff5ef] text-brand'
                : 'border-[#e8eaef] text-[#5c6370] hover:bg-[#f0f2f6]'
          }`}
          aria-label={aspectLocked ? '비율 유지 잠금' : '비율 유지 해제'}
        >
          {aspectLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DimensionField
          label="W"
          value={displayW}
          disabled={disabled}
          onFocus={() => {
            setDraftW(formatCmFromPx(width))
            setEditingW(true)
          }}
          onChange={setDraftW}
          onBlur={() => {
            commitSource('width', draftW)
            setEditingW(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitSource('width', draftW)
              setEditingW(false)
              e.currentTarget.blur()
            }
          }}
          onWheel={onWheel('width')}
          onNudgeUp={() => nudge('width', 0.1)}
          onNudgeDown={() => nudge('width', -0.1)}
          onNudgeUpShift={() => nudge('width', 1)}
          onNudgeDownShift={() => nudge('width', -1)}
        />
        <DimensionField
          label="H"
          value={displayH}
          disabled={disabled}
          onFocus={() => {
            setDraftH(formatCmFromPx(height))
            setEditingH(true)
          }}
          onChange={setDraftH}
          onBlur={() => {
            commitSource('height', draftH)
            setEditingH(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitSource('height', draftH)
              setEditingH(false)
              e.currentTarget.blur()
            }
          }}
          onWheel={onWheel('height')}
          onNudgeUp={() => nudge('height', 0.1)}
          onNudgeDown={() => nudge('height', -0.1)}
          onNudgeUpShift={() => nudge('height', 1)}
          onNudgeDownShift={() => nudge('height', -1)}
        />
      </div>
    </div>
  )
}

function DimensionField({
  label,
  value,
  disabled,
  onFocus,
  onChange,
  onBlur,
  onKeyDown,
  onWheel,
  onNudgeUp,
  onNudgeDown,
  onNudgeUpShift,
  onNudgeDownShift,
}) {
  return (
    <div className="text-xs text-[#5c6370]">
      <span className="font-medium">{label} (cm)</span>
      <div className="mt-1 flex items-stretch overflow-hidden rounded-xl border border-[#e8eaef] bg-white">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
          className="dim-size-input min-w-0 flex-1 border-0 px-2 py-2 text-sm tabular-nums outline-none disabled:bg-[#f8f9fb] disabled:text-[#c4c9d4]"
        />
        <div className="flex flex-col border-l border-[#e8eaef]">
          <button
            type="button"
            disabled={disabled}
            title="0.1cm 증가 (Shift+클릭: 1cm)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => (e.shiftKey ? onNudgeUpShift : onNudgeUp)()}
            className="flex flex-1 items-center justify-center px-1.5 text-[#5c6370] hover:bg-[#f0f2f6] disabled:opacity-40"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            title="0.1cm 감소 (Shift+클릭: 1cm)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => (e.shiftKey ? onNudgeDownShift : onNudgeDown)()}
            className="flex flex-1 items-center justify-center border-t border-[#e8eaef] px-1.5 text-[#5c6370] hover:bg-[#f0f2f6] disabled:opacity-40"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}