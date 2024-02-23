import wasm from 'assembly'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { Dsp } from '../dsp/dsp.ts'
import { AstNode } from '../lang/interpreter.ts'
import { Token } from '../lang/tokenize.ts'
import { Source } from '../source.ts'
import { Floats } from '../util/floats.ts'
import { Box } from '../../as/assembly/gfx/sketch-shared.ts'
import { ShapeData } from '../gl/sketch.ts'
import { BUFFER_SIZE } from '../../as/assembly/dsp/constants.ts'

const DEBUG = true

export type Track = ReturnType<typeof Track>

export function Track(dsp: Dsp, source: Source<Token>) {
  DEBUG && console.log('[track] create')

  using $ = Signal()
  const { clock } = dsp
  const sound = dsp.Sound()

  const info = $({
    y: 0,
    boxes: [] as { rect: Rect, shape?: ShapeData.Box | null }[],
    get length() {
      let max = 0
      for (const { rect } of this.boxes) {
        if (rect.w > max) max = rect.w
      }
      return max
    },
    tokensAstNode: new Map<Token, AstNode>(),
    error: null as Error | null,
    floats: null as Floats | null,
  })

  $.fx(() => {
    const { tokens } = source
    const { length } = info
    if (!length) return
    $()
    try {
      sound.reset()
      clock.bpm = 60
      wasm.updateClock(clock.ptr)
      const { program, out, updateClock } = sound.process(tokens)
      info.tokensAstNode = program.value.tokensAstNode

      const f = new Float32Array(Math.floor(length * clock.sampleRate * clock.coeff))
      sound.data.begin = 0
      sound.data.end = 0
      sound.run()

      if (out.LR)
        for (let x = 0; x < f.length; x += BUFFER_SIZE) {
          const end = x + BUFFER_SIZE > f.length ? f.length - x : BUFFER_SIZE

          for (let i = 0; i < end; i += 64) {
            sound.data.begin = i
            sound.data.end = i + 64 > end ? end - i : i + 64
            sound.run()

            clock.time += 64 * clock.timeStep
            clock.barTime += 64 * clock.barTimeStep

            updateClock()
          }

          f.set(sound.getAudio(out.LR.audio$).subarray(0, end), x)
        }

      info.floats?.free()
      info.floats = Floats(f)
    }
    catch (e) {
      if (e instanceof Error) {
        console.warn(e)
        console.warn(...((e as any)?.cause?.nodes ?? []))
        info.error = e
      }
      throw e
    }
  })

  return { info }
}

// function Waves(boxes: ReturnType<typeof Boxes>) {
//   if (!floats) {
//     floats = Floats(waveform)
//   }

//   function update(ptr: number, highlightBox?: BoxData) {
//     return boxes.rows
//       .filter((_, y) => y % 2 === 1)
//       .map(cols =>
//         cols.map(box => {

//           const [, x, y, w, h] = box

//           let color: number = 0x0

//           if (box.data) {
//             color = highlightBox === box.data
//               ? box.data.colorBrighter
//               : 0x0
//           }

//           const f = [
//             ShapeOpts.Wave,
//             x, y, w, h, // same dims as the box
//             1, // lw
//             ptr, // ptr
//             2048, // len
//             color, // color
//             1.0, // alpha
//           ] as ShapeData.Wave

//           box.data.floats = f

//           return f
//         }).flat()
//       ).flat()
//   }

//   const data = new Float32Array(update(floats.ptr))

//   return { data, update }
// }
