import { useEffect } from 'react'
import { useEditor } from '../context/EditorContext'

/** EditorProvider 내부에서 isDirty를 App으로 전달 */
export function EditorDirtyBridge({ onDirtyChange }) {
  const { isDirty } = useEditor()

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  return null
}
