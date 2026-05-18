export const LEAVE_CONFIRM_MESSAGE =
  '작업 중인 내용이 저장되지 않았습니다. 페이지를 벗어나시겠습니까?'

/**
 * @param {boolean} isDirty
 * @returns {boolean} true = leave allowed
 */
export function confirmLeaveIfDirty(isDirty) {
  if (!isDirty) return true
  return window.confirm(LEAVE_CONFIRM_MESSAGE)
}
