import { Signal } from 'signal-jsx'
import { Rect } from 'std'

export type Canvas = ReturnType<typeof Canvas>

export function Canvas(props: { view: Rect, class?: string, onresize?: () => void }) {
  using $ = Signal()

  const el = <canvas width="1" height="1" class={props.class} /> as HTMLCanvasElement

  $.fx(() => {
    const { width, height, w_pr, h_pr } = $.of(props.view)
    $()
    el.width = w_pr
    el.height = h_pr
    el.style.width = width + 'px'
    el.style.height = height + 'px'
    props.onresize?.()
  })

  return el
}
