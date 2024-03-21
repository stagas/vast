import { $ } from 'signal-jsx'
import { compressUrlSafe, decompressUrlSafe } from 'urlsafe-lzma'
import { checksum, debounce, pick } from 'utils'
import { Project, ProjectData } from './dsp/project.ts'

function parse(timestamp: number, text: string) {
  const id = checksum(text)
  const res = decompressUrlSafe(text)
  const json = JSON.parse(res) as ReturnType<Lib['save']>

  const [
    title,
    creator,
    remix_of,
    bpm,
    pitch,
    sources,
    tracks,
  ] = json

  const project = Project({
    id,
    timestamp,
    title,
    creator,
    remix_of,
    bpm,
    pitch,
    sources: sources.map(code => ({ code })),
    tracks: tracks.map(([notes, boxes]) => ({
      notes: notes.map(([n, time, length, vel]) => ({
        n,
        time: Math.max(0, time),
        length,
        vel,
      })),
      boxes: boxes.map(([source_id, time, length, pitch, params]) => ({
        source_id,
        time: time + 1024,
        length,
        pitch,
        params: (params ?? []).map(([name, values]) => ({
          name,
          values: (values ?? []).map(([time, length, slope, amt]) => ({
            time,
            length,
            slope,
            amt,
          }))
        })),
      }))
    })),
    comments: []
  })

  // console.log(project)

  return project
}

class Lib {
  save = debounce(300, $.fn((json: ProjectData) => {
    const minified = [
      json.title,
      json.creator,
      json.remix_of,
      json.bpm,
      json.pitch,
      json.sources.map(s => s.code ?? ''),
      json.tracks.map(t => [
        t.notes.filter(n => n.n != null).map(n => [
          n.n,
          n.time,
          n.length,
          n.vel,
        ] as const),
        t.boxes.map(b => [
          b.source_id,
          b.time - 1024,
          b.length,
          b.pitch,
          ...(!b.params.length ? [] : [b.params.map(p => [
            p.name,
            ...(!p.values.length ? [] : [p.values.map(v => [
              v.time,
              v.length,
              v.slope,
              v.amt,
            ] as const)])
          ] as const)]),
        ] as const)
      ] as const)
    ] as const
    if (json.tracks.length === 0) return minified
    const text = JSON.stringify(minified)
    const res = compressUrlSafe(text, { mode: 9, enableEndMark: false })
    const id = checksum(res)
    if (id === json.id) {
      console.log('[save] no changes - nothing to save')
      return minified
    }
    console.log(res, res.length)
    history.replaceState({}, '', '?t=' + (new Date()).toISOString() + '&p=' + encodeURIComponent(res))
    console.log('[save] saved in url', location.href)
    return minified
  }))

  @$.fx save_on_change() {
    const { project } = $.of(this)
    const { data, tracks } = project.info

    const {
      id,
      timestamp,
      title,
      creator,
      remix_of,
      bpm,
      pitch,
    } = data

    const json: ProjectData = {
      id,
      timestamp,
      title,
      creator,
      remix_of,
      bpm,
      pitch,
      sources: data.sources.map(s => ({
        code: s.code ?? ''
      })),
      tracks: tracks.map(t => ({
        notes: t.info.notesJson,
        boxes: t.info.boxes.map(b => ({
          ...pick({ ...b.data }, [
            'source_id',
            'time',
            'length',
            'pitch',
          ]),
          params: b.data.params.map(p => ({
            ...p,
            values: p.values.map(v => ({ ...v }))
          }))
        }))
      })),
      comments: []
    }
    $()
    project.info.isLoaded = true
    this.save(json)
  }

