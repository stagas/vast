import { Theme } from 'daisyui'
import themes from 'daisyui/src/theming/themes'
import { $, storage } from 'signal-jsx'
import { Matrix } from 'std'
import { Task } from 'tinybench'
import { Token, tokenize } from './lang/tokenize.ts'
import { Source } from './source.ts'
import { LerpMatrix } from './util/geometry.ts'
import { hexToInt, toHex } from './util/rgb.ts'
import { Mesh } from './webgl.ts'
import { AnimMode } from './world/anim.ts'
import { Track } from './dsp/track.ts'
import { ZoomState } from './draws/grid.ts'
import { Project } from './dsp/project.ts'
import { Audio } from './audio.ts'
import { dom } from 'utils'

const DEBUG = true

class State {
  name = 'ravescript'

  // cursor = 'default'
  // overlay = false
  // pr = window.devicePixelRatio
  // theme = storage<Theme>('dark')
  // get colors() {
  //   // console.log(themes[state.theme] )
  //   return themes[state.theme]
  // }
  // get primaryColorInt() {
  //   return hexToInt(toHex(screen.info.colors.primary))
  // }

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
