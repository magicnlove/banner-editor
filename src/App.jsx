import { useState, useCallback } from 'react'
import { TemplatePicker } from './components/TemplatePicker'
import { EditorLayout } from './components/EditorLayout'

export default function App() {
  const [view, setView] = useState('pick')
  const [templateKey, setTemplateKey] = useState('horizontal')

  const handlePick = useCallback((key) => {
    setTemplateKey(key)
    setView('edit')
  }, [])

  const handleHome = useCallback(() => {
    setView('pick')
  }, [])

  if (view === 'pick') {
    return <TemplatePicker onSelect={handlePick} />
  }

  return <EditorLayout key={templateKey} templateKey={templateKey} onHome={handleHome} />
}
