/* eslint-disable react-refresh/only-export-components -- context + hook in one module */
import { createContext, useContext, useState, useCallback } from 'react'

const EditorContext = createContext(null)

export function EditorProvider({ children }) {
  const [canvas, setCanvas] = useState(null)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(null)

  const bump = useCallback(() => setRevision((r) => r + 1), [])

  const registerCanvas = useCallback(
    (instance) => {
      setCanvas(instance)
      setRevision((r) => r + 1)
    },
    [],
  )

  const value = {
    canvas,
    revision,
    bump,
    selected,
    setSelected,
    registerCanvas,
  }

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used within EditorProvider')
  return ctx
}
