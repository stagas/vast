import wasm from 'assembly'
import { $, Signal } from 'signal-jsx'
import { Rect } from 'std'
import { BUFFER_SIZE } from '../../as/assembly/dsp/constants.ts'
import { Dsp } from '../dsp/dsp.ts'
import { Shape } from '../gl/sketch.ts'
import { AstNode } from '../lang/interpreter.ts'
import { Token } from '../lang/tokenize.ts'
import { Source } from '../source.ts'
import { state } from '../state.ts'
import { Floats } from '../util/floats.ts'
// import { BoxData } from '../draws/grid.ts'
import { saturate, luminate, hueshift } from 'utils'
import { intToHex, hexToInt, toHex } from '../util/rgb.ts'
import { createDemoNotes } from '../util/notes.ts'

const DEBUG = true

const palette = [
  0xff5555,
  0x1188ff,
  0xbb55b0,
  0x44aa99,
]

export const enum TrackBoxKind {
  Audio,
  Notes,
}

export interface TrackBox {
  track: Track
  kind: TrackBoxKind
  rect: $<Rect>
  // data?: BoxData
  isFocused?: boolean
  isHovering?: boolean
}

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
    get audioLength() {
      let max = 0
      for (const { kind, rect } of this.boxes) {
        // if (kind === TrackBoxKind.Audio) {
          if (rect.w > max) max = rect.w
        // }
      }
      return max
    },
    waveLength: 1, // computed during effect update_audio_buffer
    get audioBuffer() {
      return dsp.ctx.createBuffer(1, this.waveLength, dsp.ctx.sampleRate)
    },
    tokensAstNode: new Map<Token, AstNode>(),
    boxes: [] as TrackBox[],
    error: null as Error | null,
    floats: null as Floats | null,
    get notes() {
      $()
      const notes = createDemoNotes()
      return notes
    },
    get color() {
      return Math.floor(palette[this.y % palette.length])
    },
    get colors() {
      const { y, color } = this
      const hexColor = intToHex(color)
      const hexColorBright = saturate(luminate(hexColor, .015), 0.1)
      const hexColorInvDark = luminate(saturate(hueshift(hexColor, 180), -1), -.45)
      const hexColorDark = luminate(saturate(hexColor, -.01), -.35)
      const hexColorBrighter = saturate(luminate(hexColor, .0030), 0.02)
      const hexColorBrightest = saturate(luminate(hexColor, .01), 0.02)
      const colorBright = hexToInt(hexColorBright)
      const colorBrighter = hexToInt(hexColorBrighter)
      const colorBrightest = hexToInt(hexColorBrightest)
      const colorDark = hexToInt(hexColorDark)

      const bg = hexToInt(luminate(toHex(state.colors['base-100'] ?? '#333'), .09))
      const bg2 = hexToInt(luminate(toHex(state.colors['base-100'] ?? '#333'), .05))
      const bgHover = hexToInt(luminate(toHex(state.colors['base-100'] ?? '#333'), -.01115))
      const fg = hexToInt(toHex(state.colors['base-content'] ?? '#fff'))

      return {
        bg: y % 2 === 0 ? bg : bg2,
        bgHover,
        fg,
        color,
        hexColor,
        hexColorBright,
        hexColorBrighter,
        hexColorBrightest,
        hexColorDark,
        colorBright,
        colorBrighter,
        colorBrightest,
        colorDark,
      }
    },
  })

  function play() {
    const { audioBuffer } = info
    const bufferSource = dsp.ctx.createBufferSource()
    bufferSource.buffer = audioBuffer
    bufferSource.connect(dsp.ctx.destination)
    bufferSource.start()
  }

  $.fx(function update_audio_buffer() {
    const { tokens } = source
    const { audioLength } = info
    if (!audioLength) return
    $()
    try {
      sound.reset()

      clock.time = 0
      clock.barTime = 0
      clock.bpm = 120

      wasm.updateClock(clock.ptr)

      const { program, out, updateClock } = sound.process(tokens)

      info.tokensAstNode = program.value.tokensAstNode
      info.waveLength = Math.floor(audioLength * clock.sampleRate * clock.coeff * 4)
      const f = new Float32Array(info.waveLength)

      sound.data.begin = 0
      sound.data.end = 0
      sound.run()

      const CHUNK_SIZE = 64
      let chunkCount = 0

      if (out.LR)
        for (let x = 0; x < f.length; x += BUFFER_SIZE) {
          const end = x + BUFFER_SIZE > f.length ? f.length - x : BUFFER_SIZE

          for (let i = 0; i < end; i += CHUNK_SIZE) {
            sound.data.begin = i
            sound.data.end = i + CHUNK_SIZE > end ? end - i : i + CHUNK_SIZE
            sound.run()

            clock.time = (chunkCount * CHUNK_SIZE) * clock.timeStep
            clock.barTime = (chunkCount * CHUNK_SIZE) * clock.barTimeStep

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
