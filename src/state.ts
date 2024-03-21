import { $, storage } from 'signal-jsx'
import { Matrix } from 'std'
import { Task } from 'tinybench'
import { ZoomState } from './draws/grid.ts'
import { LerpMatrix } from './util/geometry.ts'
import { AnimMode } from './world/anim.ts'

const DEBUG = true

class State {
  name = 'ravescript'

  mode = storage('audio')

  pages = ['share', 'download', 'my tracks', 'my sounds', 'about']
  page = '' //this.pages[0]
  path = location.pathname

  isLoadOpen = false
  loadOpenCategory = 'synths'

  // isHoveringToolbar = false
  isHoveringHeads = false

  focusedBox = null as null | any

  benchIsRunning = false
  benchTasks: Task[] = []

  debugMessage = ''
  debugHistory: string[] = []
  debugUpdated = 0
  debugConsoleActive = storage(false)

  animMode = storage(AnimMode.Auto)
  animCycle?: () => void

  matrix = $(new Matrix())
  viewMatrix = $(new LerpMatrix(), { threshold: .00015 })
  codeMatrix = $(new Matrix())
  codeViewMatrix = $(new LerpMatrix(), { threshold: .00015 })
  lastFarMatrix = $(new Matrix())
  targetMatrix = $(new Matrix())
  zoomState: ZoomState = ZoomState.Out
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
