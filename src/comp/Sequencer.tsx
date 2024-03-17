import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { HEADER_HEIGHT, HEADS_WIDTH } from '../constants.ts'
import { Grid } from '../draws/grid.ts'
import { Heads } from '../draws/heads.tsx'
import { layout } from '../layout.ts'
import { screen } from '../screen.tsx'
import { state } from '../state.ts'
import { Surface } from '../surface.tsx'
import { Code } from './Code.tsx'
import { Minimap } from './Minimap.tsx'
import { Preview } from './Preview.tsx'

const DEBUG = true

export type Sequencer = ReturnType<typeof Sequencer>

export function Sequencer() {
  DEBUG && console.log('[sequencer] create')
  using $ = Signal()

  const view = $(new Rect, { pr: screen.info.$.pr })
  const surface = Surface(view, state.matrix, state.viewMatrix, true)
  const grid = Grid(surface)
  const minimap = Minimap(grid)
  // const textDraw = TextDraw(surface, grid, view)
  const heads = Heads(surface, grid)
  const code = Code()
  const preview = Preview(grid)
  const vertSep = <div class="fixed left-0 top-0 w-[2px] bg-black z-30" /> as HTMLDivElement

  $.fx(() => {
    const { w } = screen.info.rect
    const { mainY } = layout.info
    $()
    view.x = HEADS_WIDTH
    view.w = w - HEADS_WIDTH
    view.h = mainY - HEADER_HEIGHT / 2
  })

  $.fx(() => {
    const { mainY, codeWidth } = layout.info
    const { h } = screen.info.rect
    $()
    const y = mainY + HEADS_WIDTH / 2 - 3
    vertSep.style.height = (h - y) + 'px'
    vertSep.style.transform = `translateX(${codeWidth - 1}px) translateY(${y}px)`
  })

  const top = <div class="relative overflow-hidden w-full">
    {surface.canvas}
  </div> as HTMLDivElement

  $.fx(() => {
    top.style.height = view.h + 'px'
  })

  const el = <div>
    {top}
    {heads.canvas}
    {preview.el}
    {vertSep}
  </div>

  return { el, grid, minimap, code }
}
