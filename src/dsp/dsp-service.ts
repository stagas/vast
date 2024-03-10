import { Signal, nu } from 'signal-jsx'
import dspWorkerUrl from './dsp-worker.ts?url'
import { Deferred, rpc } from 'utils'
import { DspWorker } from './dsp-worker.ts'
import { Clock } from './dsp-shared.ts'

export type DspService = ReturnType<typeof DspService>

export function DspService(ctx: AudioContext) {
  using $ = Signal()

  const deferred = Deferred<void>()
  const ready = deferred.promise
  const worker = new Worker(dspWorkerUrl, { type: 'module' })

  const service = rpc<DspWorker>(worker, {
    async isReady() {
      deferred.resolve()
    }
  })

  class DspInfo {
    dsp = $.unwrap(() => ready.then(() => service.createDsp(ctx.sampleRate)))
    @nu get clock() {
      const { dsp } = $.of(this)
      $()
      const clock = Clock(dsp.memory.buffer, dsp.clock$)
      return clock
    }
  }

  const info = $(new DspInfo)

  return { info, ready, service }
}
