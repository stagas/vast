// @ts-ignore
self.document = {
  querySelectorAll() { return [] as any },
  baseURI: location.origin
}

import wasmDsp from 'assembly-dsp'
import { rpc } from 'utils'
import { BUFFER_SIZE } from '../../as/assembly/dsp/constants.ts'
import { AstNode } from '../lang/interpreter.ts'
import { Token, tokenize } from '../lang/tokenize.ts'
import { Note } from '../util/notes-shared.ts'
import { Dsp, Sound } from './dsp'

export type DspWorker = typeof worker

const sounds = new Map<number, Sound>()

let buffersLru = new Set<Float32Array & { ptr: number, free(): void }>()

const worker = {
  dsp: null as null | Dsp,
  tokensAstNode: new Map<Token, AstNode>(),
  waveLength: 1,
  error: null as Error | null,
  async createDsp(sampleRate: number) {
    const dsp = this.dsp = Dsp({ sampleRate })
    return {
      memory: wasmDsp.memory,
      clock$: dsp.clock.ptr,
    }
  },
  async createSound() {
    const dsp = this.dsp
    if (!dsp) {
      throw new Error('Dsp not ready.')
    }
    const sound = dsp.Sound()
    sounds.set(+sound.sound$, sound)
    return +sound.sound$ as number
  },
  async renderSource(sound$: number, audioLength: number, code: string, voicesCount: number, notes: Note[]) {
    const dsp = this.dsp
    if (!dsp) {
      throw new Error('Dsp not ready.')
    }

    const sound = sounds.get(sound$)
    if (!sound) {
      throw new Error('Sound not found, id: ' + sound$)
    }

    const { clock } = dsp
    const info = this

    try {
      const tokens = [...tokenize({ code })]

      sound.reset()

      clock.time = 0
      clock.barTime = 0
      clock.bpm = 144

      wasmDsp.updateClock(clock.ptr)

      const { program, out, updateScalars, updateVoices } = sound.process(tokens, voicesCount)

      info.tokensAstNode = program.value.tokensAstNode

      const length = Math.floor(audioLength * clock.sampleRate / clock.coeff)
      const floats = wasmDsp.alloc(Float32Array, length)

      buffersLru.add(floats)

      if (buffersLru.size > 10) {
        const [first, ...rest] = buffersLru
        first.free()
        buffersLru = new Set(rest)
      }

      // TODO: free

      /////////////////////////////
      const CHUNK_SIZE = 64
      let chunkCount = 0

      updateScalars()
      updateVoices(notes, clock.barTime, clock.barTime + clock.barTimeStep * CHUNK_SIZE)

      sound.data.begin = 0
      sound.data.end = 0
      sound.run()

      if (out.LR)
        for (let x = 0; x < floats.length; x += BUFFER_SIZE) {
          const end = x + BUFFER_SIZE > floats.length ? floats.length - x : BUFFER_SIZE

          for (let i = 0; i < end; i += CHUNK_SIZE) {
            updateScalars()
            updateVoices(notes, clock.barTime, clock.barTime + clock.barTimeStep * CHUNK_SIZE)

            sound.data.begin = i
            sound.data.end = i + CHUNK_SIZE > end ? end - i : i + CHUNK_SIZE
            sound.run()

            clock.time = (chunkCount * CHUNK_SIZE) * clock.timeStep
            clock.barTime = (chunkCount * CHUNK_SIZE) * clock.barTimeStep

            chunkCount++
          }

          const chunk = sound.getAudio(out.LR.audio$).subarray(0, end)
          floats.set(chunk, x)
        }

      return { floats }
      // info.floats?.free()
      // info.floats = Floats(f)

      // // update bars
      // pt.len = f.length
      // pt.offset = 0
      // pt.coeff = 1.0
      // pt.pan = 0.0
      // pt.vol = 1.0
      // pt.floats_LR$ = f.ptr

      /////////////////////////////////////

      // bar[y] = pt.ptr
      // console.log(player.bars, bar)

      // info.audioBuffer.getChannelData(0).set(f)
      //
      // renderedEpoch.set(source, source.epoch)
    }
    catch (e) {
      if (e instanceof Error) {
        console.warn(e)
        console.warn(...((e as any)?.cause?.nodes ?? []))
        info.error = e
      }
      throw e
    }

  },
}

const host = rpc<{ isReady(): void }>(self as any, worker)
host.isReady()
console.log('started')
