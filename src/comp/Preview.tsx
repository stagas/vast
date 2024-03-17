import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { clamp, dom } from 'utils'
import { ShapeOpts } from '../../as/assembly/gfx/sketch-shared.ts'
import { Grid } from '../draws/grid.ts'
import { Shapes, Sketch } from '../gl/sketch.ts'
import { layout } from '../layout.ts'
import { screen } from '../screen.tsx'
import { services } from '../services.ts'
import { state } from '../state.ts'
import { LerpMatrix } from '../util/geometry.ts'
import { BoxNote, MAX_NOTE, getNotesScale } from '../util/notes.ts'
import { WebGL } from '../webgl.ts'
import { Mouse } from '../world/mouse.ts'
import { Canvas } from './Canvas.tsx'
import { lib } from '../lib.ts'

const DEBUG = true

export type Preview = ReturnType<typeof Preview>

export function Preview(grid: Grid) {
  DEBUG && console.log('[preview] create')
  using $ = Signal()

  const view = $(new Rect, {
    w: layout.info.$.previewWidth,
    h: layout.info.$.codeHeight,
    pr: screen.info.$.pr
  })

  const info = $({
    redraw: 0,
    mouseOffsetY: 0,
    get trackBox() {
      return lib?.project?.info?.activeTrackBox
    },
    hoveringNoteN: -1,
    hoveringNote: null as null | BoxNote,
    draggingNote: null as null | BoxNote,
    scale: null as null | ReturnType<typeof getNotesScale>
  })

  $.fx(() => {
    const { draggingNote, trackBox } = info
    if (draggingNote || !trackBox) return
    info.scale = getNotesScale(trackBox.track.info.notesJson, 3, 3)
  })

  function onresize(y: number) {
    info.mouseOffsetY = y
    info.redraw++
  }

  const canvas = <Canvas view={view} onresize={onresize} class="
    absolute
    right-0
    bottom-0
    z-10
  " /> as Canvas

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
    const { trackBox: box } = $.of(info)
    const { track } = box
    const { colors } = track.info
    const { primaryColorInt } = screen.info
    $()
    notesShape.view.color = colors.colorBright //isFocused && !dimmed ? colors.colorBright : colors.fg
    notesShape.view.hoverColor = primaryColorInt
  })

  $.fx(() => {
    const { trackBox: box, scale } = $.of(info)
    const { notesData } = box.track.info
    $()
    notesShape.view.notes$ = notesData.ptr
    notesShape.view.min = scale.min
    notesShape.view.max = scale.max
    shapes.info.needUpdate = true
  })

  $.fx(() => {
    const { trackBox: box } = $.of(info)
    const { fg } = box.track.info.colors
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

  const mouse = Mouse(view, viewMatrix)
  const notePos = { x: -1, y: -1 }

  function updateHoveringNoteN() {
    const { trackBox: box } = info
    if (!box) {
      info.hoveringNoteN = -1
      return
    }

    if (!box.track.info.notes) return

    let { x, y } = mouse.screenPos
    // x -= hoveringBox.rect.x
    // y = (y - hoveringBox.rect.y) //* (1 / NOTES_HEIGHT_NORMAL)
    notePos.x = x * 16
    notePos.y = y

    const { scale } = info
    if (!scale) {
      info.hoveringNoteN = -1
      return
    }

    info.hoveringNoteN = clamp(
      0,
      MAX_NOTE - 1,
      Math.ceil(
        scale.max
        - (y * (scale.N + 1))
      )
    )
  }

  function updateHoveringNote() {
    updateHoveringNoteN()
    const hn = info.hoveringNoteN
    const { x, y } = notePos

    const { trackBox: box, scale } = info
    if (!box || !scale) return
    const { notes } = box.track.info

    // if (isZooming) {
    //   info.hoveringNote = null
    //   return
    // }

    let found = false
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i]
      const { n, time, length } = note.info
      if (n !== hn) continue
      if (x >= time && x <= time + length) {
        info.hoveringNote = note
        found = true
        break
      }
    }
    if (!found) {
      info.hoveringNote = null
    }
  }

  function onMouseMove(e: MouseEvent) {
    mouse.pos.setFromEvent(e, canvas)
    mouse.pos.y -= info.mouseOffsetY
    updateHoveringNote()
  }

  $.fx(() => {
    const { hoveringNote } = info
    $()
    notesShape.view.hoveringNote$ = hoveringNote?.data.ptr ?? 0
    shapes.info.needUpdate = true
    info.redraw++
    return () => {
      notesShape.view.hoveringNote$ = 0
      shapes.info.needUpdate = true
      info.redraw++
    }
  })

  $.fx(() => ([
    [canvas, 'mousemove', onMouseMove]
  ] as const).map(([el, name, handler]) =>
    dom.on(el, name, $.fn(handler))
  ))

  $.fx(() => {
    const { redraw } = info
    $()
    webgl.draw()
  })

  return { el: canvas }
}
