import { Signal } from 'signal-jsx'
import { Rect } from 'std'

export type Canvas = ReturnType<typeof Canvas>

export function Canvas(props: { view: Rect, class?: string, onresize?: (yOffset: number) => void }) {
  using $ = Signal()

  const el = <canvas width="1" height="1" class={props.class} /> as HTMLCanvasElement

  let lastHeight = 0
  let lastHeight_pr = 0
  let lastWidth = 0
  let lastWidth_pr = 0
  $.fx(() => {
    const { width, height, w_pr, h_pr } = $.of(props.view)
    $()
    el.width = (lastWidth_pr = Math.max(lastWidth_pr, w_pr))
    el.height = (lastHeight_pr = Math.max(lastHeight_pr, h_pr))
    el.style.width = (lastWidth = Math.max(width, lastWidth)) + 'px'
    el.style.height = (lastHeight = Math.max(height, lastHeight)) + 'px'
    const yOffset = lastHeight - height
    props.onresize?.(yOffset)
  })
  $.fx(() => {
    const { x, y } = $.of(props.view)
    $()
    el.style.transform = `translateX(${x}px)`
    // el.height = (lastHeight_pr = Math.max(lastHeight_pr, h_pr))
    // el.style.width = (lastWidth = Math.max(width, lastWidth)) + 'px'
    // el.style.height = (lastHeight = Math.max(height, lastHeight)) + 'px'
    // const yOffset = lastHeight - height
    // props.onresize?.(yOffset)
  })

  return el
}
