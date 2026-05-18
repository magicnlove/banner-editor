import { useState, useCallback, useEffect } from 'react'
import { TemplatePicker } from './components/TemplatePicker'
import { EditorLayout } from './components/EditorLayout'
import { LEAVE_CONFIRM_MESSAGE } from './lib/leaveGuard'

export default function App() {
  const [view, setView] = useState('pick')
  const [editorConfig, setEditorConfig] = useState({
    type: 'template',
    templateKey: 'horizontal',
  })
  const [editorDirty, setEditorDirty] = useState(false)

  const handlePick = useCallback((config) => {
    setEditorConfig(config)
    setEditorDirty(false)
    setView('edit')
  }, [])

  const handleHome = useCallback(() => {
    setEditorDirty(false)
    setView('pick')
  }, [])

  useEffect(() => {
    if (view !== 'edit' || !editorDirty) return

    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = LEAVE_CONFIRM_MESSAGE
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [view, editorDirty])

  if (view === 'pick') {
    return <TemplatePicker onSelect={handlePick} />
  }

  const layoutKey =
    editorConfig.type === 'free'
      ? `free-${editorConfig.widthPx}-${editorConfig.heightPx}`
      : editorConfig.templateKey

  return (
    <EditorLayout
      key={layoutKey}
      config={editorConfig}
      onHome={handleHome}
      onDirtyChange={setEditorDirty}
    />
  )
}
