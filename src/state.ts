import { Theme } from 'daisyui'
import themes from 'daisyui/src/theming/themes'
import { $, storage } from 'signal-jsx'
import { Matrix } from 'std'
import { Task } from 'tinybench'
import { Token, tokenize } from './lang/tokenize.ts'
import { Source } from './source.ts'
import { LerpMatrix } from './util/geometry.ts'
import { Mesh } from './webgl.ts'
import { AnimMode } from './world/anim.ts'

const DEBUG = true

class State {
  name = 'ravescript'

  pr = window.devicePixelRatio
  theme = storage<Theme>('dark')
  get colors() {
    console.log(themes[state.theme] )
    return themes[state.theme]
    }

  mode = storage('sequencer')

  pages = ['share', 'download', 'my tracks', 'my sounds', 'about']
  page = '' //this.pages[0]
  path = location.pathname

  benchIsRunning = false
  benchTasks: Task[] = []

  debugMessage = ''
  debugHistory: string[] = []
  debugUpdated = 0
  debugConsoleActive = storage(false)

  animMode = storage(AnimMode.Auto)
  animCycle?: () => void

  matrix = $(new Matrix())
  viewMatrix = $(new LerpMatrix(), { threshold: .15 })
  codeMatrix = $(new Matrix())
  codeViewMatrix = $(new LerpMatrix(), { threshold: .15 })
  lastFarMatrix = $(new Matrix())
  targetMatrix = $(new Matrix())
  zoomState = 'far'

  meshes = new Set<Mesh>()

  hoveringBoxToolbar = false

  source = $(new Source<Token>(tokenize), {
    code: `; square after bass
[sqr (90 104 90 127) t ?
 [sqr 8 co* t .5*] norm 13 *
 [tri 12 co* t .5*] norm 7 *
 + + t]

 [exp 16 co* t] 2.0^ [lp 8] *
 [exp .5 co* t] .01^ [lp 4] *

[slp 3000 4000 [tri 1] *
 [exp 16 co* t] .57^ [lp 42] *
 + 0.75]

[inc .11 t 4*] clip 50.15^
 .3 + clip *

 .6*
` })

}

export function log(...x: any[]) {
  if (!DEBUG) return
  state.debugHistory.push(`${x.join(' ')}`)
  state.debugUpdated++
}

export let state = $(new State)

export function replaceState(newState: any) {
  state = newState
}
