import { createPortal } from 'react-dom'

/**
 * @param {{ visible: boolean }} props
 */
export function ExportLoadingOverlay({ visible }) {
  if (!visible) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="보내는 중"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-xl">
        <div
          className="h-11 w-11 animate-spin rounded-full border-4 border-[#e8eaef] border-t-[#FF6600]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[#1a1d24]">보내는 중입니다...</p>
      </div>
    </div>,
    document.body,
  )
}
