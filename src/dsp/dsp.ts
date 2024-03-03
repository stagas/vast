import wasm from 'assembly'
import { Signal } from 'signal-jsx'
import { Struct, fromEntries, getMemoryView, keys } from 'utils'
import { BUFFER_SIZE, MAX_LISTS, MAX_LITERALS, MAX_SCALARS } from '../../as/assembly/dsp/constants.ts'
import { DspBinaryOp, SoundData as SoundDataShape } from '../../as/assembly/dsp/vm/dsp-shared.ts'
import { Gen, dspGens } from '../../generated/typescript/dsp-gens.ts'
import { createVm } from '../../generated/typescript/dsp-vm.ts'
import { AstNode, interpret } from '../lang/interpreter.ts'
import { Token, tokenize } from '../lang/tokenize.ts'
import { parseNumber } from '../lang/util.ts'
import { Clock } from './dsp-shared.ts'
import { getAllProps } from './util.ts'
import { Value } from './value.ts'

const DEBUG = false

const MAX_OPS = 4096

const SoundData = Struct({
  begin: 'i32',
  end: 'i32',
  pan: 'f32',
})

const dspGensKeys = keys(dspGens)

export type Dsp = ReturnType<typeof Dsp>
export type Sound = ReturnType<Dsp['Sound']>
export type SoundContext = ReturnType<typeof getContext>

function getContext() {
  return {
    gens: 0,
    values: 0,
    floats: 0,
    scalars: 0,
    audios: 0,
    literals: 0,
    literalsf: null as unknown as Float32Array,
    lists: 0,
    listsi: null as unknown as Int32Array,
  }
}

const tokensCopyMap = new Map<Token, Token>()
const tokensCopyRevMap = new Map<Token, Token>()
function copyToken(token: Token) {
  const newToken = { ...token }
  tokensCopyMap.set(token, newToken)
  tokensCopyRevMap.set(newToken, token)
  return newToken
}

let preludeTokens: Token[]

