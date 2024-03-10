import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { HEADER_HEIGHT } from '../constants.ts'
import { Grid } from '../draws/grid.ts'
import { Heads } from '../draws/heads.ts'
import { state } from '../state.ts'
import { Surface } from '../surface.ts'
import { Canvas } from './Canvas.tsx'
import { Minimap } from './Minimap.tsx'
import { Code } from './Code.tsx'

const DEBUG = true

export type Sequencer = ReturnType<typeof Sequencer>

export function Sequencer() {
  DEBUG && console.log('[main] create')
  using $ = Signal()

  const view = $(new Rect, { pr: state.$.pr })

  const surface = Surface(view, state.matrix, state.viewMatrix, () => {
    view.w = window.innerWidth
    view.h = (window.innerHeight - HEADER_HEIGHT) / 2
    view.pr = state.pr
  })

  const grid = Grid(surface)

  const minimap = Minimap(grid)

  const canvas = <Canvas view={view} class="
    absolute left-0 top-0
    pointer-events-none
    pixelated
  " /> as Canvas

  const c = canvas.getContext('2d', { alpha: true })!
  c.imageSmoothingEnabled = false

  // const textDraw = TextDraw(surface, grid, view)
  const headsDraw = Heads(c, surface, grid, view)

  const code = Code()

  const el = <div>
    {surface.canvas}
    {canvas}
  </div>

  return { el, minimap, code }
}
