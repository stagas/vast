import { Signal } from 'signal-jsx'
import { state } from '../state.ts'
import { Bench, BenchResults } from './Bench.tsx'
import { Grid } from '../draws/grid.ts'
import { MainMenu } from './MainMenu.tsx'
import { ThemePicker } from './ThemePicker.tsx'
import { Surface } from '../surface.ts'
import { Rect } from 'std'
import { MainBtn } from './MainBtn.tsx'
import { Console } from './Console.tsx'
import { Canvas } from './Canvas.tsx'
import { Minimap } from '../draws/minimap.ts'
import { Code } from './Code.tsx'
import { CodeDraw } from '../draws/code.ts'

const DEBUG = true

export function Main() {
  DEBUG && console.log('[main] create')
  using $ = Signal()

  const dir = `./`
  const fontFilename = 'Miracode.ttf'
  function makeCss() {
    return /*css*/`
      @font-face {
        font-family: 'Mono';
        src: url('${dir}${fontFilename}');
        src: url('${dir}${fontFilename}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }

      .mono { font-family: 'Mono', monospace; }
      .hidden { display: none !important; }
    `
  }
  const style = <style />
  style.textContent = makeCss()
  document.head.append(style)

  const article = <article />

  const bench = Bench()

  bench.add('Math.sin()', () => {
    let i = 0
    let x = 0
    return () => {
      x += Math.sin(i++ / 10000)
    }
  }, { times: 100_000, raf: true })

  let surface: Surface | undefined
  let grid: Grid | undefined

  const view = $(new Rect, { pr: state.$.pr })

  let minimap: Minimap | undefined
  const minimapDiv = <div class="relative m-1.5 h-8" />

  let codeSurface: Surface | undefined
  const codeView = $(new Rect, { w: 300, h: 300, pr: state.$.pr })
  let codeDraw: CodeDraw
  const code = Code()

  $.fx(() => {
    const { path } = state
    $()
    article.replaceChildren((() => {
      switch (path) {
        case '/bench':
          minimap?.canvas.remove()
          minimap?.handle.remove()
          return <BenchResults />

        default:
          surface ??= Surface(view, state.matrix, state.viewMatrix, () => {
            view.w = window.innerWidth
            view.h = window.innerHeight - 44
            view.pr = state.pr
          })

          codeSurface ??= Surface(codeView, state.codeMatrix, state.codeViewMatrix, () => {
            codeView.w = 350
            codeView.h = window.innerHeight - 44
          }, true)
          codeSurface.canvas.style.position = 'absolute'
          codeSurface.canvas.style.left = '0'
          codeSurface.canvas.style.top = '44px'
          codeSurface.canvas.style.zIndex = '40'
          codeDraw ??= CodeDraw(codeSurface)
          codeDraw.write()

          grid ??= Grid(surface)
          grid.write()

          minimap ??= Minimap(grid)
          minimapDiv.append(minimap.canvas)
          minimapDiv.append(minimap.handle)

          return <div>
            {surface.canvas}
            {codeSurface.canvas}
          </div>
      }
    })())
  })

  $.fx(() => () => {
    DEBUG && console.log('[main] dispose')
  })

  return <main data-theme={() => state.theme} class="mono bg-base-100 h-full w-full">
    <nav class="navbar items-stretch bg-base-300 border-b-black border-b-2 p-0 min-h-0">

      <div class="flex-1">
        <a class="btn hover:bg-base-100 border-none bg-transparent text-lg text-primary font-bold h-10 min-h-10 px-3">
          {state.name}
        </a>
      </div>

      <MainBtn label="take" onclick={() => {
      }}>
        photo
      </MainBtn>

      {minimapDiv}

      <MainBtn label="debug" onclick={() => {
        state.debugConsoleActive = !state.debugConsoleActive
      }}>
        {() => state.debugConsoleActive ? 'on' : 'off'}
      </MainBtn>

      <MainBtn label="anim" onclick={() => {
        state.path = '/'
        state.animCycle?.()
      }}>
        {() => state.animMode}
      </MainBtn>

      {bench.button}

      <ThemePicker />

      <MainMenu />
    </nav>

    {code.canvas}

    {article}

    {DEBUG && <Console
      signal={() => state.debugUpdated}
      history={state.debugHistory}
      size={45}
    />}
  </main>
}