export function Dsp(ctx: AudioContext, {
  core$
}: {
  core$?: ReturnType<typeof wasm.createCore>
} = {}) {
  using $ = Signal()

  core$ ??= wasm.createCore(ctx.sampleRate)
  const pin = <T>(x: T): T => { wasm.__pin(+x); return x }
  const engine$ = wasm.createEngine(ctx.sampleRate, core$)
  const clock$ = wasm.getEngineClock(engine$)
  const clock = Clock(wasm.memory.buffer, clock$)

  const info = $({
    tokensAstNode: new Map<Token, AstNode>(),
    error: null as null | Error,
  })

  const view = getMemoryView(wasm.memory)

  preludeTokens ??= [...tokenize({
    code:
      // we implicit call [nrate 1] before our code
      // so that the sample rate is reset.
      `[nrate 1]`
      // some builtin procedures
      + `{ .5* .5+ } norm=`
      + `{ n= p= sp= 1 [inc sp co* t n*] clip - p^ * } decay=
`
  })]

  function Sound() {
    const sound$ = wasm.createSound(engine$)

    const data$ = wasm.getSoundData(sound$)
    const data = SoundData(wasm.memory.buffer, +data$) satisfies SoundDataShape
    const context = getContext()

    const ops = wasm.alloc(Int32Array, MAX_OPS)
    const vm = createVm(ops)
    const setup_ops = wasm.alloc(Int32Array, MAX_OPS)
    const setup_vm = createVm(setup_ops)

    const lists$ = wasm.getSoundLists(sound$)
    const lists = view.getI32(lists$, MAX_LISTS)
    context.listsi = lists

    const scalars$ = wasm.getSoundScalars(sound$)
    const scalars = view.getF32(scalars$, MAX_SCALARS)

    const literals$ = wasm.getSoundLiterals(sound$)
    const literals = view.getF32(literals$, MAX_LITERALS)
    const preset = createLiteralsPreset(literals)
    preset.set()

    function reset() {
      wasm.resetSound(sound$)
    }

    function prepare() {
      context.gens =
        context.audios =
        context.literals =
        context.floats =
        context.scalars =
        context.lists =
        context.values =
        0
    }

    function run() {
      wasm.dspRun(sound$, ops.ptr)
    }

    function commit() {
      vm.End()
    }

    function setup() {
      setup_vm.CreateAudios(context.audios)
      setup_vm.CreateValues(context.values)
      setup_vm.End()
      wasm.dspRun(sound$, setup_ops.ptr)
    }

    function getAudio(index: number) {
      const ptr = wasm.getSoundAudio(sound$, index)
      const audio = view.getF32(ptr, BUFFER_SIZE)
      return audio
    }

    function createLiteralsPreset(
      literals: Float32Array = wasm.alloc(Float32Array, MAX_LITERALS)
    ) {
      function set() {
        context.literalsf = literals
        wasm.setSoundLiterals(sound$, literals.byteOffset)
      }
      return { literals, set }
    }

    function binaryOp(
      BinOp: DspBinaryOp,
      LiteralLiteral: (a: number, b: number) => number
    ): BinaryOp {
      return function binaryOp(lhs: Value | number, rhs: Value | number): any {
        if (typeof lhs === 'number' && typeof rhs === 'number') {
          return LiteralLiteral(lhs, rhs)
        }

        const { Value } = sound

        let out = Value.Dynamic.create()

        let l: Value
        let r: Value

        if (commutative.has(BinOp)) {
          if (typeof lhs === 'number') {
            if (typeof rhs === 'number') throw 'unreachable'

            l = rhs
            r = Value.Literal.create(lhs)
          }
          else if (typeof rhs === 'number') {
            l = lhs
            r = Value.Literal.create(rhs)
          }
          else {
            l = lhs
            r = rhs
          }
        }
        else {
          if (typeof lhs === 'number') {
            if (typeof rhs === 'number') throw 'unreachable'

            l = Value.Literal.create(lhs)
            r = rhs
          }
          else if (typeof rhs === 'number') {
            l = lhs
            r = Value.Literal.create(rhs)
          }
          else {
            l = lhs
            r = rhs
          }
        }

        if (!l) {
          throw new Error('Missing left operand.')
        }

        if (!r) {
          throw new Error('Missing right operand.')
        }

        sound.vm.BinaryOp(
          BinOp,
          l.value$,
          r.value$,
          out.value$
        )

        return out
      }
    }

    const soundPartial = {
      context,
      vm,
    }

    const math = {
      add: binaryOp(DspBinaryOp.Add, (a, b) => a + b),
      mul: binaryOp(DspBinaryOp.Mul, (a, b) => a * b),
      sub: binaryOp(DspBinaryOp.Sub, (a, b) => a - b),
      div: binaryOp(DspBinaryOp.Div, (a, b) => a / b),
      pow: binaryOp(DspBinaryOp.Pow, (a, b) => a ** b),
    }

    function defineGen(name: keyof Gen, stereo: boolean): any {
      const props = getAllProps(name)
      const Gen = dspGens[name]
      const kind_index = dspGensKeys.indexOf(name)

      function handle(opt: any) {
        const gen$ = context.gens++
        setup_vm.CreateGen(kind_index)
        DEBUG && console.log('CreateGen', name, gen$)

        for (let p in opt) {
          const prop = `${name}.${p}`
          const prop$ = props.indexOf(p as any)
          DEBUG && console.log('Property', prop, opt[p])

          if (prop$ >= 0) {
            let value: number | undefined
            outer: {
              if (opt[p] instanceof Value) {
                const v: Value = opt[p]

                // Audio
                if (v.kind === Value.Kind.Audio) {
                  if (audioProps.has(p)) {
                    vm.SetProperty(gen$, prop$, Value.Kind.Audio as number, v.value$)
                  }
                  else {
                    const scalar = sound.Value.Scalar.create()
                    vm.AudioToScalar(v.ptr, scalar.ptr)
                    vm.SetProperty(gen$, prop$, Value.Kind.Scalar as number, scalar.value$)
                  }
                  break outer
                }
                else {
                  if (audioProps.has(p)) {
                    vm.SetProperty(gen$, prop$, Value.Kind.Audio as number, v.value$)
                  }
                  else {
                    vm.SetProperty(gen$, prop$, Value.Kind.Scalar as number, v.value$)
                  }
                  break outer
                }
              }
              // Text
              else if (typeof opt[p] === 'string') {
                if (name === 'say' && p === 'text') {
                  const floats = sound.Value.Floats.create()
                  const text = opt[p]
                  // loadSayText(floats, text)
                  vm.SetProperty(gen$, prop$, Value.Kind.Floats as number, floats.value$)
                  break outer
                }
                if (name === 'freesound' && p === 'id') {
                  const floats = sound.Value.Floats.create()
                  const text = opt[p]
                  // loadFreesound(floats, text)
                  vm.SetProperty(gen$, prop$, Value.Kind.Floats as number, floats.value$)
                  break outer
                }
                value = 0
              }
              // Literal
              else if (typeof opt[p] === 'number') {
                value = opt[p]
              }
              else {
                throw new TypeError(
                  `Invalid type for property "${prop}": ${typeof opt[p]}`)
              }

              if (typeof value !== 'number') {
                throw new TypeError(
                  `Invalid value for property "${prop}": ${value}`)
              }

              const literal = sound.Value.Literal.create(value)
              if (audioProps.has(p)) {
                const audio = sound.Value.Audio.create()
                vm.LiteralToAudio(literal.ptr, audio.ptr)
                vm.SetProperty(gen$, prop$, Value.Kind.Audio as number, audio.value$)
              }
              else {
                vm.SetProperty(gen$, prop$, Value.Kind.Scalar as number, literal.value$)
              }
            }
          }
        }

        return gen$
      }

      function processMono(opt: any): Value | void {
        const gen$ = handle(opt)

        if ('hasAudioOut' in Gen && Gen.hasAudioOut) {
          const audio = sound.Value.Audio.create()
          vm.ProcessAudio(gen$, audio.ptr)
          return audio
        }
        else {
          vm.UpdateGen(gen$)
        }
      }

      function processStereo(opt: any): [Value, Value] | void {
        const gen$ = handle(opt)

        if ('hasStereoOut' in Gen && Gen.hasStereoOut) {
          const out_0 = sound.Value.Audio.create()
          const out_1 = sound.Value.Audio.create()
          vm.ProcessAudioStereo(gen$, out_0.ptr, out_1.ptr)
          return [out_0, out_1]
        }
        else {
          vm.UpdateGen(gen$)
        }
      }

      return stereo
        ? processStereo
        : processMono
    }

    const globals = {} as {
      sr: Value.Scalar
      t: Value.Scalar
      rt: Value.Scalar
      co: Value.Scalar
    }

    const api = {
      globals,
      math: {
        ...math,
        '+': math.add,
        '*': math.mul,
        '-': math.sub,
        '/': math.div,
        '^': math.pow,
      },
      pan(value: Value | number): void {
        if (typeof value === 'number') {
          value = sound.Value.Literal.create(value)
        }
        vm.Pan(value.value$)
      },
      pick<T extends Value | number>(values: T[], index: Value | number): Value {
        const list$ = context.lists

        const length = values.length
        context.lists += length

        let i = list$
        for (let v of values) {
          if (typeof v === 'number') {
            const literal = sound.Value.Literal.create(v)
            context.listsi[i++] = literal.value$
          }
          else {
            context.listsi[i++] = v.value$
          }
        }

        if (typeof index === 'number') {
          index = sound.Value.Literal.create(index)
        }

        const out = sound.Value.Dynamic.create()
        vm.Pick(list$, length, index.value$, out.value$)
        return out
      },
      gen: fromEntries(
        dspGensKeys.map(name =>
          [name, defineGen(name, false)]
        )
      ) as Gen,
      gen_st: fromEntries(
        dspGensKeys.map(name =>
          [name, defineGen(name, true)]
        )
      ) as Gen
    }

    let prevHashId: any

    function process(tokens: Token[]) {
      const scope = {} as any
      const literals: AstNode[] = []

      const tokensCopy = [
        ...preludeTokens,
        ...tokens,
      ]
        .filter(t => t.type !== Token.Type.Comment)
        .map(copyToken)

      // create hash id from tokens. We compare this afterwards to determine
      // if we should make a new sound or update the old one.
      const hashId =
        [tokens.filter(t => t.type === Token.Type.Number).length].join('')
        + tokens.filter(t =>
          [Token.Type.Id, Token.Type.Op].includes(t.type)
        ).map(t => t.text).join('')

      const isNew = hashId !== prevHashId
      prevHashId = hashId

      // replace number tokens with literal references ids
      // and populate initial scope for those ids.
      for (const t of tokensCopy) {
        if (t.type === Token.Type.Number) {
          const id = `lit_${literals.length}`
          const literal = new AstNode(AstNode.Type.Literal, parseNumber(t.text), [t])
          literals.push(literal)
          scope[id] = literal
          t.type = Token.Type.Id
          t.text = id
        }
      }

      vm.Begin()
      setup_vm.Begin()
      prepare()
      if (isNew) {
        wasm.clearSound(sound$)
      }

      globals.sr = sound.Value.Scalar.create()
      globals.t = sound.Value.Scalar.create()
      globals.rt = sound.Value.Scalar.create()
      globals.co = sound.Value.Scalar.create()

      const { sr, t, rt, co } = globals
      scope.sr = new AstNode(AstNode.Type.Result, { value: sr })
      scope.t = new AstNode(AstNode.Type.Result, { value: t })
      scope.rt = new AstNode(AstNode.Type.Result, { value: rt })
      scope.co = new AstNode(AstNode.Type.Result, { value: co })

      function updateClock() {
        scalars[sr.ptr] = clock.sampleRate
        scalars[t.ptr] = clock.barTime
        scalars[rt.ptr] = clock.time
        scalars[co.ptr] = clock.coeff
      }

      updateClock()

      const program = interpret(sound, scope, tokensCopy)

      let L = program.scope.data['L']
      let R = program.scope.data['R']
      let LR = program.scope.data['LR']

      const slice = program.scope.stack.slice(-2)
      if (slice.length === 2) {
        R ??= slice.pop()
        L ??= slice.pop()
      }
      else if (slice.length === 1) {
        LR ??= slice.pop()
      }

      const out = {
        L: L?.value,
        R: R?.value,
        LR: LR?.value,
      }

      commit()

      if (isNew) {
        setup()
      }

      return { program, out, updateClock, isNew }
    }

    const sound = {
      context,
      sound$,
      data$,
      data,
      vm,
      ops,
      setup_vm,
      setup_ops,
      preset,
      run,
      reset,
      commit,
      getAudio,
      createLiteralsPreset,
      values: [] as Value[],
      Value: Value.Factory(soundPartial),
      api,
      process,
    }

    return sound
  }

  return { info, ctx, engine$, core$, clock, Sound }
}

const commutative = new Set([DspBinaryOp.Add, DspBinaryOp.Mul])
const audioProps = new Set(['in', 'sidechain'])
const textProps = new Set(['text', 'id'])

export type BinaryOp = {
  (lhs: number, rhs: number): number
  (lhs: number, rhs: Value): Value
  (lhs: Value, rhs: number): Value
  (lhs: Value, rhs: Value): Value
  // (lhs: Value | number, rhs: Value | number): Value | number
}
