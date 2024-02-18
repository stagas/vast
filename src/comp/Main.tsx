import { Signal } from 'signal-jsx'
import { state } from '../state.ts'
import { Bench, BenchResults } from './Bench.tsx'
import { Grid } from '../draws/grid.ts'
import { MainMenu } from './MainMenu.tsx'
import { ThemePicker } from './ThemePicker.tsx'
import { Surface } from '../surface.ts'
import { Rect } from 'std'
import { Btn, MainBtn } from './MainBtn.tsx'
import { Console } from './Console.tsx'
import { Canvas } from './Canvas.tsx'
import { Minimap } from '../draws/minimap.ts'
import { Code } from './Code.tsx'
import { CodeDraw } from '../draws/code.ts'
import { CODE_WIDTH } from '../constants.ts'

const DEBUG = true

export function Main() {
  DEBUG && console.log('[main] create')
  using $ = Signal()

  const dir = `./`
  // const fontFilename = 'Brass.woff2'
  // const fontFilename = 'CascadiaCode.woff2'
  // const fontFilename = 'CascadiaMono.woff2'
  // const fontFilename = 'Cousine-Regular.woff2'
  // const fontFilename = 'FantasqueSansMono-Regular.woff2'
  // const fontFilename = 'hack-regular.woff2'
  // const fontFilename = 'halflings-regular.woff2'
  const fontFilename = 'Hermit-Regular.woff2'
  // const fontFilename = 'Iosevka-Term.woff2'
  // const fontFilename = 'JuliaMono-Regular.woff2'
  // const fontFilename = 'Monocraft.woff2'
  // const fontFilename = 'Monoid-Regular.woff2'
  // const fontFilename = 'Monoid-Retina.woff2'
  // const fontFilename = 'MonoMusic-Regular.woff2'
  // const fontFilename = 'mplus-1m-regular.woff2'
  // const fontFilename = 'MPlus.woff2'
  // const fontFilename = 'SpaceMono-Regular.woff2'
  // const fontFilename = 'Miracode.ttf'
  function makeCss() {
    return /*css*/`
      @font-face {
        font-family: 'Mono';
        src: url('${dir}${fontFilename}');
        src: url('${dir}${fontFilename}') format('woff2');
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


  const sidebar = <aside />
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
    sidebar.replaceChildren((() => {
      switch (path) {
        case '/bench':
          return <div />

        default:
          return <div>
            {code.canvas}

            <div class="absolute flex bottom-0 left-0 bg-base-300 border-t-black border-t-2 text-primary z-50 h-10 items-center justify-around" style={`width: ${CODE_WIDTH - 1}px`}>
              <Btn onclick={() => { }}>new</Btn>
              <Btn onclick={() => { }}>load</Btn>
              <Btn onclick={() => { }}>save</Btn>
              <Btn onclick={() => { }}>solo</Btn>
              <Btn onclick={() => { }}>mute</Btn>
            </div>
          </div>
      }
    })())

    article.replaceChildren((() => {
      switch (path) {
        case '/bench':
          code.canvas.remove()
          minimap?.canvas.remove()
          minimap?.handle.remove()
          return <BenchResults />

        default:
          surface ??= Surface(view, state.matrix, state.viewMatrix, () => {
            view.w = window.innerWidth
            view.h = window.innerHeight - 44
            view.pr = state.pr
          })

          // codeSurface ??= Surface(codeView, state.codeMatrix, state.codeViewMatrix, () => {
          //   codeView.w = 350
          //   codeView.h = window.innerHeight - 44
          // }, true)
          // codeSurface.canvas.style.position = 'absolute'
          // codeSurface.canvas.style.left = '0'
          // codeSurface.canvas.style.top = '44px'
          // codeSurface.canvas.style.zIndex = '40'
          // codeDraw ??= CodeDraw(codeSurface)
          // codeDraw.write()

          grid ??= Grid(surface)
          grid.write()

          minimap ??= Minimap(grid)
          minimapDiv.append(minimap.canvas)
          minimapDiv.append(minimap.handle)

          return <div>
            {surface.canvas}
            {/* {codeSurface.canvas} */}
          </div>
      }
    })())
  })

  $.fx(() => () => {
    DEBUG && console.log('[main] dispose')
  })

  const navbar = <nav class="navbar
    items-stretch
    justify-stretch
    flex
    bg-base-300
    border-b-black border-b-2 p-0 min-h-0" />

  $.fx(() => {
    const { mode } = state
    $()
    navbar.replaceChildren(...[
      <div class="min-w-[334px]">
        <a class="btn hover:bg-base-100 border-none bg-transparent text-lg text-primary font-bold h-10 min-h-10 px-3">
          {state.name}
        </a>
      </div>,

      <div>
        <Btn onclick={() => { }}>Play</Btn>
        <Btn onclick={() => { }}>Stop</Btn>
      </div>,

      minimapDiv,

      <MainBtn label={mode} onclick={() => {
        if (state.mode === 'edit') {
          state.mode = 'live'
        }
        else if (state.mode === 'live') {
          state.mode = 'dev'
        }
        else {
          state.mode = 'edit'
        }
      }}>
        mode
      </MainBtn>,

      <MainBtn label="take" onclick={() => {
      }}>
        photo
      </MainBtn>,

      <div class="flex-1 flex items-end justify-end">

        {state.mode === 'dev' && <>
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
        </>}
      </div>
      ,

      <ThemePicker />,

      <MainMenu />,
    ].filter(Boolean).flat())
  })

  return <main data-theme={() => state.theme} class="mono bg-base-100 h-full w-full">
    {navbar}
    {sidebar}
    {article}
    {DEBUG && <Console
      signal={() => state.debugUpdated}
      history={state.debugHistory}
      size={45}
    />}
  </main>
}
