import { Grid3x3, Ruler, Scaling } from 'lucide-react'
import { useWorkspaceOverlay } from '../context/WorkspaceOverlayContext'

const BRAND = '#FF6600'

/**
 * @param {{
 *   active: boolean;
 *   onClick: () => void;
 *   title: string;
 *   children: import('react').ReactNode;
 * }} props
 */
function ToggleChip({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-[#FF6600] bg-[#FFF3EB] text-[#FF6600]'
          : 'border-[#e8eaef] bg-white text-[#5c6370] hover:bg-[#f8f9fb]'
      }`}
      style={active ? { borderColor: BRAND, color: BRAND } : undefined}
    >
      {children}
    </button>
  )
}

export function EditorCanvasToolbar() {
  const {
    rulersVisible,
    setRulersVisible,
    gridVisible,
    setGridVisible,
    guidesVisible,
    setGuidesVisible,
    gridSpacingPx,
    setGridSpacingPx,
    rulerUnit,
    setRulerUnit,
    clearGuides,
  } = useWorkspaceOverlay()

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e8eaef] bg-white px-4 py-2">
      <ToggleChip
        active={rulersVisible}
        onClick={() => setRulersVisible((v) => !v)}
        title="눈금자 표시/숨김"
      >
        <Ruler className="h-3.5 w-3.5" />
        눈금자
      </ToggleChip>

      <ToggleChip
        active={gridVisible}
        onClick={() => setGridVisible((v) => !v)}
        title="눈금선(격자) 표시/숨김"
      >
        <Grid3x3 className="h-3.5 w-3.5" />
        눈금선
      </ToggleChip>

      {gridVisible && (
        <label className="inline-flex items-center gap-1.5 text-xs text-[#5c6370]">
          간격
          <input
            type="number"
            min={5}
            max={500}
            step={5}
            value={gridSpacingPx}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n) && n >= 5) setGridSpacingPx(Math.min(500, n))
            }}
            className="w-16 rounded-lg border border-[#e8eaef] px-2 py-1 text-sm"
          />
          <span>px</span>
        </label>
      )}

      <ToggleChip
        active={guidesVisible}
        onClick={() => setGuidesVisible((v) => !v)}
        title="안내선 표시·스냅"
      >
        <Scaling className="h-3.5 w-3.5" />
        안내선
      </ToggleChip>

      <p className="w-full text-[11px] leading-snug text-[#8b919c] sm:w-auto">
        안내선 만들기: 툴바에서 <strong className="text-[#FF6600]">눈금자</strong>·
        <strong className="text-[#FF6600]">안내선</strong> 켠 뒤, 회색 눈금 띠를{' '}
        <strong>누른 채 캔버스(흰 영역)로 드래그</strong>하세요. 가로 눈금자 → 세로선,
        세로 눈금자 → 가로선.
      </p>

      {guidesVisible && (
        <button
          type="button"
          onClick={clearGuides}
          className="text-xs text-[#5c6370] underline-offset-2 hover:text-[#FF6600] hover:underline"
        >
          안내선 모두 삭제
        </button>
      )}

      <span className="mx-1 h-4 w-px bg-[#e8eaef]" aria-hidden />

      <div className="inline-flex rounded-full border border-[#e8eaef] p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setRulerUnit('px')}
          className={`rounded-full px-2.5 py-1 font-medium ${
            rulerUnit === 'px'
              ? 'bg-[#FF6600] text-white'
              : 'text-[#5c6370] hover:bg-[#f8f9fb]'
          }`}
        >
          px
        </button>
        <button
          type="button"
          onClick={() => setRulerUnit('cm')}
          className={`rounded-full px-2.5 py-1 font-medium ${
            rulerUnit === 'cm'
              ? 'bg-[#FF6600] text-white'
              : 'text-[#5c6370] hover:bg-[#f8f9fb]'
          }`}
        >
          cm
        </button>
      </div>
    </div>
  )
}
