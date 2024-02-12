import { Signal } from 'signal-jsx'
import { state } from '../state.ts'
import { Bench, BenchResults } from './Bench.tsx'
import { Grid } from '../draws/grid.ts'
import { MainMenu } from './MainMenu.tsx'
import { ThemePicker } from './ThemePicker.tsx'
import { Surface } from '../surface.ts'
import { Rect } from 'std'

const DEBUG = true

export function Main() {
  DEBUG && console.log('[main] create')
  using $ = Signal()

  const article = <article />

  const bench = Bench()

  bench.add('Math.sin()', () => {
    let i = 0
    let x = 0
    return () => {
      x += Math.sin(i++ / 10000)
    }
  }, { times: 100_000, raf: true })

  let surface: Surface
  let grid: Grid
  const view = $(new Rect)

  $.fx(() => {
    const { path } = state
    $()
    article.replaceChildren((() => {
      switch (path) {
        case '/bench':
          return <BenchResults />

        default:
          surface ??= Surface(view)
          grid ??= Grid(surface)
          grid.write()
          return surface.canvas
      }
    })())
  })

  $.fx(() => () => {
    DEBUG && console.log('[main] dispose')
  })

  return <main data-theme={() => state.theme} class="bg-base-100 h-full w-full">
    <nav class="navbar items-stretch bg-base-300 border-b-black border-b-2 p-0 min-h-0">

      <div class="flex-1">
        <a class="btn hover:bg-base-100 border-none bg-transparent text-lg text-primary font-bold h-10 min-h-10 px-3">
          {state.name}
        </a>
      </div>

      <button class="btn" onclick={() => {
        state.path = '/'
        state.animCycle?.()
      }}>
        {() => state.animMode}
      </button>

      {bench.button}

      <ThemePicker />

      <MainMenu />
    </nav>

    {article}
  </main>
}
