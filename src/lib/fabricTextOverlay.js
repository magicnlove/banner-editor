/**
 * Fabric IText 한글 입력 — HTML textarea 오버레이 (네이티브 IME)
 */
import { IText, Textbox } from 'fabric'
import { loadCanvasTextFontsAndRender } from './appFonts'
import { applyTextToFabricObject } from './fabricTextSync'
import { isTemplateLayerObject } from './template'

/** @type {{ canvas: import('fabric').Canvas; textObj: import('fabric').FabricObject; textarea: HTMLTextAreaElement; prevOpacity: number; onRender: () => void } | null} */
let activeOverlay = null

let editingDisabled = false

function isEditableText(obj) {
  if (!obj || isTemplateLayerObject(obj)) return false
  return Boolean(
    obj.isType?.('IText', 'i-text', 'Text', 'Textbox', 'textbox', 'FabricText'),
  )
}

/** @param {import('fabric').Canvas} canvas */
function getOverlayHost(canvas) {
  const el = canvas.upperCanvasEl ?? canvas.getElement?.()
  return el?.parentElement ?? null
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {import('fabric').FabricObject} textObj
 */
function computeOverlayRect(canvas, textObj) {
  const zoom = canvas.getZoom() || 1
  textObj.setCoords()
  const rect = textObj.getBoundingRect(true, true)
  const fontSize = (textObj.fontSize || 16) * zoom
  const lineHeight = textObj.lineHeight || 1.16

  return {
    rect,
    fontSize,
    lineHeight,
    fill: typeof textObj.fill === 'string' ? textObj.fill : '#1a1d24',
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {import('fabric').FabricObject} textObj
 * @param {HTMLTextAreaElement} textarea
 */
function applyOverlayGeometry(canvas, textObj, textarea) {
  const { rect, fontSize, lineHeight, fill } = computeOverlayRect(canvas, textObj)
  const charSpacing = textObj.charSpacing ?? 0

  textarea.style.left = `${rect.left}px`
  textarea.style.top = `${rect.top}px`
  textarea.style.width = `${Math.max(rect.width, 48)}px`
  textarea.style.minHeight = `${Math.max(rect.height, fontSize * lineHeight)}px`
  textarea.style.fontSize = `${fontSize}px`
  textarea.style.fontFamily = textObj.fontFamily || 'Noto Sans KR'
  textarea.style.fontWeight = String(textObj.fontWeight || 'normal')
  textarea.style.fontStyle = textObj.fontStyle || 'normal'
  textarea.style.color = fill
  textarea.style.textAlign = textObj.textAlign || 'left'
  textarea.style.lineHeight = String(lineHeight)
  textarea.style.letterSpacing =
    charSpacing !== 0 ? `${(charSpacing * (canvas.getZoom() || 1))}px` : ''
  if (textObj.underline) {
    textarea.style.textDecoration = 'underline'
  }
}

function detachOverlayListeners() {
  if (!activeOverlay) return
  activeOverlay.canvas.off('after:render', activeOverlay.onRender)
}

/**
 * @param {boolean} commit
 */
export function closeTextOverlay(commit = true) {
  if (!activeOverlay) return

  const { canvas, textObj, textarea, prevOpacity } = activeOverlay
  detachOverlayListeners()

  if (commit) {
    applyTextToFabricObject(textObj, textarea.value, canvas)
    void loadCanvasTextFontsAndRender(canvas)
  }

  textObj.set({ opacity: prevOpacity })
  textarea.remove()
  activeOverlay = null
  canvas.requestRenderAll()
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {import('fabric').FabricObject} textObj
 */
export function openTextOverlay(canvas, textObj) {
  if (!isEditableText(textObj)) return

  closeTextOverlay(true)

  const host = getOverlayHost(canvas)
  if (!host) return

  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative'
  }

  if (textObj.isEditing) {
    textObj.exitEditing?.()
  }

  const prevOpacity = textObj.opacity ?? 1
  textObj.set({ opacity: 0.2 })
  canvas.requestRenderAll()

  const textarea = document.createElement('textarea')
  textarea.value = textObj.text ?? ''
  textarea.setAttribute('lang', 'ko')
  textarea.setAttribute('inputmode', 'text')
  textarea.setAttribute('autocomplete', 'off')
  textarea.setAttribute('spellcheck', 'false')

  Object.assign(textarea.style, {
    position: 'absolute',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: '0',
    margin: '0',
    resize: 'none',
    overflow: 'hidden',
    zIndex: '10000',
    whiteSpace: 'pre-wrap',
    boxSizing: 'border-box',
    caretColor: 'auto',
  })

  applyOverlayGeometry(canvas, textObj, textarea)
  host.appendChild(textarea)
  textarea.focus()

  const len = textarea.value.length
  textarea.setSelectionRange(len, len)

  const onRender = () => {
    if (activeOverlay?.textarea === textarea) {
      applyOverlayGeometry(canvas, textObj, textarea)
    }
  }

  const onKeyDown = (e) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      const original = textObj.text ?? ''
      textarea.value = original
      closeTextOverlay(false)
    }
  }

  const onBlur = () => {
    closeTextOverlay(true)
  }

  textarea.addEventListener('keydown', onKeyDown)
  textarea.addEventListener('blur', onBlur, { once: true })

  canvas.on('after:render', onRender)

  activeOverlay = {
    canvas,
    textObj,
    textarea,
    prevOpacity,
    onRender,
  }
}

export function disableFabricNativeTextEditing() {
  if (editingDisabled) return
  editingDisabled = true

  for (const Klass of [IText, Textbox]) {
    Klass.prototype.enterEditing = function enterEditingDisabled() {
      return this
    }
  }
}

/** @param {import('fabric').Canvas} canvas */
export function attachCanvasTextOverlay(canvas) {
  if (canvas.__textOverlayAttached) return
  canvas.__textOverlayAttached = true

  disableFabricNativeTextEditing()

  canvas.on('mouse:dblclick', (opt) => {
    const target = opt.target
    if (!isEditableText(target)) return

    opt.e?.preventDefault?.()
    opt.e?.stopPropagation?.()

    canvas.setActiveObject(target)
    openTextOverlay(canvas, target)
  })

  canvas.on('selection:cleared', () => {
    if (activeOverlay) closeTextOverlay(true)
  })
}
