export * from './gfx/sketch'
export * from './gfx/draw'

export * from '../../generated/assembly/dsp-factory'
export { run as dspRun } from '../../generated/assembly/dsp-runner'

import { Core, Engine } from './dsp/core/engine'
import { Dsp } from './dsp/vm/dsp'
import { SoundData } from './dsp/vm/dsp-shared'
import { Sound } from './dsp/vm/sound'

export function createCore(sampleRate: u32): Core {
  return new Core(sampleRate)
}

export function createEngine(sampleRate: u32, core: Core): Engine {
  return new Engine(sampleRate, core)
}

export function createDsp(): Dsp {
  return new Dsp()
}

export function createSound(engine: Engine): Sound {
  return new Sound(engine)
}

export function getSoundData(sound: Sound): SoundData {
  return sound.data
}
