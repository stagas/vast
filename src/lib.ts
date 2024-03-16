import { $ } from 'signal-jsx'
import { Project } from './dsp/project.ts'

class Lib {
  @$.fn boot() {
    const lib = this
    if (lib.project) return

    // services.audio.player.info.project = lib.project
    // const code = Code()
    // queueMicrotask(() => {
    const sources = [
      lib.case_source,
      lib.kick_source,
      lib.t2_source,
      // lib.t3_source,
      // lib.t4_source,
    ]

    let count = 16
    const length = 1
    lib.project = Project({
      id: 0,
      timestamp: 0,
      title: '',
      creator: '',
      remix_of: 0,
      bpm: 0,
      pitch: 0,
      sources,
      tracks: Array.from(sources, (_, y) => ({
        boxes: Array.from({ length: count }, (_, x) => ({
          source_id: y,
          time: 1024 + (x * length),
          length,
          pitch: 0,
          params: []
        })),
      })),
      comments: []
    })
    // })
  }

  project?: Project

  case_source = {
    code: `{ n= f= nt= v=
[adsr 2.5 50 .3 50 nt t 16 * .8 +] env=
[saw f [sqr .1] .10 * +] env * v *
[slp 500 5700 env * + .61]
A= A [delay 122 20 [tri .25 co*] * + ] A @ clip
} midi_in=
`
  }

  source_midi = {
    code: `; a synth
{ n= f= nt= v=
[exp 1 nt] [lp] env=
[saw f nt] v*
[slp 233 1800 env * + ]
env *
} midi_in=
`
  }

  t1_source = {
    code: `;;;kick
{ x=
[sin 82.01 1000 [decay .45 38 x] + t x*]
[decay .035 60 x]
} kick=

[kick 4]
`
  }

  t2_source = {
    code: `;;;hihat
{ hz= [saw hz t] [ramp hz t .389] + } p=
[p 1130][p 450][p 300][p 620][p 800][p 600]
@ 4* [dclipexp 4.1] clip 8*
[bhp 7800 1.42] [bbp 9400 1.42]
[exp 16 co* t] .81^ [lp 70] *
(.6 .48 1 .54) t 16 * ? *
.2* clip 1*
`
  }

  t3_source = {
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
  }

  t4_source = {
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
  }

  source = {
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
  }

  kick_source = {
    code: `;;;kick
{ x=
[sin 94.01 1000 [decay .168 178 x] + t x*]
[decay .067 17 x]
} kick=

[kick 4]
`
  }

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
  // }
}

export const lib = $(new Lib)
