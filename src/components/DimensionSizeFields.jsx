import { useCallback, useState } from 'react'
import { ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/**
 * @param {number} w
 * @param {number} h
 * @param {boolean} aspectLocked
 * @param {'width' | 'height'} source
 * @param {number} prevW
 * @param {number} prevH
 */
function applyAspect(w, h, aspectLocked, source, prevW, prevH) {
  if (!aspectLocked || prevW <= 0 || prevH <= 0) {
    return { width: w, height: h }
  }
  const ratio = prevW / prevH
  if (source === 'width') {
    return { width: w, height: Math.max(1, Math.round(w / ratio)) }
  }
  return { width: Math.max(1, Math.round(h * ratio)), height: h }
}

/**
 * @param {object} props
 * @param {number} props.width
 * @param {number} props.height
 * @param {boolean} props.aspectLocked
 * @param {(locked: boolean) => void} props.onAspectLockedChange
 * @param {(width: number, height: number, source: 'width' | 'height') => void} props.onChange
 * @param {number} [props.min]
 * @param {number} [props.max]
 * @param {boolean} [props.disabled]
 */
export function DimensionSizeFields({
  width,
  height,
  aspectLocked,
  onAspectLockedChange,
  onChange,
  min = 1,
  max = 8000,
  disabled = false,
}) {
  const [editingW, setEditingW] = useState(false)
  const [editingH, setEditingH] = useState(false)
  const [draftW, setDraftW] = useState('')
  const [draftH, setDraftH] = useState('')

  const displayW = editingW ? draftW : String(Math.round(width))
  const displayH = editingH ? draftH : String(Math.round(height))

  const commit = useCallback(
    (rawW, rawH, source) => {
      const prevW = Math.round(width)
      const prevH = Math.round(height)
      const w = clamp(Math.round(Number(rawW)) || min, min, max)
      const h = clamp(Math.round(Number(rawH)) || min, min, max)
      const next = applyAspect(w, h, aspectLocked, source, prevW, prevH)
      onChange(next.width, next.height, source)
    },
    [aspectLocked, width, height, min, max, onChange],
  )

  const nudge = useCallback(
    (dim, delta) => {
      setEditingW(false)
      setEditingH(false)
      const curW = Math.round(width)
      const curH = Math.round(height)
      if (dim === 'width') {
        commit(curW + delta, curH, 'width')
      } else {
        commit(curW, curH + delta, 'height')
      }
    },
    [width, height, commit],
  )

  const onWheel = (dim) => (e) => {
    if (disabled) return
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    const delta = e.deltaY < 0 ? step : -step
    nudge(dim, delta)
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
            setDraftW(String(Math.round(width)))
            setEditingW(true)
          }}
          onChange={setDraftW}
          onBlur={() => {
            commit(draftW, displayH, 'width')
            setEditingW(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(draftW, displayH, 'width')
              setEditingW(false)
              e.currentTarget.blur()
            }
          }}
          onWheel={onWheel('width')}
          onNudge={(d) => nudge('width', d)}
        />
        <DimensionField
          label="H"
          value={displayH}
          disabled={disabled}
          onFocus={() => {
            setDraftH(String(Math.round(height)))
            setEditingH(true)
          }}
          onChange={setDraftH}
          onBlur={() => {
            commit(displayW, draftH, 'height')
            setEditingH(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(displayW, draftH, 'height')
              setEditingH(false)
              e.currentTarget.blur()
            }
          }}
          onWheel={onWheel('height')}
          onNudge={(d) => nudge('height', d)}
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
  onNudge,
}) {
  return (
    <label className="text-xs text-[#5c6370]">
      {label} (px)
      <div className="mt-1 flex items-stretch overflow-hidden rounded-xl border border-[#e8eaef] bg-white">
        <input
          type="number"
          min={1}
          disabled={disabled}
          value={value}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
          className="min-w-0 flex-1 border-0 px-2 py-2 text-sm tabular-nums outline-none disabled:bg-[#f8f9fb] disabled:text-[#c4c9d4]"
        />
        <div className="flex flex-col border-l border-[#e8eaef]">
          <button
            type="button"
            disabled={disabled}
            title="1px 증가 (Shift: 10px)"
            onClick={(e) => onNudge(e.shiftKey ? 10 : 1)}
            className="flex flex-1 items-center justify-center px-1.5 text-[#5c6370] hover:bg-[#f0f2f6] disabled:opacity-40"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            title="1px 감소 (Shift: 10px)"
            onClick={(e) => onNudge(e.shiftKey ? -10 : -1)}
            className="flex flex-1 items-center justify-center border-t border-[#e8eaef] px-1.5 text-[#5c6370] hover:bg-[#f0f2f6] disabled:opacity-40"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </label>
  )
}
