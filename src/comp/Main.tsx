import { $, Signal } from 'signal-jsx'
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
import { TextDraw } from '../draws/text.ts'
import { Dsp } from '../dsp/dsp.ts'
import { SoundValueKind } from '../../as/assembly/dsp/vm/dsp-shared.ts'
import { dspGens } from '../../generated/typescript/dsp-gens.ts'
import { getAllProps } from '../dsp/util.ts'
import { Floats } from '../util/floats.ts'
import { tokenize } from '../lang/tokenize.ts'
import { Track, TrackBox, TrackBoxKind } from '../dsp/track.ts'
import { Source } from '../source.ts'
import { Heads } from '../draws/heads.ts'

const DEBUG = true

export function Main() {
  DEBUG && console.log('[main] create')
  using $ = Signal()

  const sidebar = <aside />
  const article = <article />

  const bench = Bench()

  // bench.add('Math.sin()', () => {
  //   let i = 0
  //   let x = 0
  //   return () => {
  //     x += Math.sin(i++ / 10000)
  //   }
  // }, { times: 100_000, raf: true })

  let surface: Surface | undefined
  // let grid: Grid | undefined
  let textDraw: TextDraw | undefined
  let headsDraw: Heads | undefined

  const info = $({
    grid: null as null | Grid,
  })

  const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 0.000001 })
  const dsp = Dsp(ctx)
  // const sound = dsp.Sound()

  function addTrack(source: $<Source<any>>) {
    const y = state.tracks.length
    const t = Track(dsp, source, y)
    const proto = { track: t }
    t.info.boxes = Array.from({ length: 8 }, (_, x) => $({
      __proto__: proto,
      kind: x % 2 === 0 ? TrackBoxKind.Audio : TrackBoxKind.Notes,
      rect: $(new Rect, { x, y, w: 1, h: 1 }),
      isFocused: false,
      isHovering: false,
    }) as $<TrackBox & { __proto__: typeof proto }>)
    state.tracks = [...state.tracks, t]
  }

  $.batch(() => {
    if (state.tracks.length) {
      state.tracks = []
    }
    addTrack(state.source)
    addTrack(state.t1_source)
    addTrack(state.t2_source)
    addTrack(state.t3_source)
    addTrack(state.t4_source)
    // addTrack(state.t1_source)
    // addTrack(state.t1_source)
    // addTrack(state.t1_source)
    // addTrack(state.t1_source)
    // addTrack(state.t1_source)
    // addTrack(state.t1_source)
    // addTrack(state.t1_source)
    // addTrack(state.t1_source)
    // addTrack(state.t1_source)
  })

  // const t0 = Track(dsp, state.source, 0) //$(new Source(tokenize), { code: '[saw 330]' }))
  // const t1 = Track(dsp, state.t1_source, 1)
  // state.tracks = [t0, t1]
  // t0.info.boxes = [$({ rect: $(new Rect, { x: 0, y: 0, w: 1, h: 1 }), shape: null })]
  // t1.info.boxes = [$({ rect: $(new Rect, { x: 0, y: 1, w: 1, h: 1 }), shape: null })]

  const view = $(new Rect, { pr: state.$.pr })

  let minimap: Minimap | undefined
  const minimapDiv = <div class="relative m-1.5 h-8" />

  let codeSurface: Surface | undefined
  const codeView = $(new Rect, { w: 300, h: 300, pr: state.$.pr })
  let codeDraw: CodeDraw

  const code = Code()
  const editors: ReturnType<typeof code['createEditorView']>[] = []

  $.fx(() => {
    const { tracks } = state
    $()
    const offs = []
    for (const track of tracks) {
      const editor = (editors[track.info.y] ??= code.createEditorView($(new Rect, { x: 0, y: track.info.y, w: 1, h: 1 })))
      offs.push($.fx(() => {
        const { hexColorBrightest } = track.info.colors
        $()
        editor.editorInfo.brand = hexColorBrightest
      }))
      editor.editor.buffer.source = track.source
    }
    // console.log(editors)
    return offs
  })

  // $.fx(() => {
  //   const { grid } = $.of(info)
  //   const { hoveringBox } = $.of(grid.info)
  //   $()
  //   state.source = hoveringBox.track.source
  //   code.info.brand = hoveringBox.hexColorBrighter
  // })

  // $.fx(() => {
  //   const { isHoveringToolbar } = state
  //   $()
  //   if (isHoveringToolbar) {
  //     document.body.style.cursor = 'pointer'
  //   }
  //   else {
  //     document.body.style.cursor = ''
  //   }
  // })

  const loadDiv = <div />
  $.fx(() => {
    const { isLoadOpen, loadOpenCategory } = state
    $()
    if (isLoadOpen) {
      loadDiv.replaceChildren(
        <section class="absolute select-none bottom-[56px] z-30 w-[350px] h-[29%] flex items-stretch justify-items-center p-2 box-border bg-base-200">

          {/* <div class="flex flex-col items-center justify-items-center w-[67px] border-r-2 border-primary border-opacity-80 pt-[2px] overflow-hidden">
            <div class="flex-1 min-h-8">
              <Btn icon={
                <svg xmlns="http://www.w3.org/2000/svg" class="w-[26px] h-[26px]" viewBox="0 0 256 256">
                  <g fill="currentColor">
                    <path d="M128 64v64H24Zm104 64H128v64Z" opacity="0.5" />
                    <path d="m236.19 134.81l-104 64A8 8 0 0 1 120 192V78.32l-91.81 56.49a8 8 0 0 1-8.38-13.62l104-64A8 8 0 0 1 136 64v113.68l91.81-56.49a8 8 0 0 1 8.38 13.62" />
                  </g>
                </svg>
              }
                onclick={() => { }}
              >
              </Btn>
            </div>

            <div class="flex-1 min-h-8">
              <Btn icon={
                <svg xmlns="http://www.w3.org/2000/svg" class="w-[24px] h-[22px]" viewBox="0 0 48 48">
                  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="3.5">
                    <path d="M24 17V31" />
                    <path d="M33 11V37" />
                    <path d="M6 17V31" />
                    <path d="M42 18V30" />
                    <path d="M15 4V44" />
                  </g>
                </svg>
              }
                onclick={() => { }}
              >
              </Btn>
            </div>

            <div class="flex-1 min-h-8">
              <Btn icon={
                <svg xmlns="http://www.w3.org/2000/svg" class="w-[22px] h-[24px]" viewBox="0 0 256 256">
                  <path fill="currentColor" d="M212.92 25.69a8 8 0 0 0-6.86-1.45l-128 32A8 8 0 0 0 72 64v110.08A36 36 0 1 0 88 204v-85.75l112-28v51.83A36 36 0 1 0 216 172V32a8 8 0 0 0-3.08-6.31M52 224a20 20 0 1 1 20-20a20 20 0 0 1-20 20m36-122.25v-31.5l112-28v31.5ZM180 192a20 20 0 1 1 20-20a20 20 0 0 1-20 20" />
                </svg>
              }
                onclick={() => { }}
              >
              </Btn>
            </div>
          </div> */}

          <div class="w-[136.5px] border-r-2 border-primary border-opacity-80 pt-[2px] text-base-content">

            <div class={["cursor-pointer flex w-full pl-[6px] pr-[9px] hover:bg-secondary", loadOpenCategory === 'synths' ? 'bg-secondary bg-opacity-20 text-primary hover:bg-opacity-20' : 'hover:bg-opacity-15']}
              onmousedown={() => state.loadOpenCategory = 'synths'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-[16px] h-[20px]" viewBox="0 0 256 256">
                <g fill="currentColor">
                  <path d="M128 64v64H24Zm104 64H128v64Z" opacity="0.5" />
                  <path d="m236.19 134.81l-104 64A8 8 0 0 1 120 192V78.32l-91.81 56.49a8 8 0 0 1-8.38-13.62l104-64A8 8 0 0 1 136 64v113.68l91.81-56.49a8 8 0 0 1 8.38 13.62" />
                </g>
              </svg>
              <span class="text-sm ml-1 tracking-tight">synths</span>
            </div>

            <div class={["cursor-pointer flex w-full pl-[6px] pr-[9px] hover:bg-secondary", loadOpenCategory === 'effects' ? 'bg-secondary bg-opacity-20 text-primary hover:bg-opacity-20' : 'hover:bg-opacity-15']}
              onmousedown={() => state.loadOpenCategory = 'effects'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-[16px] h-[16px] mt-[2px]" viewBox="0 0 48 48">
                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="3.5">
                  <path d="M24 17V31" />
                  <path d="M33 11V37" />
                  <path d="M6 17V31" />
                  <path d="M42 18V30" />
                  <path d="M15 4V44" />
                </g>
              </svg>
              <span class="text-sm ml-1 tracking-tight">effects</span>
            </div>

            <div class={["cursor-pointer flex w-full pl-[6px] pr-[17px] hover:bg-secondary", loadOpenCategory === 'midi' ? 'bg-secondary bg-opacity-20 text-primary hover:bg-opacity-20' : 'hover:bg-opacity-15']}
              onmousedown={() => state.loadOpenCategory = 'midi'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-[16px] h-[18px] mt-[.6px]" viewBox="0 0 256 256">
                <path fill="currentColor" d="M212.92 25.69a8 8 0 0 0-6.86-1.45l-128 32A8 8 0 0 0 72 64v110.08A36 36 0 1 0 88 204v-85.75l112-28v51.83A36 36 0 1 0 216 172V32a8 8 0 0 0-3.08-6.31M52 224a20 20 0 1 1 20-20a20 20 0 0 1-20 20m36-122.25v-31.5l112-28v31.5ZM180 192a20 20 0 1 1 20-20a20 20 0 0 1-20 20" />
              </svg>
              <span class="text-sm ml-1 tracking-tight">midi</span>
            </div>

          </div>

          <div class="border-l-4 border-primary-content text-sm tracking-tight w-full">
            <div class="sounds">
              <ul>
                {['kick 909', 'snare 808', 'hh open'].map(sound =>
                  <li class={['cursor-pointer hover:bg-secondary pl-3', sound === 'hh open' ? 'bg-secondary text-primary bg-opacity-20 hover:bg-opacity-20' : 'hover:bg-opacity-15']}>{sound}</li>
                )}
              </ul>
            </div>
          </div>

        </section>
      )
    }
    else {
      loadDiv.innerHTML = ''
    }
  })

  $.fx(() => {
    const { path, mode } = state
    $()
    if (mode !== 'edit' && mode !== 'dev') {
      sidebar.replaceChildren()
    }
    else sidebar.replaceChildren((() => {
      switch (path) {
        case '/bench':
          return <div />

        default:
          return <div>
            {loadDiv}
            {code.canvas}
            {code.textarea}

            {false &&
              <div class={`absolute flex bottom-0 left-0 bg-base-300 border-t-black border-t-2 text-primary z-50 h-14 items-center justify-items-center w-[349px]`}>
                <Btn onclick={() => { }} icon={
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-[20px] w-[20px] mt-[1px]" viewBox="0 0 32 32">
                    <defs>
                      <path id="carbonNewTab0" fill="currentColor" d="M26 26H6V6h10V4H6a2.002 2.002 0 0 0-2 2v20a2.002 2.002 0 0 0 2 2h20a2.002 2.002 0 0 0 2-2V16h-2Z" />
                    </defs>
                    <use href="#carbonNewTab0" />
                    <use href="#carbonNewTab0" />
                    <path fill="currentColor" d="M26 6V2h-2v4h-4v2h4v4h2V8h4V6z" />
                  </svg>
                }>new</Btn>
                <Btn onclick={() => {
                  state.isLoadOpen = !state.isLoadOpen
                }} icon={
                  <svg xmlns="http://www.w3.org/2000/svg" class={() => ["h-[20px] w-[20px] mt-[0px]", state.isLoadOpen && "text-primary"]} viewBox="0 2 20 20">
                    <path fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 20h12m-6-4V4m0 0l3.5 3.5M12 4L8.5 7.5" />
                  </svg>
                }>load</Btn>
                <Btn onclick={() => { }} icon={
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-[22px] w-[22px] mt-[-.5px]" viewBox="0 0 32 32">
                    <path fill="currentColor" d="m27.71 9.29l-5-5A1 1 0 0 0 22 4H6a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V10a1 1 0 0 0-.29-.71M12 6h8v4h-8Zm8 20h-8v-8h8Zm2 0v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8H6V6h4v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.41l4 4V26Z" />
                  </svg>
                }>save</Btn>
                <Btn onclick={() => { }} icon={
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-[20px] w-[20px] mt-[0px]" viewBox="0 0 512 512">
                    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M83 384c-13-33-35-93.37-35-128C48 141.12 149.33 48 256 48s208 93.12 208 208c0 34.63-23 97-35 128" />
                    <path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" d="m108.39 270.13l-13.69 8c-30.23 17.7-31.7 72.41-3.38 122.2s75.87 75.81 106.1 58.12l13.69-8a16.16 16.16 0 0 0 5.78-21.87L130 276a15.74 15.74 0 0 0-21.61-5.87Zm295.22 0l13.69 8c30.23 17.69 31.74 72.4 3.38 122.19s-75.87 75.81-106.1 58.12l-13.69-8a16.16 16.16 0 0 1-5.78-21.87L382 276a15.74 15.74 0 0 1 21.61-5.87Z" />
                  </svg>
                }>solo</Btn>
                <Btn onclick={() => { }} icon={
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-[22px] w-[22px] mt-[-1.5px]" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 3.75v16.5a.75.75 0 0 1-1.255.555L5.46 16H2.75A1.75 1.75 0 0 1 1 14.25v-4.5C1 8.784 1.784 8 2.75 8h2.71l5.285-4.805A.75.75 0 0 1 12 3.75M6.255 9.305a.748.748 0 0 1-.505.195h-3a.25.25 0 0 0-.25.25v4.5c0 .138.112.25.25.25h3c.187 0 .367.069.505.195l4.245 3.86V5.445ZM16.28 8.22a.75.75 0 1 0-1.06 1.06L17.94 12l-2.72 2.72a.75.75 0 1 0 1.06 1.06L19 13.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L20.06 12l2.72-2.72a.75.75 0 0 0-1.06-1.06L19 10.94z" />
                  </svg>
                }>mute</Btn>
              </div>
            }
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

          const redrawEditors = () => {
            code.clearCanvas()
            code.drawBigScrollbar()
            editors.forEach(editor => {
              editor.drawText()
            })
            code.drawSeparators()
          }

          $.fx(() => {
            surface!.anim.ticks.add(redrawEditors)
            return () => {
              surface!.anim.ticks.delete(redrawEditors)
            }
          })

          $.fx(() => {
            const { redraw } = code.info
            $()
            if (!surface!.anim.info.isRunning) redrawEditors()
            surface!.anim.info.epoch++
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

          info.grid ??= Grid(surface)
          // info.grid.write()

          textDraw ??= TextDraw(surface, info.grid, view)
          headsDraw ??= Heads(textDraw.c, surface, info.grid, view)

          minimap ??= Minimap(info.grid)
          minimapDiv.append(minimap.canvas)
          minimapDiv.append(minimap.handle)

          bench.add('draw()', () => {
            return () => {
              surface?.webgl.draw()
            }
          }, { times: 10 })

          return <div>
            {surface.canvas}
            {textDraw.canvas}
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
      <div class={`lg:min-w-[348px] mt-[1px]`}>
        <a class="btn hover:bg-base-100 border-none bg-transparent text-[1.135rem] text-primary font-bold h-10 min-h-10 px-3">
          {state.name}
        </a>
      </div>,

      <div>
        <Btn onclick={() => { }}>{/* play button */}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-[27px] w-6" preserveAspectRatio="xMidYMid slice" viewBox="0 0 24 24">
            <path fill="none" stroke={() => state.colors.primary} stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M7 17.259V6.741a1 1 0 0 1 1.504-.864l9.015 5.26a1 1 0 0 1 0 1.727l-9.015 5.259A1 1 0 0 1 7 17.259" />
          </svg>
        </Btn>
        <Btn onclick={() => { }}>{/* stop button */}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-[22.5px] w-5" preserveAspectRatio="xMidYMid slice" viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M5 8.2v7.6c0 1.12 0 1.68.218 2.107c.192.377.497.683.874.875c.427.218.987.218 2.105.218h7.607c1.118 0 1.676 0 2.104-.218c.376-.192.682-.498.874-.875c.218-.427.218-.986.218-2.104V8.197c0-1.118 0-1.678-.218-2.105a2 2 0 0 0-.874-.874C17.48 5 16.92 5 15.8 5H8.2c-1.12 0-1.68 0-2.108.218a1.999 1.999 0 0 0-.874.874C5 6.52 5 7.08 5 8.2" />
          </svg>
        </Btn>
      </div>,

      minimapDiv,

      <MainBtn label="take" icon={
        <svg xmlns="http://www.w3.org/2000/svg" class="h-[23px] w-[23px] -ml-[.5px] mt-[1.33px]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 16 16">
          <path fill="currentColor" d="m 10.878 0.282 l 0.348 1.071 a 2.205 2.205 0 0 0 1.398 1.397 l 1.072 0.348 l 0.021 0.006 a 0.423 0.423 0 0 1 0 0.798 l -1.071 0.348 a 2.208 2.208 0 0 0 -1.399 1.397 l -0.348 1.07 a 0.423 0.423 0 0 1 -0.798 0 l -0.348 -1.07 a 2.204 2.204 0 0 0 -1.399 -1.403 l -1.072 -0.348 a 0.423 0.423 0 0 1 0 -0.798 l 1.072 -0.348 a 2.208 2.208 0 0 0 1.377 -1.397 l 0.348 -1.07 a 0.423 0.423 0 0 1 0.799 0 m 4.905 7.931 l -0.765 -0.248 a 1.577 1.577 0 0 1 -1 -0.999 l -0.248 -0.764 a 0.302 0.302 0 0 0 -0.57 0 l -0.25 0.764 a 1.576 1.576 0 0 1 -0.983 0.999 l -0.765 0.248 a 0.303 0.303 0 0 0 0 0.57 l 0.765 0.249 a 1.578 1.578 0 0 1 1 1.002 l 0.248 0.764 a 0.302 0.302 0 0 0 0.57 0 l 0.249 -0.764 a 1.576 1.576 0 0 1 0.999 -0.999 l 0.765 -0.248 a 0.303 0.303 0 0 0 0 -0.57 z M 10.402 11.544 H 3.973 A 1.5 1.5 0 0 1 2.455 10.629 v -5.089 A 1.5 1.5 0 0 1 3.527 4.713 h 3.728 c 1.165 0.022 -1.161 -0 -1.116 -1.317 H 3.339 A 2.5 2.5 0 0 0 1 5.5 v 5 A 2.5 2.5 0 0 0 3.5 13 h 9 a 2.5 2.5 0 0 0 2.5 -2.5 v -0.178 a 0.54 0.54 0 0 0 -0.022 0.055 l -0.371 1.201 c -0.962 0.995 -1.937 0.635 -2.61 -0.198" />
        </svg>
      } onclick={() => {
      }}>
        photo
      </MainBtn>
      ,

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


      <MainBtn label={mode} onclick={() => {
        if (state.mode === 'edit') {
          state.mode = 'wide'
        }
        else if (state.mode === 'wide') {
          state.mode = 'dev'
        }
        else {
          state.mode = 'edit'
        }
      }}>
        mode
      </MainBtn>,

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
      </Btn>,

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
