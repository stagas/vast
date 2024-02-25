import { Signal } from 'signal-jsx'
import { ShapeOpts } from '../../as/assembly/gfx/sketch-shared.ts'
import { ShapeData } from '../gl/sketch.ts'
import { Surface } from '../surface.ts'
import { Floats } from '../util/floats.ts'
import { waveform } from '../util/waveform.ts'

const DEBUG = true
const SCALE_X = 1

export type CodeDraw = ReturnType<typeof CodeDraw>

export function CodeDraw(surface: Surface) {
  using $ = Signal()

  const { anim, mouse, keyboard, view, intentMatrix, viewMatrix, sketch } = surface

  const floats = Floats(waveform)

  $.untrack(() => {
    viewMatrix.a = intentMatrix.a = viewMatrix.dest.a = 1000 //Math.max(12, targetView.w / (COLS * SCALE_X))
    viewMatrix.d = intentMatrix.d = viewMatrix.dest.d = 1 //targetView.h / ROWS
    viewMatrix.e = intentMatrix.e = viewMatrix.dest.e = 0
  })

  function write() {
    const wave = Array.from({ length: 8 }, (_, y) => [
      ShapeOpts.Wave,
      0, 19 + y * 70, 300, 80, // same dims as the box
      .1, // lw
      floats.ptr, // ptr
      waveform.length, // len
      0, // offset
      0xff00ff, // color
      1.0, // alpha
    ] as ShapeData.Wave).flat()

    sketch.shapes.count = 0
    sketch.write(Float32Array.from(wave))
    anim.info.epoch++
  }

  return { write }
}
