export * from './gfx/draw'
export * from './gfx/sketch'

export * from '../../generated/assembly/dsp-factory'
export { run as dspRun } from '../../generated/assembly/dsp-runner'

import { Clock } from './dsp/core/clock'
import { Core, Engine } from './dsp/core/engine'
import { Sound } from './dsp/vm/sound'
import { logf, logi } from './env'

export function createCore(sampleRate: u32): Core {
  return new Core(sampleRate)
}

export function createEngine(sampleRate: u32, core: Core): Engine {
  return new Engine(sampleRate, core)
}

export function getEngineClock(engine: Engine): usize {
  return changetype<usize>(engine.clock)
}

export function resetClock(clock$: usize): void {
  const clock = changetype<Clock>(clock$)
  clock.reset()
}

export function updateClock(clock$: usize): void {
  const clock = changetype<Clock>(clock$)
  clock.update()
}

export function createSound(engine: Engine): Sound {
  return new Sound(engine)
}

export function resetSound(sound: Sound): void {
  sound.reset()
}

export function clearSound(sound: Sound): void {
  sound.clear()
}

export function getSoundData(sound: Sound): usize {
  return changetype<usize>(sound.data)
}

export function getSoundAudio(sound: Sound, index: i32): usize {
  return changetype<usize>(sound.audios[index])
}

export function getSoundLiterals(sound: Sound): usize {
  return changetype<usize>(sound.literals)
}

export function setSoundLiterals(sound: Sound, literals$: usize): void {
  sound.literals = changetype<StaticArray<f32>>(literals$)
}

export function getSoundScalars(sound: Sound): usize {
  return changetype<usize>(sound.scalars)
}

export function getSoundLists(sound: Sound): usize {
  return changetype<usize>(sound.lists)
}
