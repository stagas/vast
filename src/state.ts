import { Theme } from 'daisyui'
import themes from 'daisyui/src/theming/themes'
import { $, storage } from 'signal-jsx'
import { Task } from 'tinybench'
import { Mesh } from './webgl.ts'
import { LerpMatrix } from './util/lerp-matrix.ts'
import { AnimMode } from './world/anim.ts'

const DEBUG = true

class State {
  name = 'Vast'

  theme = storage<Theme>('dark')
  get colors() { return themes[state.theme] }

  pages = ['Page one', 'Page two']
  page = this.pages[0]
  path = location.pathname

  benchIsRunning = false
  benchTasks: Task[] = []

  debugMessage = ''
  debugHistory: string[] = []
  debugUpdated = 0

  animMode = storage(AnimMode.Auto)
  animCycle?: () => void

  matrix = $(new LerpMatrix())
  meshes = new Set<Mesh>()
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
