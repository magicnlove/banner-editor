export function CanvasZoomBar({
  percent,
  onZoomOut,
  onZoomIn,
  onFit,
}) {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[#d8dce6] bg-white/95 px-2 py-1.5 text-sm shadow-md backdrop-blur-sm">
      <button
        type="button"
        onClick={onZoomOut}
        className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-[#1a1d24] hover:bg-[#f0f2f6]"
        title="축소"
        aria-label="축소"
      >
        −
      </button>
      <span className="min-w-[3.25rem] select-none text-center tabular-nums font-medium text-[#1a1d24]">
        {percent}%
      </span>
      <button
        type="button"
        onClick={onZoomIn}
        className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-[#1a1d24] hover:bg-[#f0f2f6]"
        title="확대"
        aria-label="확대"
      >
        +
      </button>
      <button
        type="button"
        onClick={onFit}
        className="ml-1 rounded-full border border-[#e8eaef] bg-[#f8f9fb] px-3 py-1.5 text-xs font-semibold text-[#1a1d24] hover:border-brand hover:bg-white hover:text-brand"
      >
        화면에 맞추기
      </button>
    </div>
  )
}
