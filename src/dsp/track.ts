import wasmDsp from 'assembly'
import wasmPlayer from 'assembly-player'
import { $, Signal } from 'signal-jsx'
import { Rect } from 'std'
import { hueshift, luminate, saturate } from 'utils'
import { BUFFER_SIZE } from '../../as/assembly/dsp/constants.ts'
import { Dsp } from '../dsp/dsp.ts'
import { AstNode } from '../lang/interpreter.ts'
import { Token } from '../lang/tokenize.ts'
import { Source } from '../source.ts'
import { state } from '../state.ts'
import { Floats } from '../util/floats.ts'
import { createDemoNotes } from '../util/notes.ts'
import { hexToInt, intToHex, toHex } from '../util/rgb.ts'
import { Player } from './player.ts'
import { PlayerTrack } from './player-shared.ts'
import type { BoxData, Project, TrackData } from './project.ts'
import { audio } from '../audio.ts'

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
  data: BoxData
  source: $<Source<Token>>
  kind: TrackBoxKind
  rect: $<Rect>
  isFocused?: boolean
  isHovering?: boolean
}

export type Track = ReturnType<typeof Track>

export function Track(dsp: Dsp, project: Project, trackData: TrackData, y: number) {
  DEBUG && console.log('[track] create')

  using $ = Signal()
  const { clock } = dsp
  const sound = dsp.Sound()

  const ptData = wasmPlayer.alloc(Uint8Array, PlayerTrack.byteLength)
  const pt = PlayerTrack(ptData)
  const out_L = wasmPlayer.alloc(Float32Array, BUFFER_SIZE)
  const out_R = wasmPlayer.alloc(Float32Array, BUFFER_SIZE)
  const out_LR = wasmPlayer.alloc(Float32Array, BUFFER_SIZE)
  pt.out_L$ = out_L.ptr
  pt.out_R$ = out_R.ptr
  pt.out_LR$ = out_LR.ptr

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
    get width() {
      return this.right - this.left
    },
    get left() {
      return this.boxes.flat().reduce((p, n) =>
        n.rect.left < p
          ? n.rect.left
          : p,
        this.right
      )
    },
    get right() {
      return this.boxes.flat().reduce((p, n) =>
        n.rect.right > p
          ? n.rect.right
          : p,
        0
      )
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
    get notesData() {
      const { notes } = this
      $()
      const data = wasmDsp.alloc(Uint32Array, notes.length + 1)
      for (let i = 0; i < notes.length; i++) {
        data[i] = notes[i].data.ptr
      }
      return data
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

      const bg = hexToInt(luminate(toHex(state.colors['base-100'] ?? '#333'), .05))
      const bg2 = hexToInt(luminate(toHex(state.colors['base-100'] ?? '#333'), -.01))
      const bgHover = hexToInt(luminate(toHex(state.colors['base-100'] ?? '#333'), -.01))
      const bgHover2 = hexToInt(luminate(toHex(state.colors['base-100'] ?? '#333'), -.04))
      const fg = hexToInt(toHex(state.colors['base-content'] ?? '#fff'))

      return {
        bg, //: y % 2 === 0 ? bg : bg2,
        bgHover, //: y % 2 === 0 ? bgHover : bgHover2,
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

  const renderedEpoch = new Map<Source<Token>, number>()
  function renderSource(source: Source<Token>) {
    if (source.epoch === renderedEpoch.get(source)) return

    const { audioLength } = info
    if (!audioLength) return

    try {
      sound.reset()

      clock.time = 0
      clock.barTime = 0
      clock.bpm = 144

      wasmDsp.updateClock(clock.ptr)

      const { program, out, updateScalars } = sound.process(source.tokens)

      info.tokensAstNode = program.value.tokensAstNode
      info.waveLength = Math.floor(audioLength * clock.sampleRate / clock.coeff)
      const f = wasmPlayer.alloc(Float32Array, info.waveLength)

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

            updateScalars()

            chunkCount++
          }

          const chunk = sound.getAudio(out.LR.audio$).subarray(0, end)
          f.set(chunk, x)
        }

      info.floats?.free()
      info.floats = Floats(f)

      // update bars
      pt.len = f.length
      pt.offset = 0
      pt.coeff = 1.0
      pt.pan = 0.0
      pt.vol = 1.0
      pt.floats_LR$ = f.ptr

      // bar[y] = pt.ptr
      // console.log(player.bars, bar)

      info.audioBuffer.getChannelData(0).set(f)

      renderedEpoch.set(source, source.epoch)
    }
    catch (e) {
      if (e instanceof Error) {
        console.warn(e)
        console.warn(...((e as any)?.cause?.nodes ?? []))
        info.error = e
      }
      throw e
    }
  }

  $.fx(function update_audio_buffer() {
    const sources = new Set<Source<Token>>()

    for (const { source } of info.boxes) {
      sources.add(source)
    }

    $()

    {
      using $ = Signal()

      for (const source of sources) {
        $.fx(() => {
          const { epoch } = source
          $()
          renderSource(source)
        })
      }

      // const { audioLength } = info
      // if (!audioLength) return
      // $()

      return $.dispose
    }
  })

  function addBox(source: Source, box: BoxData) {
    const proto = { track }

    const y = track.info.y

    const trackBox = $({
      __proto__: proto,
      data: box,
      kind: y % 3 === 2 ? TrackBoxKind.Audio : TrackBoxKind.Notes,
      rect: $(new Rect, { x: box.time, y, w: box.length, h: 1 }),
      source,
      isFocused: false,
      isHovering: false,
    }) as $<TrackBox & { __proto__: typeof proto }>

    for (let x = box.time; x < box.time + box.length; x++) {
      const bar = audio.player.bars[x]
      bar[bar.indexOf(0)] = track.pt.ptr
    }

    track.info.boxes = [...track.info.boxes, trackBox]
  }

  function removeBox(trackBox: TrackBox) {
    const box = trackBox.data
    for (let x = box.time; x < box.time + box.length; x++) {
      const bar = audio.player.bars[x]
      const values = bar.slice(0, bar.indexOf(0))
        .filter(ptr => ptr !== track.pt.ptr)
      bar.fill(0)
      bar.set(values)
    }
    track.info.boxes = [...track.info.boxes].filter(tb => tb !== trackBox)
  }

  function play() {
    const { audioBuffer } = info
    const bufferSource = dsp.ctx.createBufferSource()
    bufferSource.buffer = audioBuffer
    bufferSource.connect(dsp.ctx.destination)
    bufferSource.start()
  }

  const track = { info, project, data: trackData, pt, addBox, removeBox, play }
  return track
}
