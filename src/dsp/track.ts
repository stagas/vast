import wasm from 'assembly'
import { $, Signal } from 'signal-jsx'
import { Rect } from 'std'
import { BUFFER_SIZE } from '../../as/assembly/dsp/constants.ts'
import { Dsp } from '../dsp/dsp.ts'
import { ShapeData } from '../gl/sketch.ts'
import { AstNode } from '../lang/interpreter.ts'
import { Token } from '../lang/tokenize.ts'
import { Source } from '../source.ts'
import { state } from '../state.ts'
import { Floats } from '../util/floats.ts'
import { BoxData } from '../draws/grid.ts'

const DEBUG = true

export type Track = ReturnType<typeof Track>

export function Track(dsp: Dsp, source: $<Source<Token>>, y: number) {
  DEBUG && console.log('[track] create')

  using $ = Signal()
  const { clock } = dsp
  const sound = dsp.Sound()

  const info = $({
    y,
    get sy() {
      const { y } = this
      const { pr } = state
      const { d, f } = state.viewMatrix
      $()
      return y * d * pr + f * pr
    },
    boxes: [] as { rect: Rect, shape?: ShapeData.Box | null }[],
    get length() {
      let max = 0
      for (const { rect } of this.boxes) {
        if (rect.w > max) max = rect.w
      }
      return max
    },
    waveLength: 1,
    get audioBuffer() {
      return dsp.ctx.createBuffer(1, this.waveLength, dsp.ctx.sampleRate)
    },
    tokensAstNode: new Map<Token, AstNode>(),
    error: null as Error | null,
    floats: null as Floats | null,
    shape: null as (ShapeData.Box & { data: BoxData }) | null,
  })

  function play() {
    const { audioBuffer } = info
    const bufferSource = dsp.ctx.createBufferSource()
    bufferSource.buffer = audioBuffer
    bufferSource.connect(dsp.ctx.destination)
    bufferSource.start()
  }

  $.fx(() => {
    const { tokens } = source
    const { length } = info
    if (!length) return
    $()
    try {
      sound.reset()

      clock.time = 0
      clock.barTime = 0
      clock.bpm = 120

      wasm.updateClock(clock.ptr)

      const { program, out, updateClock } = sound.process(tokens)

      info.tokensAstNode = program.value.tokensAstNode
      info.waveLength = Math.floor(length * clock.sampleRate * clock.coeff * 4)
      const f = new Float32Array(info.waveLength)

      sound.data.begin = 0
      sound.data.end = 0
      sound.run()

      let chunkCount = 0

      if (out.LR)
        for (let x = 0; x < f.length; x += BUFFER_SIZE) {
          const end = x + BUFFER_SIZE > f.length ? f.length - x : BUFFER_SIZE

          for (let i = 0; i < end; i += 64) {
            sound.data.begin = i
            sound.data.end = i + 64 > end ? end - i : i + 64
            sound.run()

            clock.time = (chunkCount * 64) * clock.timeStep
            clock.barTime = (chunkCount * 64) * clock.barTimeStep

            updateClock()

            chunkCount++
          }

          const chunk = sound.getAudio(out.LR.audio$).subarray(0, end)
          f.set(chunk, x)
        }

      info.floats?.free()
      info.floats = Floats(f)
      info.audioBuffer.getChannelData(0).set(f)
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

  return { info, source, play }
}
