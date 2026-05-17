/**
 * Fabric.js v7 IText 한글 IME 수정
 * @see https://github.com/fabricjs/fabric.js/issues/3069
 *
 * 1) hiddenTextarea의 Fabric onInput(grapheme diff) 리스너 제거 → textarea 동기화만 사용
 * 2) IME가 동작하도록 textarea 스타일 보정 (1px/opacity:0 은 Chrome IME 깨짐)
 */

import { IText, Textbox } from 'fabric'

let prototypePatched = false

function renderAfterTextChange(itext) {
  itext.fire('changed')
  if (itext.canvas) {
    itext.canvas.fire('text:changed', { target: itext })
    itext.canvas.requestRenderAll()
  }
}

function syncFromHiddenTextarea(itext) {
  if (!itext.hiddenTextarea || !itext.isEditing) return
  itext.updateFromTextArea()
  renderAfterTextChange(itext)
}

function applyImeFriendlyTextareaStyles(itext, ta) {
  const fontSize = Math.max(12, itext.fontSize || 16)
  const lineH = fontSize * (itext.lineHeight || 1.16)
  const pos = itext._calcTextareaPosition?.() ?? { top: '0px', left: '0px' }

  ta.setAttribute('lang', 'ko')
  ta.setAttribute('inputmode', 'text')
  ta.setAttribute('autocomplete', 'off')
  ta.setAttribute('autocorrect', 'off')
  ta.setAttribute('spellcheck', 'false')

  ta.style.cssText = [
    'position: fixed',
    `top: ${pos.top}`,
    `left: ${pos.left}`,
    `width: ${Math.max(120, Math.ceil(itext.width || 160))}px`,
    `height: ${Math.max(lineH, 24)}px`,
    `font-size: ${fontSize}px`,
    `font-family: ${itext.fontFamily || 'Noto Sans KR'}`,
    `font-weight: ${itext.fontWeight || 'normal'}`,
    'line-height: 1.16',
    'opacity: 0.01',
    'color: transparent',
    'caret-color: auto',
    'background: transparent',
    'border: none',
    'outline: none',
    'padding: 0',
    'margin: 0',
    'resize: none',
    'overflow: hidden',
    'z-index: 10000',
    'white-space: pre-wrap',
  ].join(';')
}

/**
 * Fabric이 bind한 onInput(grapheme diff) 등을 제거하고 IME-safe 리스너만 연결
 */
export function rewireHiddenTextareaForIme(itext) {
  const old = itext.hiddenTextarea
  if (!old?.parentNode) return

  const parent = old.parentNode
  const neu = document.createElement('textarea')
  neu.setAttribute('data-fabric', 'textarea')
  neu.setAttribute('wrap', 'off')
  neu.setAttribute('name', 'fabricTextarea')
  neu.value = old.value
  neu.selectionStart = old.selectionStart
  neu.selectionEnd = old.selectionEnd

  applyImeFriendlyTextareaStyles(itext, neu)
  parent.replaceChild(neu, old)
  itext.hiddenTextarea = neu

  const onInput = () => {
    if (!itext.isEditing) return
    if (itext.__imeSkipNextInput) {
      itext.__imeSkipNextInput = false
      return
    }
    if (neu.value === '') itext.styles = {}
    syncFromHiddenTextarea(itext)
  }

  const onCompositionStart = () => {
    itext.inCompositionMode = true
  }

  const onCompositionUpdate = () => {
    if (itext.inCompositionMode) syncFromHiddenTextarea(itext)
  }

  const onCompositionEnd = () => {
    itext.inCompositionMode = false
    itext.__imeSkipNextInput = true
    syncFromHiddenTextarea(itext)
  }

  const onKeyDown = (e) => {
    if (e.isComposing || itext.inCompositionMode) return
    if (typeof itext.onKeyDown === 'function') itext.onKeyDown(e)
  }

  const onKeyUp = (e) => {
    if (e.isComposing || itext.inCompositionMode) return
    if (typeof itext.onKeyUp === 'function') itext.onKeyUp(e)
  }

  neu.addEventListener('input', onInput)
  neu.addEventListener('compositionstart', onCompositionStart)
  neu.addEventListener('compositionupdate', onCompositionUpdate)
  neu.addEventListener('compositionend', onCompositionEnd)
  neu.addEventListener('keydown', onKeyDown)
  neu.addEventListener('keyup', onKeyUp)
  neu.addEventListener('blur', () => itext.blur?.())
  neu.addEventListener('copy', () => itext.copy?.())
  neu.addEventListener('cut', () => itext.copy?.())
  neu.addEventListener('paste', (e) => itext.paste?.(e))

  itext.__imeTextareaCleanup = () => {
    neu.removeEventListener('input', onInput)
    neu.removeEventListener('compositionstart', onCompositionStart)
    neu.removeEventListener('compositionupdate', onCompositionUpdate)
    neu.removeEventListener('compositionend', onCompositionEnd)
    neu.removeEventListener('keydown', onKeyDown)
    neu.removeEventListener('keyup', onKeyUp)
  }
}

export function applyFabricTextImePatch() {
  if (prototypePatched) return
  prototypePatched = true

  for (const Klass of [IText, Textbox]) {
    const proto = Klass.prototype
    const origInitHiddenTextarea = proto.initHiddenTextarea
    const origOnKeyDown = proto.onKeyDown

    proto.onKeyDown = function onKeyDownIme(e) {
      if (e.isComposing || this.inCompositionMode) return
      return origOnKeyDown.call(this, e)
    }

    proto.initHiddenTextarea = function initHiddenTextareaIme() {
      origInitHiddenTextarea.call(this)
      rewireHiddenTextareaForIme(this)
    }

    /** Fabric onInput — grapheme diff 완전 우회 */
    proto.onInput = function onInputBypass() {
      if (!this.isEditing) return
      if (this.__imeSkipNextInput) {
        this.__imeSkipNextInput = false
        return
      }
      if (this.hiddenTextarea?.value === '') this.styles = {}
      syncFromHiddenTextarea(this)
    }
  }
}

export function attachFabricCanvasImeHandlers(canvas) {
  if (canvas.__imeCanvasAttached) return
  canvas.__imeCanvasAttached = true

  canvas.on('text:editing:entered', ({ target }) => {
    rewireHiddenTextareaForIme(target)
    target.hiddenTextarea?.focus()
  })

  canvas.on('text:editing:exited', ({ target }) => {
    target.__imeTextareaCleanup?.()
    target.__imeTextareaCleanup = undefined
    target.inCompositionMode = false
    target.__imeSkipNextInput = false
  })
}
