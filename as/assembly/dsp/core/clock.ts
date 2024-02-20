// @unmanaged
export class Clock {
  time: f64 = 0
  timeStep: f64 = 0
  prevTime: f64 = -1
  endTime: f64 = 1
  internalTime: f64 = 0
  bpm: f64 = 60
  coeff: f64 = 0
  barTime: f64 = 0
  barTimeStep: f64 = 0
  nextBarTime: f64 = 0
  loopStart: f64 = -Infinity
  loopEnd: f64 = +Infinity
  sampleRate: u32 = 44100
  jumpBar: i32 = -1
  ringPos: u32 = 0
  nextRingPos: u32 = 0

  reset(): void {
    const c: Clock = this
    c.ringPos = 0
    c.nextRingPos = 0
    c.prevTime = -1
    c.time = 0
    c.barTime = 0
    c.internalTime = 0
  }
  update(): void {
    const c: Clock = this

    c.coeff = c.bpm / 60 / 4
    c.timeStep = 1.0 / c.sampleRate
    c.barTimeStep = c.timeStep * c.coeff
    const chunkAheadTime: f64 = 135 * c.barTimeStep

    const internalTimeBefore = c.internalTime
    let internalTimeNow = internalTimeBefore

    // advance barTime
    if (c.prevTime >= 0) {
      internalTimeNow = internalTimeBefore + (c.time - c.prevTime) * c.coeff
    }
    c.prevTime = c.time

    // wrap barTime on clock.endTime
    if (internalTimeNow >= c.endTime) {
      internalTimeNow -= c.endTime
      if (internalTimeNow >= c.endTime) {
        internalTimeNow %= c.endTime
      }
    }

    // calculate next bar time (+1 frame for precision error)
    let nextBarTime = internalTimeNow + chunkAheadTime

    // wrap nextBarTime on clock.endTime
    if (nextBarTime >= c.endTime) {
      nextBarTime -= c.endTime
    }

    c.barTime = c.internalTime = internalTimeNow
    c.nextBarTime = nextBarTime
  }
}
