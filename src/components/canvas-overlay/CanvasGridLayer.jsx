/**
 * @param {{ spacingPx: number; width: number; height: number }} props
 */
export function CanvasGridLayer({ spacingPx, width, height }) {
  const s = Math.max(4, spacingPx)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/></svg>`

  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-10"
      style={{
        width,
        height,
        backgroundImage: url,
        backgroundSize: `${s}px ${s}px`,
      }}
      aria-hidden
    />
  )
}
