import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { HEADER_HEIGHT, HEADS_WIDTH } from '../constants.ts'
import { Grid } from '../draws/grid.ts'
import { Heads } from '../draws/heads.ts'
import { screen } from '../screen.tsx'
import { state } from '../state.ts'
import { Surface } from '../surface.ts'
import { Canvas } from './Canvas.tsx'
import { Code } from './Code.tsx'
import { Minimap } from './Minimap.tsx'
import { layout } from '../layout.ts'

const DEBUG = true

export type Sequencer = ReturnType<typeof Sequencer>

export function Sequencer() {
  DEBUG && console.log('[main] create')
  using $ = Signal()

  const view = $(new Rect, { pr: screen.info.$.pr })

  const surface = Surface(view, state.matrix, state.viewMatrix, true)

  $.fx(() => {
    const { w } = screen.info.rect
    const { mainY } = layout.info
    $()
    view.x = HEADS_WIDTH
    view.w = w - HEADS_WIDTH
    view.h = mainY - HEADER_HEIGHT / 2
  })

  const grid = Grid(surface)

  const minimap = Minimap(grid)

  const headsView = $(new Rect, { pr: screen.info.$.pr })
  $.fx(() => {
    const { w, h } = view
    $()
    headsView.w = w
    headsView.h = h
  })

  const canvas = <Canvas onresize={(y) => {
    surface.sketch.view.y = y
  }} view={headsView} class="
    absolute left-0 top-0
    pointer-events-none
    pixelated
  " /> as Canvas

  const c = canvas.getContext('2d', { alpha: true })!
  c.imageSmoothingEnabled = false

  // const textDraw = TextDraw(surface, grid, view)
  const headsDraw = Heads(c, surface, grid, headsView)

  const code = Code()
  const vertSep = <div class="fixed left-0 top-0 w-[2px] bg-white z-30" /> as HTMLDivElement
  $.fx(() => {
    const { mainY, codeWidth } = layout.info
    const { h } = screen.info.rect
    $()
    const y = mainY + HEADS_WIDTH / 2 - 3
    vertSep.style.height = (h - y) + 'px'
    vertSep.style.transform = `translateX(${codeWidth - 1}px) translateY(${y}px)`
  })
  const el = <div>
    {surface.canvas}
    {canvas}
    {vertSep}
  </div>

  return { el, grid, minimap, code }
}
