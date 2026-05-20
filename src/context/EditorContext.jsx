/* eslint-disable react-refresh/only-export-components -- context + hook in one module */
import { createContext, useContext, useState, useCallback, useRef } from 'react'

const EditorContext = createContext(null)

export function EditorProvider({ children }) {
  const [canvas, setCanvas] = useState(null)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const suppressDirtyRef = useRef(false)
  const fitToScreenRef = useRef(null)
  const historyRef = useRef(null)
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  })

  const bump = useCallback(() => {
    setRevision((r) => r + 1)
    if (!suppressDirtyRef.current) {
      setIsDirty(true)
    }
  }, [])

  const markClean = useCallback(() => {
    setIsDirty(false)
  }, [])

  const runWithoutDirty = useCallback(async (fn) => {
    suppressDirtyRef.current = true
    try {
      return await fn()
    } finally {
      suppressDirtyRef.current = false
    }
  }, [])

  const registerFitToScreen = useCallback((fn) => {
    fitToScreenRef.current = fn
  }, [])

  const fitToScreen = useCallback(() => {
    fitToScreenRef.current?.()
  }, [])

  const syncHistoryState = useCallback(() => {
    const api = historyRef.current
    setHistoryState({
      canUndo: api?.canUndo() ?? false,
      canRedo: api?.canRedo() ?? false,
    })
  }, [])

  const registerHistory = useCallback(
    (api) => {
      historyRef.current = api
      syncHistoryState()
    },
    [syncHistoryState],
  )

  const resetHistory = useCallback(() => {
    historyRef.current?.reset()
    syncHistoryState()
  }, [syncHistoryState])

  const undo = useCallback(async () => {
    const ok = await historyRef.current?.undo()
    if (ok) {
      bump()
      syncHistoryState()
    }
    return Boolean(ok)
  }, [bump, syncHistoryState])

  const redo = useCallback(async () => {
    const ok = await historyRef.current?.redo()
    if (ok) {
      bump()
      syncHistoryState()
    }
    return Boolean(ok)
  }, [bump, syncHistoryState])

  const registerCanvas = useCallback(
    (instance) => {
      setCanvas(instance)
      setRevision((r) => r + 1)
      if (instance) {
        suppressDirtyRef.current = true
        setIsDirty(false)
        requestAnimationFrame(() => {
          suppressDirtyRef.current = false
        })
      }
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
    isDirty,
    markClean,
    runWithoutDirty,
    registerFitToScreen,
    fitToScreen,
    registerHistory,
    resetHistory,
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    syncHistoryState,
  }

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used within EditorProvider')
  return ctx
}