  @$.fn boot() {
    const lib = this
    if (lib.project) return

    const searchParams = new URL(location.href).searchParams
    if (searchParams.has('p')) {
      const text = searchParams.get('p')
      if (text) {
        try {
          const time = new Date(searchParams.get('t')!).getTime()
          const project = parse(time, text)
          lib.project = project
          return
        }
        catch (e) {
          console.warn(e)
        }
      }
    }

    // const demo_p = `XQAAAALBDQAAAAAAAAAtiKxZCEM6Xo7_UU1sLI6CbXpMLf4dmQQ_APXnu-zKBCHhJIyxotjwniEqZZ_Jktb68T2Cfx5Ypg9n5xhpWj6InGwfUsL48fswLsXQCmmsLGrLaHGv9UNPIxuRDUTt-7orn23Q8tOAf3NOe-uK5cyZHsi8qUuqSZpZNvcR6MM7Uq01BvptvjO_QKKTFt50Qrg9UtoknLqCvDe7qoVIqWNp-KOfTaOIfUZ439PGjDmBkf7RuEqiQ_wAbvgvuPUtDG0rkMXDyz35RDrSLa_TT_61VCvfnZhfl_bwbPbYOJf0wvMi4GAcqHT57xgrUYaww0YG3g4of2X4ZE6xexcaf91GaKFQ1exDT974_KZh8jJVPAL1VwSpo6ylV23gVZ7CWlJyXofwwWODVit5MCRFoFOCyHkyQLFtnCVCA57-fyW12c8ZRmFqJzSGQpNrGrZMZexVC4LWdT0V1TBAzeHcapmxw26ErywgC-QxtVHt45vd9C8IbMHxEP1jOTyDzy69IIBHQbKA4CaHQVFAGI7sPc82skCVpujtmfkpO7wO-D1J1RwnJH5ed6EiYzpWXqbLwAydSKKqj6UVClIdvGtfstLn9AnsqeqNLUpnQTkx98jvGB-2i9dSg0Nw0KsJaUNWmVcDliJP44OxRbzab6DGG7XEVyLiC7sEM688Vi4w8R1wiJXZDWGrDeCW4lJEoixEkk2cv8JyitSMz6oi8sxzDidSTIcVhNEW0IK96riDBR5hDto4a6fRLYrujpyMb2tVQeoH8nsFZp2i0zCwOzjCFZHAmOLYDV4QPtjJ2Kvux4O3PMAt5je43nbo6-qHBWJ-VrOIJTWAFO4FZ-XULpb_ArVx6VAZ5_bG_Oh-rsx1FCPOyCBs2FU8lhOr_le8d2kNhkUCR-ABmr6hvULbdn5UM8B-Rf0Jyzsew3WVpt1Im1D27uUXwcqoyPSQAgLSrxff1qJPEjyOv8cUDZPtZh51M_tTYNk2uRxIYbjcbxiYOgJV61OmwKY6tDe5DVT84lwobIJzUu7fksTm_M1eCwUhbg2a_GqDz6Z1ZBWgazw4C5zIM5dZ-VEykYtVRxZUiIiTW8NK06rLSOyT5isikueLjhIOmFofXp6ls_NGaHcOUH1sOg4bkAJShx3yw88EIFDZyYo2TGjmT7pMKmjI3m-tJNrDlpSqiEcgDmUrpq14p_XzDjVfHwEBHlYdSY1qWrNtpnpXJDcHplK_IsWiGYjumsQ46uI38kaQcCgt2GMGbtFB1wLuMFjX9Oo2dXk0CPt27VHLgQD3plzQgwjcpzUvzPK_Tokjpb88sPmom_yQoB4CU81SN-dxDTMm0vB1ya_Yl4TQBZOyci_brjoheXGadLiJKQg_uXHQhFt1RrsHn1c9cxmz3Dh6BWvRcKx0m2DfZJW0221Em2Nfmlcjpyf8fNeFhX9VJ9e-AtrWlRAA`
    // const demo_p = `XQAAAAKXDAAAAAAAAAAtiKxZCEM6Xo7_UU1sLI6CbXpMLf4dmQQ_APXnu-zKBCHhJIyxopIWNu081_Gly9-GKyh0Rxu1Sv4MBqh1nixvTD9AIJFKgVsgxQG8M_5tQTMnnQqVuQYJNex0VNLJkwcgBK5oH0ZIhZSns83HGEKQMykVjb4eAHAkbpyZtiykfoChZNVNx1-wAJmRczxUudh0puJfPeDDRB9ZoBMHxaed1CsKHNyBloOwPj18iRIuhtl4hfAwD_hkI8gCuDe_RSgOm1DLLofc_BOP5BfweCLnSy_6X4smm3NfF_YtbUgj_W8yP3fbFjJTVwfS1-0KsRQBjw4UHfT4RDVEnWYOdTIBQS-TjkKccNLmIPtAynq6_OPOdHdN-0Cn6Qk7F_XSzMaByo7lxc9AHoOb7c-h8UhQpvGE-CIF0xLSTtx2J7qIWLrIgo-yM0CUblubdXoqqXY0zVVq-S7HJ87ZseRONJAt-8qFr0P_awRELrsiuX1AwaznWHrlom9L8a8s93P57F4Iiv0Y4W96VZ0Kxje80T34A1mFWChMHUENm4fHWG6wS5DlZiWMOqDF4go1-4pM8SMxHlJnBfPx8Sw54EM4uZxugTqbsFVnuyaCrcgZI6Q4FvSt_6BaVd0yCUcuThIjUOKAMEpxFB2I-QYH2GfhsYbL_T5X10wu1Bbzmq3BcMwMWQNqSRVCDKT8zOH8L3oycsojJyB0jnFUEL0M5HOjM_K_Hjtt73cNdhWjn-icNOtF7at_cK-vElalIY-pfCkBN6M0_--6MnzyAyaqHMdjv7oI8-ZNLPTXjnQ5s35VxDQgwu1WTVOhQiRt8y0eaXP0EimNJsmz0EIbFMFvNuU11mTJugkDtrUDWNAa7eXfsdr1SmyNPqz75fxXBrNH3BMoIBE7gWlcawmCXrsuBow9gibkj5RsDTn61T081bq_a4w1fcAlOq6OQQ_ZS31V2ecsVYtBFJ052wk8Tn1_WtMYbHljWFxtayvPgCvXY6NY0QstGsgd6K4umdwQUrSZHBDXwrr6nfxuwgMFCxnwblqlEUJOF05AT2cdQOpLDodYVE7oTOs1J0bKQPCJxHXYoni8KfPVCb0ouk-NnhsA`
    const demo_p = `XQAAAAKXDAAAAAAAAAAtiKxZCEM6Xo7_UU1sLI6CbXpMLf4dmQQ_APXnu-zKBCHhJIyxopIWNu081_Gly9-GKyh0Rxu1Sv4MBqh1nixvTD9AIJFKgVsgxQG8M_5tQTMnnQqVuQYJNex0VNLJkwcgBK5oH0ZIhZSns83HGEKQMykVjb4eAHAkbpyZtiykfoChZNVNx1-wAJmRczxUudh0puJfPeDDRB9ZoBMHxaed1CsKHNyBloOwPj18iRIuhtl4hfAwD_hkI8gCuDe_RSgOm1DLLofc_BOP5BfweCLnSy_6X4smm3NfF_YtbUgj_W8yP3fbFjJTVwfS1-0KsRQBjw4UHfT4RDVEnWYOdTIBQS-TjkKccNLmIPtAynq6_OPOdHdN-0Cn6Qk7F_XSzMaByo7lxc9AHoOb7c-h8UhQpvGE-CIF0xLSTtx2J7qIWLrIgo-yM0CUblubdXoqqXY0zVVq-S7HJ87ZseRONJAt-8qFr0P_awRELrsiuX1AwaznWHrlom9L8a8s93P57F4Iiv0Y4W96VZ0Kxje80T34A1mFWChMHUENm4fHWG6wS5DlZiWMOqDF4go1-4pM8SMxHlJnBfPx8Sw54EM4uZxugTqbsFVnuyaCrcgZI6Q4FvSt_6BaVd0yCUcuThIjUOKAMEpxFB2I-QYH2GfhsYbL_T5X10wu1Bbzmq3BcMwMWQNqSRVCDKT8zOH8L3oycsojJyB0jnFUEL0M5HOjM_K_Hjtt73cNdhWjn-icNOtF7at_cK-vElalIY-pfCkBN6M0_--6MnzyAyaqHMdjv7oI8-ZNLPTXjnQ5s35VxDQgwu1WTVOhQiRt8y0eaXP0EimNJsmz0EIbFMFvNuU11mTJugkDtrUDWNAa7eXfsdr1SmyNPqz75fxXBrNH3BMoIBE7gWlcawmCXrsuBow9gibkj5RsDTn61T081bq_a4w1fcAlOq6OQQ_ZS31V2ecsVYtBFJ052wk8Tn1_WtMYbHljWFxtayvPgCvXY6NY0QstGsgd6K4umdwQUrSZHBDXwrr6nfxuwgMFCxnwblqlEUJOF05AT2cdQOpLDodYVE7oTOs1J0bKQPCKMyLXC4fCmBnR1BD05eUEOZ4A`
    lib.project = parse(Date.now(), demo_p)

    // const sources = [
    //   lib.cool_bass_source,
    //   lib.demo_source_kick,
    //   lib.demo_source_hihat,
    //   lib.demo_source_eyo,
    //   lib.demo_source_radio_signals,
    // ]

    // let count = 4
    // const length = 2
    // lib.project = Project({
    //   id: 0,
    //   timestamp: 0,
    //   title: '',
    //   creator: '',
    //   remix_of: 0,
    //   bpm: 0,
    //   pitch: 0,
    //   sources,
    //   tracks: Array.from(sources, (_, y) => ({
    //     notes: [],
    //     boxes: Array.from({ length: count }, (_, x) => ({
    //       source_id: y,
    //       time: 1024 + (x * length),
    //       length,
    //       pitch: 0,
    //       params: []
    //     })),
    //   })),
    //   comments: []
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
[sin 80.01 500 [decay .168 128 x] + t x*]
[decay .097 17 x]
} kick=

[kick 4]
`
  }

  t2_source = {
    code: `;;;hihat
{ hz= [saw hz t] [ramp hz t .7389] + } p=
[p 1130][p 1450][p 300][p 620][p 800][p 600]
@ 4* [dclipexp 4.1] clip 8*
[bhp 9100 1.42] [bbp 5400 1.42]
[exp 16 co* t] .81^ [lp 70] *
(.6 .48 1 .54) t 16 * ? *
.2* clip 1*
`
  }

  t3_source = {
    code: `;;;eyo
[sin (513 213) t .5 * ? 111
[sin 500.25 co* t] * + ]
[sin 123 .2
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

  cool_bass_source = {
    code: `{ n= f= nt= v=
[adsr 2.5 50 .3 50 nt t 16 * .8 +] env=
[saw f [sqr .1] .10 * +] env * v *
[slp 500 700 env * + .61]
A= A [delay 502 250 [tri 1.25 co*] * + ] A @ clip
} midi_in=
`
  }

  radio_signals_source = {
    code: `;;;radio signals
[saw 8]
[sin 4] *
[sin 86
 [sin .15 co* t .125*] 9710 * +]
[exp 1 co* t] * +
[delay 221.25 .91]
[clip 2] 1.49 *
[exp 16 co* t] .55^ [lp] *
[shp 2150]
@ [slp 1833]
1.5 *
`
  }

  demo_source_kick = {
    code: `;;;kick
{ x=
[sin 84.01 500 [decay .168 178 x] + t x*]
[decay .021 37 x]
} kick=

[kick 4]
`
  }

  demo_source_hihat = {
    code: `;;;hihat
{ hz= [saw hz t] [ramp hz t .7389] + } p=
[p 1130][p 450][p 300][p 620][p 800][p 600]
@ 4* [dclipexp 4.1] clip 8*
[bhp 9100 1.42] [bbp 7400 0.72]
[exp 16 co* t] .81^ [lp 70] *
(.6 .48 1 .54) t 16 * ? *
.2* clip 1*
`
  }

  demo_source_eyo = {
    code: `;;;eyo
[sin (11 11) t .5 * ? 1444
[sin 500.25 co* t] * + ]
[sin 123 .2
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
.5 *
`
  }

  demo_source_radio_signals = {
    code: `;;;radio signals
[saw 80]
[sin 4] *
[sin 6
 [sin .15 co* t .125*] 221 * +]
[exp 1 co* t] * +
[delay 100.25 .91]
[clip 2] 1.49 *
[exp 6 co* t] .55^ [lp] *
[shp 1150]
@ [slp 833]
1.5 *
`
  }

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

export const lib = $(new Lib)
