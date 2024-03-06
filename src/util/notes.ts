import wasm from 'assembly-gfx'
import { $ } from 'signal-jsx'
import { Note, NoteView } from './notes-shared.ts'

export const MAX_NOTE = 121
export const BLACK_KEYS = new Set([1, 3, 6, 8, 10])
export const KEY_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

export type BoxNotes = BoxNote[] & {
  ptr: number
  scale: ReturnType<typeof getNotesScale>
}

export interface BoxNote {
  info: Note
  data: NoteView
}

export function createDemoNotes(
  base = 32,
  count = 1,
  step = 1,
  // length = 1,
) {
  return Array.from({ length: 8 * 4 }, (_, i) => {
    const time = i * step * 2 + step * 2
    const length = 1 + Math.round(Math.random() * 4)
    // const count = 1 //+ Math.round(Math.random() * 2)
    // const base = 12 //+ Math.floor(Math.random() * 12)
    const notes: { info: Note, data: NoteView }[] = []
    const y = base + Math.round(Math.random() * 8)

    for (let n = 0; n < count; n++) {
      const note = {
        info: $({
          n: y + n * (4 + Math.round(Math.random() * 3)),
          time,
          length,
          vel: Math.random(),
        }),
        data: NoteView(wasm.memory.buffer, wasm.createNote())
      }
      $.fx(() => {
        const { n, time, length, vel } = note.info
        $()
        note.data.n = n
        note.data.time = time
        note.data.length = length
        note.data.vel = vel
      })
      notes.push(note)
    }

    return notes
  }).flat().sort(byNoteN)
}

export function byNoteN({ info: a }: { info: Note }, { info: b }: { info: Note }) {
  return b.n === a.n ? a.time - b.time : b.n - a.n
}

export function getNotesScale(notes: Note[]) {
  let max = -Infinity
  let min = Infinity
  for (const note of notes) {
    if (note.n > max) max = note.n
    if (note.n < min) min = note.n
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0
    max = 12
  }
  min = Math.max(0, min - 4)
  max = Math.min(MAX_NOTE, max + 5)
  const N = max - min
  return { min, max, N }
}

export const ntof = (n: number) => 440 * 2 ** ((n - 69) / 12)
