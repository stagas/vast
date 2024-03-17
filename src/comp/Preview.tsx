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
import { getNotesScale } from '../util/notes.ts'
import { state } from '../state.ts'

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

  const canvas = <Canvas view={view} onresize={onresize} class="absolute right-0 bottom-0 z-10" /> as Canvas
  // $.fx(() => {
  //   const { mainYBottom: y } = layout.info
  //   $()
  //   canvas.style.transform = `translateY(${y}px)`
  // })

  const webgl = WebGL(view, canvas, true)
  const sketch = Sketch(webgl.GL, view)
  webgl.add($, sketch)

  const viewMatrix = $(new LerpMatrix)
  $.fx(() => {
    const { w, h } = view
    $()
    viewMatrix.a = w + 1
    viewMatrix.d = h
  })

  const shapes = Shapes(view, viewMatrix)
  sketch.scene.add(shapes)
  const rect = $({
    x: 0,
    y: 0,
    w: 1,
    h: 1,
  })
  const wave = shapes.Wave(rect)
  wave.view.color = 0xffffff

  const cols = shapes.Box(rect)
  cols.view.opts |= ShapeOpts.Cols
  cols.view.alpha = 0.2

  const notesShape = shapes.Notes(rect)
  notesShape.view.isFocused = 1
  // notesShape.view.alpha = dimmed ? 0.5 : 1.0
  function toFront(shape: any) {
    shapes.shapes.delete(shape)
    shapes.shapes.add(shape)
  }

  $.fx(() => {
    const { mode } = state
    $()
    toFront(cols)
    toFront(wave)
    if (mode === 'notes') {
      toFront(notesShape)
      notesShape.view.alpha = 1.0
      cols.view.alpha = 0.2 * 0.25
      wave.view.alpha = 0.25
    }
    else {
      notesShape.view.alpha = 0.25
      cols.view.alpha = 0.2
      wave.view.alpha = 1.0
    }
    shapes.info.needUpdate = true
    info.redraw++
  })
  $.fx(() => {
    const { project } = $.of(lib)
    const { activeTrack } = $.of(project.info)
    const { fg } = activeTrack.info.colors
    const box = activeTrack.info.boxes[0]
    if (!box) return

    const { track, info: { isFocused } } = box
    const { colors } = track.info
    const { primaryColorInt } = screen.info
    $()
    notesShape.view.color = colors.colorBright //isFocused && !dimmed ? colors.colorBright : colors.fg
    notesShape.view.hoverColor = primaryColorInt
  })

  $.fx(() => {
    const { project } = $.of(lib)
    const { activeTrack } = $.of(project.info)
    const { fg } = activeTrack.info.colors
    const box = activeTrack.info.boxes[0]
    if (!box) return

    const { track, info: { isFocused } } = box

    // const { scale } = $.of(info)
    const { notesData, notesJson } = box.track.info
    $()
    const scale = getNotesScale(notesJson, 3, 3)

    notesShape.view.notes$ = notesData.ptr
    notesShape.view.min = scale.min
    notesShape.view.max = scale.max
    shapes.info.needUpdate = true
  })

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
    cols.view.color = fg
    shapes.info.needUpdate = true
    info.redraw++
  })

  $.fx(() => {
    const { redraw } = info
    $()
    webgl.draw()
  })

  return { el: canvas }
}
