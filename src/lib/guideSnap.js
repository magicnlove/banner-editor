/** @typedef {{ id: string; orientation: 'horizontal' | 'vertical'; position: number }} WorkspaceGuide */

export const GUIDE_SNAP_THRESHOLD_PX = 8

/**
 * @param {number} value
 * @param {number[]} targets
 * @param {number} threshold
 */
export function snapToTargets(value, targets, threshold) {
  let best = value
  let bestDist = threshold + 1
  for (const t of targets) {
    const d = Math.abs(value - t)
    if (d <= threshold && d < bestDist) {
      bestDist = d
      best = t
    }
  }
  return bestDist <= threshold ? best : value
}

/**
 * @param {import('fabric').FabricObject} obj
 * @param {WorkspaceGuide[]} guides
 * @param {number} thresholdLogical
 */
export function snapObjectToGuides(obj, guides, thresholdLogical) {
  if (!guides.length || thresholdLogical <= 0) return false

  obj.setCoords()
  const br = obj.getBoundingRect(true, true)
  const hGuides = guides
    .filter((g) => g.orientation === 'horizontal')
    .map((g) => g.position)
  const vGuides = guides
    .filter((g) => g.orientation === 'vertical')
    .map((g) => g.position)

  if (!hGuides.length && !vGuides.length) return false

  const left = br.left
  const top = br.top
  const right = br.left + br.width
  const bottom = br.top + br.height
  const cx = br.left + br.width / 2
  const cy = br.top + br.height / 2

  const xRefs = vGuides.length
    ? [left, cx, right].map((x) => snapToTargets(x, vGuides, thresholdLogical))
    : [left, cx, right]
  const yRefs = hGuides.length
    ? [top, cy, bottom].map((y) => snapToTargets(y, hGuides, thresholdLogical))
    : [top, cy, bottom]

  let newLeft = left
  let newTop = top

  if (vGuides.length) {
    const snaps = [
      { delta: xRefs[0] - left, dist: Math.abs(xRefs[0] - left) },
      { delta: xRefs[1] - cx, dist: Math.abs(xRefs[1] - cx) },
      { delta: xRefs[2] - right, dist: Math.abs(xRefs[2] - right) },
    ].filter((s) => s.dist <= thresholdLogical)
    if (snaps.length) {
      snaps.sort((a, b) => a.dist - b.dist)
      newLeft = left + snaps[0].delta
    }
  }

  if (hGuides.length) {
    const snaps = [
      { delta: yRefs[0] - top, dist: Math.abs(yRefs[0] - top) },
      { delta: yRefs[1] - cy, dist: Math.abs(yRefs[1] - cy) },
      { delta: yRefs[2] - bottom, dist: Math.abs(yRefs[2] - bottom) },
    ].filter((s) => s.dist <= thresholdLogical)
    if (snaps.length) {
      snaps.sort((a, b) => a.dist - b.dist)
      newTop = top + snaps[0].delta
    }
  }

  const moved =
    Math.abs(newLeft - left) > 0.01 || Math.abs(newTop - top) > 0.01
  if (moved) {
    obj.set({
      left: (obj.left ?? 0) + (newLeft - left),
      top: (obj.top ?? 0) + (newTop - top),
    })
    obj.setCoords()
  }
  return moved
}
