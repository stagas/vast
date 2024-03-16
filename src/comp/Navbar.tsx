import { Signal } from 'signal-jsx'
import { clamp, dom } from 'utils'
import { HEADER_HEIGHT } from '../constants.ts'
import { layout } from '../layout.ts'
import { lib } from '../lib.ts'
import { screen } from '../screen.tsx'
import { services } from '../services.ts'
import { state } from '../state.ts'
import { Btn, MainBtn } from './MainBtn.tsx'
import { MainMenu } from './MainMenu.tsx'
import { Sequencer } from './Sequencer.tsx'
import { ThemePicker } from './ThemePicker.tsx'

const DEBUG = true

export function Navbar(props: { sequencer: Sequencer }) {
  using $ = Signal()

  const info = $({
    get top() { return layout.info.mainY - HEADER_HEIGHT / 2 },
  })

  function beginDragging(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const y = layout.info.mainY
    const d = Math.max(1, state.matrix.d)
    const f = state.matrix.f
    const py = e.pageY

    screen.info.cursor = 'grabbing'
    screen.info.overlay = true

    const hh = HEADER_HEIGHT / 2
    const off = dom.on(window, 'mousemove', e => {
      layout.info.mainY = clamp(hh, screen.info.rect.h - hh, (e.pageY - py) + y)
      const coeff = (layout.info.mainY - hh) / Math.max(lib.project?.info.tracks.length ?? 1, y - hh)
      /* state.viewMatrix.d =  */state.matrix.d = d * coeff
      /* state.viewMatrix.f =  */state.matrix.f = f * coeff
    }, { capture: true })

    dom.on(window, 'mouseup', () => {
      screen.info.cursor = 'default'
      screen.info.overlay = false
      off()
    }, { capture: true, once: true })
  }

  const navbar = <nav class="navbar
    absolute
    items-stretch
    justify-stretch
    flex
    bg-base-300
    z-40
    border-b-black border-b-2 p-0 min-h-0"
  /> as HTMLElement

  $.fx(() => {
    navbar.style.transform = `translateY(${info.top}px)`
  })
  navbar.style.top = '0px'
  navbar.style.left = '0px'
  $.fx(() => {
    const { mode } = state
    $()
    navbar.replaceChildren(...[
      // <div class={`lg:min-w-[348px] mt-[1px]`}>
      //   <a class="btn hover:bg-base-100 border-none bg-transparent text-[1.135rem] text-primary font-bold italic h-10 min-h-10 px-3">
      //     {state.name}
      //   </a>
      // </div>
      // ,
      <div>
        <Btn onpointerdown={() => {
          services.audio.player.start()
        }}>{/* play button */}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-[27px] w-6" preserveAspectRatio="xMidYMid slice" viewBox="0 0 24 24">
            <path fill="none" stroke={() => screen.info.colors.primary} stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M7 17.259V6.741a1 1 0 0 1 1.504-.864l9.015 5.26a1 1 0 0 1 0 1.727l-9.015 5.259A1 1 0 0 1 7 17.259" />
          </svg>
        </Btn>
        <Btn onpointerdown={() => {
          services.audio.player.stop()
          lib.project?.info.tracks.forEach(t => t.stop())
        }}>{/* stop button */}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-[22.5px] w-5" preserveAspectRatio="xMidYMid slice" viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M5 8.2v7.6c0 1.12 0 1.68.218 2.107c.192.377.497.683.874.875c.427.218.987.218 2.105.218h7.607c1.118 0 1.676 0 2.104-.218c.376-.192.682-.498.874-.875c.218-.427.218-.986.218-2.104V8.197c0-1.118 0-1.678-.218-2.105a2 2 0 0 0-.874-.874C17.48 5 16.92 5 15.8 5H8.2c-1.12 0-1.68 0-2.108.218a1.999 1.999 0 0 0-.874.874C5 6.52 5 7.08 5 8.2" />
          </svg>
        </Btn>
      </div>
      ,
      props.sequencer.minimap.el
      ,
      <MainBtn label="take" icon={
        <svg xmlns="http://www.w3.org/2000/svg" class="h-[23px] w-[23px] -ml-[.5px] mt-[1.33px]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 16 16">
          <path fill="currentColor" d="m 10.878 0.282 l 0.348 1.071 a 2.205 2.205 0 0 0 1.398 1.397 l 1.072 0.348 l 0.021 0.006 a 0.423 0.423 0 0 1 0 0.798 l -1.071 0.348 a 2.208 2.208 0 0 0 -1.399 1.397 l -0.348 1.07 a 0.423 0.423 0 0 1 -0.798 0 l -0.348 -1.07 a 2.204 2.204 0 0 0 -1.399 -1.403 l -1.072 -0.348 a 0.423 0.423 0 0 1 0 -0.798 l 1.072 -0.348 a 2.208 2.208 0 0 0 1.377 -1.397 l 0.348 -1.07 a 0.423 0.423 0 0 1 0.799 0 m 4.905 7.931 l -0.765 -0.248 a 1.577 1.577 0 0 1 -1 -0.999 l -0.248 -0.764 a 0.302 0.302 0 0 0 -0.57 0 l -0.25 0.764 a 1.576 1.576 0 0 1 -0.983 0.999 l -0.765 0.248 a 0.303 0.303 0 0 0 0 0.57 l 0.765 0.249 a 1.578 1.578 0 0 1 1 1.002 l 0.248 0.764 a 0.302 0.302 0 0 0 0.57 0 l 0.249 -0.764 a 1.576 1.576 0 0 1 0.999 -0.999 l 0.765 -0.248 a 0.303 0.303 0 0 0 0 -0.57 z M 10.402 11.544 H 3.973 A 1.5 1.5 0 0 1 2.455 10.629 v -5.089 A 1.5 1.5 0 0 1 3.527 4.713 h 3.728 c 1.165 0.022 -1.161 -0 -1.116 -1.317 H 3.339 A 2.5 2.5 0 0 0 1 5.5 v 5 A 2.5 2.5 0 0 0 3.5 13 h 9 a 2.5 2.5 0 0 0 2.5 -2.5 v -0.178 a 0.54 0.54 0 0 0 -0.022 0.055 l -0.371 1.201 c -0.962 0.995 -1.937 0.635 -2.61 -0.198" />
        </svg>
      } onclick={() => {
      }}>
        photo
      </MainBtn>
      ,
      <div onmousedown={beginDragging} onwheel={props.sequencer.grid.handleZoom} class="flex-1 flex" />
      ,
      // <div class="flex-1 flex items-end justify-end">
      //   {state.mode === 'dev' && <>
      //     <MainBtn label="debug" onclick={() => {
      //       state.debugConsoleActive = !state.debugConsoleActive
      //     }}>
      //       {() => state.debugConsoleActive ? 'on' : 'off'}
      //     </MainBtn>

      //     <MainBtn label="anim" onclick={() => {
      //       state.path = '/'
      //       state.animCycle?.()
      //     }}>
      //       {() => state.animMode}
      //     </MainBtn>

      //     {bench.button}
      //   </>}
      // </div>
      // ,
      // <MainBtn label={mode} onclick={() => {
      //   if (state.mode === 'edit') {
      //     state.mode = 'wide'
      //   }
      //   else if (state.mode === 'wide') {
      //     state.mode = 'dev'
      //   }
      //   else {
      //     state.mode = 'edit'
      //   }
      // }}>
      //   mode
      // </MainBtn>
      // ,
      <Btn onclick={() => { }}>
        <a href="https://github.com/stagas/ravescript" target="_blank">
          <div>{/* class="h-[28px] -mt-[2.5px] -mr-[5px]" */}
            <svg xmlns="http://www.w3.org/2000/svg" class="mt-[1px] h-[24px] w-[24px]"
              viewBox="0 0 16 16"
              preserveAspectRatio="xMidYMid slice"
            >
              <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59c.4.07.55-.17.55-.38c0-.19-.01-.82-.01-1.49c-2.01.37-2.53-.49-2.69-.94c-.09-.23-.48-.94-.82-1.13c-.28-.15-.68-.52-.01-.53c.63-.01 1.08.58 1.23.82c.72 1.21 1.87.87 2.33.66c.07-.52.28-.87.51-1.07c-1.78-.2-3.64-.89-3.64-3.95c0-.87.31-1.59.82-2.15c-.08-.2-.36-1.02.08-2.12c0 0 .67-.21 2.2.82c.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82c.44 1.1.16 1.92.08 2.12c.51.56.82 1.27.82 2.15c0 3.07-1.87 3.75-3.65 3.95c.29.25.54.73.54 1.48c0 1.07-.01 1.93-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
            </svg>
          </div>
        </a>
      </Btn>
      ,
      <ThemePicker />
      ,
      <MainMenu />
    ].filter(Boolean).flat())
  })

  return navbar
}
