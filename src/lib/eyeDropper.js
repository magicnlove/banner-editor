/** EyeDropper API — Chromium 기반 브라우저에서 주로 지원 */
export function isEyeDropperSupported() {
  return typeof window !== 'undefined' && 'EyeDropper' in window
}
