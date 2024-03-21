import { Signal } from 'signal-jsx'
import { Point, Rect } from 'std'
import { MouseButtons, clamp, dom } from 'utils'
import { ShapeOpts } from '../../as/assembly/gfx/sketch-shared.ts'
import { Grid } from '../draws/grid.ts'
import { Shapes, Sketch } from '../gl/sketch.ts'
import { layout } from '../layout.ts'
import { lib } from '../lib.ts'
import { screen } from '../screen.tsx'
import { services } from '../services.ts'
import { state } from '../state.ts'
import { LerpMatrix } from '../util/geometry.ts'
import { BoxNote, MAX_NOTE, createNote, getNotesScale } from '../util/notes.ts'
import { WebGL } from '../webgl.ts'
import { Mouse } from '../world/mouse.ts'
import { Canvas } from './Canvas.tsx'

const DEBUG = true

export type Preview = ReturnType<typeof Preview>

export function Preview(grid: Grid) {
  DEBUG && console.log('[preview] create')
  using $ = Signal()

  const view = $(new Rect(
    $(new Point, {
      x: layout.info.$.previewWidth,
      y: layout.info.$.codeHeight,
    }),
  ), {
    pr: screen.info.$.pr
  })

  const info = $({
    redraw: 0,
    mouseOffsetY: 0,
    get trackBox() {
      return lib?.project?.info?.activeTrackBox
    },
    isWheeling: false,
    hoverNoteMode: 'grab' as 'grab' | 'resize',
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

  const canvas = <Canvas actual view={view} onresize={onresize} class="
    absolute
    right-0
    bottom-0
    z-10
    pixelated
  " /> as Canvas

  const webglView = $(new Rect, { pr: screen.info.$.pr })
  const webgl = WebGL(webglView, canvas, true)
  const sketch = Sketch(webgl.GL, view)
  webgl.add($, sketch)

  const viewMatrix = $(new LerpMatrix)
  const shapes = Shapes(view, viewMatrix)
  sketch.scene.add(shapes)
  const rect = $({
    x: 0,
    y: 0,
    w: 1,
    h: 1,
  })
  $.fx(() => {
    const { pr } = screen.info
    const { previewWidth, codeWidth, codeHeight } = layout.info
    $()
    view.x = (canvas.width / pr) - previewWidth
    webglView.w = previewWidth
    webglView.h = codeHeight
    $.flush()
    shapes.info.needUpdate = true
  })
  $.fx(() => {
    const { w, h } = webglView
    const { trackBox } = $.of(info)
    const { length } = trackBox.data
    $()
    viewMatrix.a = (w / length) + 1
    viewMatrix.d = h
    rect.w = length
    shapes.info.needUpdate = true
  })

  const wave = shapes.Wave(rect)
  wave.view.color = 0xffffff

  const cols = shapes.Box(rect)
  cols.view.opts |= ShapeOpts.Cols
  cols.view.alpha = 0.5

  const notesShape = shapes.Notes(rect)
  notesShape.view.isFocused = 1

  function toFront(shape: any) {
    shapes.shapes.delete(shape)
    shapes.shapes.add(shape)
  }

  $.fx(() => {
    const { mode } = state
    $()
    toFront(wave)
    toFront(notesShape)
    toFront(cols)
    if (mode === 'notes') {
      toFront(notesShape)
      notesShape.view.alpha = 1.0
      wave.view.alpha = 0.25
    }
    else {
      toFront(wave)
      notesShape.view.alpha = 0.25
      wave.view.alpha = 1.0
    }
    shapes.info.needUpdate = true
  })

  $.fx(() => {
    const { trackBox: box } = $.of(info)
    const { track } = box
    const { colors } = track.info
    const { primaryColorInt } = screen.info
    $()
    notesShape.view.color = colors.colorBrighter //isFocused && !dimmed ? colors.colorBright : colors.fg
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
  })

  const mouse = Mouse(webglView, viewMatrix)
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
    const resizeWidth = 10 / (view.w / (16 * box.data.length))

    let found = false
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i]
      const { n, time, length } = note.info
      if (n !== hn) continue
      if (x >= time && x < time + length) {
        if (x >= time + length - resizeWidth) {
          info.hoverNoteMode = 'resize'
        }
        else {
          info.hoverNoteMode = 'grab'
        }
        info.hoveringNote = note
        found = true
        break
      }
    }
    if (!found) {
      info.hoveringNote = null
    }
  }

  function updateMousePos(e: MouseEvent) {
    mouse.pos.setFromEvent(e, canvas)
    // mouse.pos.y -= info.mouseOffsetY
  }

  function onMouseMove(e: MouseEvent) {
    info.isWheeling = false
    if (info.draggingNote) return
    updateMousePos(e)
    updateHoveringNote()
  }

  function onWheel(e: WheelEvent) {
    info.isWheeling = true
    updateMousePos(e)
    updateHoveringNote()
    if (info.hoveringNote) {
      info.hoveringNote.info.vel = clamp(0, 1,
        info.hoveringNote.info.vel + e.deltaY * 0.001
      )
      shapes.info.needUpdate = true
      grid.info.redraw++
    }
  }

  let lastClickedNote: BoxNote | null

  function onMouseDown(e: MouseEvent) {
    updateMousePos(e)
    updateHoveringNote()

    if (e.buttons & MouseButtons.Right) {
      const { trackBox: box } = info
      if (box) {
        box.track.info.notes = box.track.info.notes.filter(note =>
          note !== info.hoveringNote
        )
        // TODO: start deleting
        info.hoveringNote = null
      }
      return
    }

    if (info.hoveringNote) {
      lastClickedNote = info.hoveringNote
      // TODO: right click start deleting
      // TODO: ctrl(alt?) click play notes vertical realtime

      if (info.hoverNoteMode === 'resize') {
        const note = info.draggingNote = info.hoveringNote

        screen.info.overlay = true
        screen.info.cursor = 'ew-resize'

        const off = dom.on(window, 'mousemove', $.fn((e: MouseEvent) => {
          updateMousePos(e)
          updateHoveringNoteN()
          note.info.length = Math.max(1, Math.round(notePos.x - note.info.time))
          shapes.info.needUpdate = true
        }), { capture: true })

        dom.on(window, 'mouseup', $.fn((e: MouseEvent) => {
          off()
          screen.info.overlay = false
          screen.info.cursor = 'default'
          info.hoveringNote = info.draggingNote = null
          $.flush()
          updateMousePos(e)
          updateHoveringNote()
          shapes.info.needUpdate = true
        }), { capture: true, once: true })
      }
      else if (info.hoverNoteMode === 'grab') {
        const note = info.draggingNote = info.hoveringNote

        const offsetX = Math.floor(notePos.x - note.info.time)
        screen.info.overlay = true
        screen.info.cursor = 'move'

        const off = dom.on(window, 'mousemove', $.fn((e: MouseEvent) => {
          updateMousePos(e)
          updateHoveringNoteN()
          note.info.n = info.hoveringNoteN
          note.info.time = Math.max(0, Math.floor(notePos.x - offsetX))
          shapes.info.needUpdate = true
        }), { capture: true })

        dom.on(window, 'mouseup', $.fn((e: MouseEvent) => {
          off()
          screen.info.overlay = false
          screen.info.cursor = 'default'
          info.hoveringNote = info.draggingNote = null
          $.flush()
          updateMousePos(e)
          updateHoveringNote()
          shapes.info.needUpdate = true
        }), { capture: true, once: true })
      }
    }
    else {
      const note = createNote(
        info.hoveringNoteN,
        Math.floor(notePos.x),
        lastClickedNote?.data.length ?? 1,
        lastClickedNote?.data.vel ?? 1,
      )
      const { trackBox: box } = info
      if (box) {
        box.track.info.notes = [...box.track.info.notes, note]
      }
    }
  }

  $.fx(() => {
    const { hoveringNote, hoverNoteMode } = info
    $()
    if (hoveringNote) {
      if (hoverNoteMode === 'resize') {
        screen.info.cursor = 'ew-resize'
      }
      else {
        screen.info.cursor = 'default'
      }
    }
    else {
      screen.info.cursor = 'default'
    }
  })

  $.fx(() => {
    const { hoveringNote, isWheeling } = info
    $()

    notesShape.view.hoveringNote$ = isWheeling ? 0 : (hoveringNote?.data.ptr ?? 0)
    shapes.info.needUpdate = true
    return () => {
      notesShape.view.hoveringNote$ = 0
      shapes.info.needUpdate = true
    }
  })

  $.fx(() => ([
    [canvas, 'wheel', onWheel as any],
    [canvas, 'mousemove', onMouseMove],
    [canvas, 'mousedown', onMouseDown],
    [canvas, 'contextmenu', (e: Event) => dom.stop.prevent(e)]
  ] as const).map(([el, name, handler]) =>
    dom.on(el, name, $.fn(handler))
  ))

  $.fx(() => {
    const { needUpdate } = shapes.info
    const { redraw } = info
    $()
    webgl.draw()
  })

  return { el: canvas }
}
