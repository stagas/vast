// auto-generated from scripts
import { Op } from '../assembly/dsp-op.ts'

type usize = number
type i32 = number
type u32 = number
type f32 = number

export function createVm(ctx$: number, ops: Int32Array) {
  const ops_i32 = ops
  const ops_u32 = new Uint32Array(ops.buffer, ops.byteOffset, ops.length)
  const ops_f32 = new Float32Array(ops.buffer, ops.byteOffset, ops.length)
  let i = 0
  return {
    Begin(): void {
      i = 0
    },
    End(): number {
      ops_u32[i++] = 0
      return i
    },
    CreateGen(kind_index: i32): void {
      ops_u32[i++] = Op.CreateGen
      ops_u32[i++] = ctx$
      ops_i32[i++] = kind_index
    },
    CreateAudios(count: i32): void {
      ops_u32[i++] = Op.CreateAudios
      ops_u32[i++] = ctx$
      ops_i32[i++] = count
    },
    CreateValues(count: i32): void {
      ops_u32[i++] = Op.CreateValues
      ops_u32[i++] = ctx$
      ops_i32[i++] = count
    },
    AudioToScalar(audio$: i32, scalar$: i32): void {
      ops_u32[i++] = Op.AudioToScalar
      ops_u32[i++] = ctx$
      ops_i32[i++] = audio$
      ops_i32[i++] = scalar$
    },
    LiteralToAudio(literal$: i32, audio$: i32): void {
      ops_u32[i++] = Op.LiteralToAudio
      ops_u32[i++] = ctx$
      ops_i32[i++] = literal$
      ops_i32[i++] = audio$
    },
    Pick(list$: i32, list_length: i32, list_index_value$: i32, out_value$: i32): void {
      ops_u32[i++] = Op.Pick
      ops_u32[i++] = ctx$
      ops_i32[i++] = list$
      ops_i32[i++] = list_length
      ops_i32[i++] = list_index_value$
      ops_i32[i++] = out_value$
    },
    Pan(value$: i32): void {
      ops_u32[i++] = Op.Pan
      ops_u32[i++] = ctx$
      ops_i32[i++] = value$
    },
    SetValue(value$: i32, kind: i32, ptr: i32): void {
      ops_u32[i++] = Op.SetValue
      ops_u32[i++] = ctx$
      ops_i32[i++] = value$
      ops_i32[i++] = kind
      ops_i32[i++] = ptr
    },
    SetValueDynamic(value$: i32, scalar$: i32, audio$: i32): void {
      ops_u32[i++] = Op.SetValueDynamic
      ops_u32[i++] = ctx$
      ops_i32[i++] = value$
      ops_i32[i++] = scalar$
      ops_i32[i++] = audio$
    },
    SetProperty(gen$: i32, prop$: i32, kind: i32, value$: i32): void {
      ops_u32[i++] = Op.SetProperty
      ops_u32[i++] = ctx$
      ops_i32[i++] = gen$
      ops_i32[i++] = prop$
      ops_i32[i++] = kind
      ops_i32[i++] = value$
    },
    UpdateGen(gen$: i32): void {
      ops_u32[i++] = Op.UpdateGen
      ops_u32[i++] = ctx$
      ops_i32[i++] = gen$
    },
    ProcessAudio(gen$: i32, audio$: i32): void {
      ops_u32[i++] = Op.ProcessAudio
      ops_u32[i++] = ctx$
      ops_i32[i++] = gen$
      ops_i32[i++] = audio$
    },
    ProcessAudioStereo(gen$: i32, audio_0$: i32, audio_1$: i32): void {
      ops_u32[i++] = Op.ProcessAudioStereo
      ops_u32[i++] = ctx$
      ops_i32[i++] = gen$
      ops_i32[i++] = audio_0$
      ops_i32[i++] = audio_1$
    },
    BinaryOp(op: usize, lhs$: i32, rhs$: i32, out$: i32): void {
      ops_u32[i++] = Op.BinaryOp
      ops_u32[i++] = ctx$
      ops_u32[i++] = op
      ops_i32[i++] = lhs$
      ops_i32[i++] = rhs$
      ops_i32[i++] = out$
    }
  }
}