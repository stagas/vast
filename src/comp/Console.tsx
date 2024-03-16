import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { screen } from '../screen.tsx'
import { state } from '../state.ts'
import { Canvas } from './Canvas.tsx'

export function Console({ signal, history, size }: { signal: () => void, history: string[], size: number }) {
  using $ = Signal()
  const view = $(new Rect, { w: 400, h: size * 12 + 4, pr: window.devicePixelRatio })
  const canvas = Canvas({ view })
  const c = canvas.getContext('2d')!
  canvas.style.imageRendering = 'pixelated'
  c.imageSmoothingEnabled = false
  c.scale(view.pr, view.pr)

  const el = <div class="
    fixed bottom-2 right-2 z-30
    bg-base-300 bg-opacity-50
    pointer-events-none
  " />

  let active = true

  $.fx(() => {
    if (!state.debugConsoleActive) return
    signal()
    c.clearRect(0, 0, view.width, view.height)
    c.fillStyle = screen.info.colors['primary']
    c.textBaseline = 'top'
    c.font = '12px sans-serif'
    while (history.length > size) history.shift()
    for (let y = 0; y < history.length; y++) {
      c.fillText(history[y], 3, 3 + y * 12)
    }
  })

  $.fx(() => {
    const { debugConsoleActive } = state
    $()
    if (debugConsoleActive) {
      el.append(canvas)
    }
    else {
      canvas.remove()
    }
  })

  return el
}
