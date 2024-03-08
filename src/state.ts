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
    return hexToInt(toHex(state.colors.primary))
  }

  mode = storage('edit')

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

  meshes = new Set<Mesh>()

  tracks = [] as Track[]

  case_source = $(new Source<Token>(tokenize), {
    code: `{ n= f= nt= v=

[adsr 2.5 50 .3 50
 nt t 16 * .8 +]
 env=

[saw f [sqr .1] .10 * +]
 env * v *

[slp 500 5700 env * + .61]

A= A [delay 122 20
 [tri .25 co*] * + ] A
 @ clip

} midi_in=
`
  })

  source_midi = $(new Source<Token>(tokenize), {
    code: `; a synth
{ n= f= nt= v=
[exp 1 nt] [lp] env=
[saw f nt] v*
[slp 233 1800 env * + ]
env *
} midi_in=
`
  })

  t1_source = $(new Source<Token>(tokenize), {
    code: `;;;kick
{ x=
[sin 82.01
  1000 [decay .45 38 x] +
  t x*
] [decay .035 60 x]
} kick=

[kick 4]
`
  })

  t2_source = $(new Source<Token>(tokenize), {
    code: `;;;hihat
{ hz=
[saw hz t]
[ramp hz t .389] +
} x=
[x 1130][x 450][x 300]
[x 620][x 800][x 600]
@  4*
[dclipexp 4.1]
clip 8*
[bhp 4800 1.42]
[bbp 9400 1.42]
[exp 16 co* t] .81^ [lp 70] *
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
[saw 48]
[sin 4] *
[sin 486
 [sin .125 co* t .25*] 4710 * +]
[exp 1 co* t] * +
[delay 21.25 .91]
[clip 2] 1.49 *
[exp 2 co* t] .55^ [lp] *
[shp 2150]
@ [slp 1833]
1.5 *
`
  })

  source = $(new Source<Token>(tokenize), {
    code: `;;;bass
{ tt= x=
[saw (40 62 42 40) tt x * ?
 200 [decay .125 8 x] +
 tt x*
] [decay .001 20 x]
} bass=

[bass 8 t .5*]
[slp 500 .3] 1*
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
