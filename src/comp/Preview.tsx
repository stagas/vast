import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { screen } from '../screen.tsx'
import { Canvas } from './Canvas.tsx'
import { layout } from '../layout.ts'
import { HEADER_HEIGHT } from '../constants.ts'
import { WebGL } from '../webgl.ts'
import { Shapes, Sketch } from '../gl/sketch.ts'
import { LerpMatrix } from '../util/geometry.ts'
import { ShapeOpts } from '../../as/assembly/gfx/sketch-shared.ts'
import { Grid } from '../draws/grid.ts'
import { services } from '../services.ts'
import { lib } from '../lib.ts'

const DEBUG = true

export type Preview = ReturnType<typeof Preview>

export function Preview() {
  DEBUG && console.log('[preview] create')
  using $ = Signal()

  const view = $(new Rect, {
    w: layout.info.$.previewWidth,
    h: layout.info.$.codeHeight,
    pr: screen.info.$.pr
  })

  const info = $({
    redraw: 0,
  })

  function onresize() {
    info.redraw++
  }

  const canvas = <Canvas view={view} onresize={onresize} class="absolute right-0 bottom-0 z-10 pointer-events-none" /> as Canvas
  // $.fx(() => {
  //   const { mainYBottom: y } = layout.info
  //   $()
  //   canvas.style.transform = `translateY(${y}px)`
  // })

  const webgl = WebGL(view, canvas, true)
  const sketch = Sketch(webgl.GL, view)
  webgl.add($, sketch)

  const viewMatrix = $(new LerpMatrix)
  viewMatrix.a = view.w + 1

  const shapes = Shapes(view, viewMatrix)
  sketch.scene.add(shapes)
  const rect = $({
    x: 0,
    y: 0,
    w: view.$.w,
    h: view.$.h,
  })
  const wave = shapes.Wave(rect)
  wave.view.color = 0xffffff

  const cols = shapes.Cols(rect)

  $.fx(() => {
    const { project } = $.of(lib)
    const { activeTrack } = $.of(project.info)
    const { fg } = activeTrack.info.colors
    const box = activeTrack.info.boxes[0]
    if (!box) return
    const { floats } = $.of(box.track.info)
    const { clock } = $.of(services.audio.dsp.info)
    $()
    wave.view.floats$ = floats.ptr
    wave.view.len = floats.len
    wave.view.coeff = clock.coeff
    wave.view.color = fg
    shapes.update()
    info.redraw++
  })

  $.fx(() => {
    const { redraw } = info
    $()
    webgl.draw()
  })

  return { el: canvas }
}
