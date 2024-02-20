import { allocF32, rateToPhaseStep } from '../../util'
import { BUFFER_SIZE } from '../constants'
import { Clock } from './clock'
import { WAVETABLE_SIZE } from './constants'
import { Wavetable } from './wavetable'

export class Signal {
  L: StaticArray<f32> = new StaticArray<f32>(BUFFER_SIZE)
  R: StaticArray<f32> = new StaticArray<f32>(BUFFER_SIZE)
  LR: StaticArray<f32> = new StaticArray<f32>(BUFFER_SIZE)
}

// @unmanaged
export class Core {
  wavetable: Wavetable
  constructor(public sampleRate: u32) {
    this.wavetable = new Wavetable(sampleRate, WAVETABLE_SIZE)
  }
}

// @unmanaged
export class Engine {
  wavetable: Wavetable
  clock: Clock
  signal: Signal = new Signal()

  rateSamples: u32
  rateSamplesRecip: f64
  rateStep: u32
  samplesPerMs: f64

  constructor(public sampleRate: u32, public core: Core) {
    const clock = new Clock()

    this.wavetable = core.wavetable
    this.clock = clock
    this.clock.sampleRate = sampleRate
    clock.update()
    clock.reset()

    this.rateSamples = sampleRate
    this.rateSamplesRecip = (1.0 / f64(sampleRate))
    this.rateStep = rateToPhaseStep(sampleRate)
    this.samplesPerMs = f64(sampleRate) / 1000
  }

  createBlock(blockSize: u32): StaticArray<f32> {
    return allocF32(blockSize)
  }
}
