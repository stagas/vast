import { Signal } from 'signal-jsx'
import { Rect } from 'std'
// import { log } from './state.ts'

export function Canvas({ view, onresize }: { view: Rect, onresize?: () => void }) {
  using $ = Signal()

  const el = <canvas width="1" height="1" /> as HTMLCanvasElement

  $.fx(() => {
    const { pr, width, height, w_pr, h_pr } = $.of(view)
    $()
    el.width = w_pr
    el.height = h_pr
    el.style.width = width + 'px'
    el.style.height = height + 'px'
    onresize?.()
    // log(`resize: ${width}:${height}:${pr}`)
  })

  return el
}
