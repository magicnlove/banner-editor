/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

/** @typedef {{ id: string; orientation: 'horizontal' | 'vertical'; position: number }} WorkspaceGuide */

const WorkspaceOverlayContext = createContext(null)

let guideIdSeq = 0

function nextGuideId() {
  guideIdSeq += 1
  return `guide-${guideIdSeq}`
}

export function WorkspaceOverlayProvider({ children }) {
  const [rulersVisible, setRulersVisible] = useState(true)
  const [gridVisible, setGridVisible] = useState(false)
  const [guidesVisible, setGuidesVisible] = useState(true)
  const [gridSpacingPx, setGridSpacingPx] = useState(50)
  const [rulerUnit, setRulerUnit] = useState(
    /** @type {'px' | 'cm'} */ ('px'),
  )
  const [guides, setGuides] = useState(/** @type {WorkspaceGuide[]} */ ([]))
  /** @type {[WorkspaceGuide | null, React.Dispatch<React.SetStateAction<WorkspaceGuide | null>>]} */
  const [previewGuide, setPreviewGuide] = useState(null)
  const [layoutTick, setLayoutTick] = useState(0)

  const bumpLayout = useCallback(() => {
    setLayoutTick((t) => t + 1)
  }, [])

  const addGuide = useCallback((orientation, position) => {
    setGuides((prev) => [
      ...prev,
      {
        id: nextGuideId(),
        orientation,
        position: Math.max(0, position),
      },
    ])
  }, [])

  const updateGuide = useCallback((id, position) => {
    setGuides((prev) =>
      prev.map((g) => (g.id === id ? { ...g, position } : g)),
    )
  }, [])

  const removeGuide = useCallback((id) => {
    setGuides((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const clearGuides = useCallback(() => {
    setGuides([])
  }, [])

  const value = useMemo(
    () => ({
      rulersVisible,
      setRulersVisible,
      gridVisible,
      setGridVisible,
      guidesVisible,
      setGuidesVisible,
      gridSpacingPx,
      setGridSpacingPx,
      rulerUnit,
      setRulerUnit,
      guides,
      previewGuide,
      setPreviewGuide,
      addGuide,
      updateGuide,
      removeGuide,
      clearGuides,
      layoutTick,
      bumpLayout,
    }),
    [
      rulersVisible,
      gridVisible,
      guidesVisible,
      gridSpacingPx,
      rulerUnit,
      guides,
      previewGuide,
      addGuide,
      updateGuide,
      removeGuide,
      clearGuides,
      layoutTick,
      bumpLayout,
    ],
  )

  return (
    <WorkspaceOverlayContext.Provider value={value}>
      {children}
    </WorkspaceOverlayContext.Provider>
  )
}

export function useWorkspaceOverlay() {
  const ctx = useContext(WorkspaceOverlayContext)
  if (!ctx) {
    throw new Error(
      'useWorkspaceOverlay must be used within WorkspaceOverlayProvider',
    )
  }
  return ctx
}

/** @returns {import('./WorkspaceOverlayContext.jsx').WorkspaceOverlayContextValue | null} */
export function useWorkspaceOverlayOptional() {
  return useContext(WorkspaceOverlayContext)
}
