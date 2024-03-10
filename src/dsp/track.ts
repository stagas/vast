import wasmGfx from 'assembly-gfx'
import wasmSeq from 'assembly-seq'
import { $, Signal } from 'signal-jsx'
import { Rect } from 'std'
import { Lru, hueshift, luminate, saturate } from 'utils'
import { BUFFER_SIZE } from '../../as/assembly/dsp/constants.ts'
import { AstNode } from '../lang/interpreter.ts'
import { Token } from '../lang/tokenize.ts'
import { services } from '../services.ts'
import { Source } from '../source.ts'
import { state } from '../state.ts'
import { Floats } from '../util/floats.ts'
import { Note } from '../util/notes-shared.ts'
import { createDemoNotes } from '../util/notes.ts'
import { hexToInt, intToHex, toHex } from '../util/rgb.ts'
import { DspService } from './dsp-service.ts'
import { PlayerTrack } from './player-shared.ts'
import type { BoxData, TrackData } from './project.ts'

const DEBUG = true

const palette = [
  0xff5555,
  0x1188ff,
  0xbb55b0,
  0x44aa99,
]

export interface TrackBox {
  track: Track
  rect: $<Rect>
  info: $<{
    source: $<Source<Token>>
    isFocused: boolean
    isHovering: boolean
  }>
  data: $<BoxData>
}

export function TrackBox(track: Track, source: $<Source<Token>>, box: $<BoxData>, rect?: $<Rect>): TrackBox {
  using $ = Signal()

  rect ??= $(new Rect, {
    x: box.$.time,
    y: track.info.$.y,
    w: box.$.length,
    h: 1
  })

  const info = $({
    source,
    isFocused: false,
    isHovering: false,
  })

  const proto = { track }
  return { __proto__: proto, rect, info, data: box } as TrackBox & { __proto__: typeof proto }
}

export type Track = ReturnType<typeof Track>

export function Track(dsp: DspService, trackData: TrackData, y: number) {
  DEBUG && console.log('[track] create')

  using $ = Signal()

  const pt = PlayerTrack(wasmSeq.memory.buffer, wasmSeq.createPlayerTrack())
  const out_L = wasmSeq.alloc(Float32Array, BUFFER_SIZE)
  const out_R = wasmSeq.alloc(Float32Array, BUFFER_SIZE)
  const out_LR = wasmSeq.alloc(Float32Array, BUFFER_SIZE)
  pt.out_L$ = out_L.ptr
  pt.out_R$ = out_R.ptr
  pt.out_LR$ = out_LR.ptr

  const info = $({
    y,
    sound$: $.unwrap(() => dsp.ready.then(() => dsp.service.createSound())),
    get sy() {
      const { y } = this
      const { pr } = state
      const { d, f } = state.viewMatrix
      $()
      return y * d * pr + f * pr
    },
    get audioLength() {
      let max = 0
      for (const { rect } of this.boxes) {
        if (rect.w > max) max = rect.w
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
      return services.audio.ctx.createBuffer(1, this.waveLength, services.audio.ctx.sampleRate)
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
    get notesJson() {
      const { notes } = this
      return notes.map(({ info: note }) => ({
        n: note.n,
        time: note.time,
        length: note.length,
        vel: note.vel,
      }))
    },
    get notesData() {
      const { notes } = this
      $()
      const data = wasmGfx.alloc(Uint32Array, notes.length + 1)
      for (let i = 0; i < notes.length; i++) {
        data[i] = notes[i].data.ptr
      }
      return data
    },
    get voicesCount() {
      const { notes } = this
      $()
      const times = new Map<number, Note[]>()
      let count = 0
      for (const { info: note } of notes) {
        let pressed = times.get(note.time)
        if (!pressed) times.set(note.time, pressed = [])
        pressed.push(note)
        count = Math.max(pressed.length, count)
      }
      return count
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

  const getFloats = Lru(10, length => wasmSeq.alloc(Float32Array, length), item => item.fill(0), item => item.free())

  let isRendering = false
  let toRender = new Set<Source<Token>>()

  async function renderSource(source: Source<Token>) {
    if (isRendering) {
      toRender.add(source)
      return
    }

    if (source.code == null || source.epoch === renderedEpoch.get(source)) return

    const { sound$, audioLength } = info
    if (!sound$ || !audioLength) return

    const { voicesCount, notesJson } = info

    isRendering = true
    try {
      const { floats: dspFloats, error } = await dsp.service.renderSource(
        sound$,
        audioLength,
        source.code,
        voicesCount,
        source.tokens.some(t => t.text === 'midi_in'),
        notesJson,
      )

      if (error || !dspFloats) {
        throw new Error(error || 'renderSource failed.')
      }

      info.waveLength = dspFloats.length

      const floats = getFloats(dspFloats.length)
      floats.set(dspFloats)

      info.floats?.free()
      info.floats = Floats(floats)

      pt.len = floats.length
      pt.offset = 0
      pt.coeff = 1.0
      pt.pan = 0.0
      pt.vol = 1.0
      pt.floats_LR$ = floats.ptr

      info.audioBuffer.getChannelData(0).set(floats)

      renderedEpoch.set(source, source.epoch)
    }
    finally {
      isRendering = false
      if (toRender.size) {
        const [first, ...rest] = toRender
        toRender = new Set(rest)
        renderSource(first)
      }
    }
  }

  $.fx(function update_audio_buffer() {
    const sources = new Set<Source<Token>>()

    for (const { info: { source } } of info.boxes) {
      sources.add(source)
    }

    $()

    {
      using $ = Signal()

      for (const source of sources) {
        $.fx(() => {
          const { voicesCount, notes } = info
          for (const note of notes) {
            const { n, time, length, vel } = note.info
          }
          $()
          source.epoch++
        })
        $.fx(() => {
          const { sound$ } = info
          const { epoch } = source
          $()
          const { voicesCount, notesJson } = info
          renderSource(source)
        })
      }

      return $.dispose
    }
  })

  function addBox(source: $<Source<Token>>, box: $<BoxData>) {
    const trackBox = TrackBox(track, source, box)
    track.info.boxes = [...track.info.boxes, trackBox]
  }

  function removeBox(trackBox: TrackBox) {
    track.info.boxes = [...track.info.boxes].filter(tb => tb !== trackBox)
  }

  function play() {
    const { audioBuffer } = info
    const bufferSource = services.audio.ctx.createBufferSource()
    bufferSource.buffer = audioBuffer
    bufferSource.connect(services.audio.ctx.destination)
    bufferSource.start()
  }

  const track = { info, data: trackData, pt, addBox, removeBox, play }
  return track
}
