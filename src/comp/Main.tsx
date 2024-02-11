import { Signal } from 'signal-jsx'
import { state } from '../state.ts'
import { Bench, BenchResults } from './Bench.tsx'
import { Grid } from './Grid.tsx'
import { MainMenu } from './MainMenu.tsx'
import { ThemePicker } from './ThemePicker.tsx'

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

  let grid: Element

  $.fx(() => {
    const { path } = state
    $()
    article.replaceChildren((() => {
      switch (path) {
        case '/bench':
          return <BenchResults />

        default:
          grid ??= <Grid />
          return grid
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
