import { fx } from 'signal-jsx'
import { TaskResult, Bench as TinyBench } from 'tinybench'
import { rafs } from 'utils'
import { state } from '../state.ts'
import { AnimMode } from '../world/anim.ts'

const DEBUG = true

const REVERSED = ['hz', 'raf']
const HIGHLIGHT = ['mean', 'raf', 'totalTime']

function fmt(times: number, key: string, value: any) {
  const v = REVERSED.includes(key) ? value * times : value / times
  return parseFloat(v.toFixed(2)).toLocaleString()
}

export function BenchResults() {
  const el = <div />

  function extra(result?: { raf?: number } & TaskResult) {
    if (!result) return
    result.raf = (1000 / 60) / result.mean
    return result
  }

  fx(() => {
    el.replaceChildren(...state.benchTasks.map(task =>
      <div>
        {task.name}:
        <div class="flex flex-row flex-wrap w-full min-w-full items-stretch text-xs">{
          Object.entries(extra(task.result) ?? {})
            .filter(([key]) => ![
              'samples', 'p75', 'p99', 'p995'
            ].includes(key))
            .map(([key, value]) =>
              <div class={[
                "flex flex-col flex-auto min-w-0 truncate border-r border-black odd:bg-base-300 even:bg-base-200",
              ]}>
                <p class={[
                  "flex-1 p-1 py-0 bg-slate-700 text-slate-400",
                  HIGHLIGHT.includes(key) && 'bg-slate-500'
                ]}>{key}</p>
                <p class={["flex-1 p-1 py-2",
                  HIGHLIGHT.includes(key) && 'bg-slate-600'
                ]}>{fmt((task.opts as any)?.times ?? 1, key, value)}</p>
              </div>
            )
        }</div>
      </div>
    ))
  })

  return el
}

export function Bench() {
  const bench = new TinyBench({ time: 500, warmupTime: 500 })

  type P = Parameters<TinyBench['add']>

  function add(name: P[0], setup: () => P[1], opts: P[2] & { times?: number, raf?: boolean } = {}) {
    let fn = () => {}

    opts.beforeAll = () => {
      fn = setup()
    }

    if (opts.raf) {
      opts.afterEach = () => rafs(1)
    }

    bench.add(name, () => {
      const { times = 1 } = opts
      for (let i = 0; i < times; i++) {
        fn()
      }
    }, opts)
  }

  function remove(name: P[0]) {
    bench.remove(name)
  }

  async function run() {
    if (state.benchIsRunning) return
    state.path = '/bench'
    state.animMode = AnimMode.Paused
    state.benchIsRunning = true
    DEBUG && console.log('[bench] ... begin ...')
    DEBUG && console.time('[bench] end')
    await rafs(10)
    await bench.warmup()
    await bench.run()
    DEBUG && console.timeEnd('[bench] end')
    state.benchTasks = bench.tasks
    state.benchIsRunning = false
  }

  const spinner = <span class="loading loading-spinner loading-xs"></span>

  fx(() => {
    if (state.benchIsRunning) {
      button.append(spinner)
    }
    else {
      spinner.remove()
    }
  })

  const button = <button class="btn" onclick={run}>
    bench
  </button>

  return { button, add, remove }
}
