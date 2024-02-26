import { Theme } from 'daisyui'
import themes from 'daisyui/src/theming/themes'
import { $, storage } from 'signal-jsx'
import { Matrix } from 'std'
import { Task } from 'tinybench'
import { Token, tokenize } from './lang/tokenize.ts'
import { Source } from './source.ts'
import { LerpMatrix } from './util/geometry.ts'
import { hexToInt } from './util/rgb.ts'
import { Mesh } from './webgl.ts'
import { AnimMode } from './world/anim.ts'
import { Track } from './dsp/track.ts'

const DEBUG = true

class State {
  name = 'ravescript'

  pr = window.devicePixelRatio
  theme = storage<Theme>('dark')
  get colors() {
    // console.log(themes[state.theme] )
    return themes[state.theme]
  }
  get primaryColorInt() {
    return hexToInt(state.colors.primary)
  }

  mode = storage('edit')

  pages = ['share', 'download', 'my tracks', 'my sounds', 'about']
  page = '' //this.pages[0]
  path = location.pathname

  isLoadOpen = false
  loadOpenCategory = 'synths'

  isHoveringToolbar = false
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
  viewMatrix = $(new LerpMatrix(), { threshold: .15 })
  codeMatrix = $(new Matrix())
  codeViewMatrix = $(new LerpMatrix(), { threshold: .15 })
  lastFarMatrix = $(new Matrix())
  targetMatrix = $(new Matrix())
  zoomState = 'far'

  meshes = new Set<Mesh>()

  tracks = [] as Track[]


  t1_source = $(new Source<Token>(tokenize), {
    code: `;;;kick
{ x=
[sin 52.01
  500 [decay .45 8 x] +
  t x*
] [decay .015 20 x]
} kick=

[kick 4]
`
  })

  t2_source = $(new Source<Token>(tokenize), {
    code: `;;;hihat
{ hz=
[saw hz t]
[ramp hz t .39] +
} x=
[x 130][x 400][x 300]
[x 620][x 800][x 600]
@  4*
[dclipexp 4.1]
clip 8*
[bhp 7000 2.92]
[bbp 8000 2.552]
[exp 16 co* t] .41^ [lp 510] *
(.6 .48 1 .54) t 16 * ? *
.2* clip 1*
`
  })

  t3_source = $(new Source<Token>(tokenize), {
    code: `;;;eyo
[sin (313 1313) t .125 * ? 111
[sin .25 co* t] * + ]
[sin 313 20
 [sin 8 co* t] * +
 t] *
[sin 1721
1 [sin 4 co* t] - 1200 * +]
[exp 26 t] * + a= a .7*
[delay 148 .91] a +
[clip 2] 1.49 *
[exp 44144 t] [lp] *
[lp] [shp 850]
[inc .097 t 4*] clip 1.8^ *
2 *
`
  })

  t4_source = $(new Source<Token>(tokenize), {
    code: `;;;radio signals
[sin 344]
[sin 32] *
[sin 186
 [sin .125 co* t .25*] 3700 * +]
[exp 1 co* t] * +
[delay 11 .91]
[clip 2] 1.49 *
[exp 16 co* t] [lp] *
[shp 1250]
@ [slp 833]
1.5 *
`
  })

  source = $(new Source<Token>(tokenize), {
    code: `;;;bass
{ tt= x=
[saw (42.01 84 120) tt x * ?
 1000 [decay 1.25 8 x] +
 tt x*
] [decay .015 20 x]
} bass=

[bass 9 t .5*]
`

    //     `;;;kick
    // { x=
    // [sin 52.01
    //  500 [decay .45 8 x] +
    //  t x*
    // ] [decay .095 20 x]
    // } kick=

    // [kick 4]
    // `

    //     `[saw 232.01]
    // [decay .05 5 16]`
    //     `[saw 232.01]
    // 1 [inc .083 co* t 4*] clip - *`
    //     `[saw 22.01]
    // 1 [inc .1 co* t 4*] clip - *`
    //`[saw 22.01] 1 [inc .1 co* t] clip - *`
    //`[saw 22.01] [exp 2 co*] *` //`[inc .01]`

    // `; techno kick
    // 1 [inc .185 t 4*]
    //  clip - 4.2^
    //  env=
    // [inc 5.5 t 4*]
    //  clip 55^
    // [inc .17 t 4*]
    //  clip 8.85^ 1- *
    //  env2=
    // [sin 86 112 env* + t 4*]
    //  env2*
    // .50*
    // `
    //  `; square after bass
    // [sqr (90 104 90 127) t ?
    //  [sqr 8 co* t .5*] norm 13 *
    //  [tri 12 co* t .5*] norm 7 *
    //  + + t]

    //  [exp 16 co* t] 2.0^ [lp 8] *
    //  [exp .5 co* t] .01^ [lp 4] *

    // [slp 3000 4000 [tri 1] *
    //  [exp 16 co* t] .57^ [lp 42] *
    //  + 0.75]

    // [inc .11 t 4*] clip 50.15^
    //  .3 + clip *

    //  .6*
    // `
  })

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
