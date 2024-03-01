import { $ } from 'signal-jsx'

export const MAX_NOTE = 121
export const BLACK_KEYS = new Set([1, 3, 6, 8, 10])
export const KEY_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

export type BoxNotes = Note[] & {
  ptr: number
  scale: ReturnType<typeof getNotesScale>
}

export interface Note {
  n: number
  time: number
  length: number
  vel: number
}

export function createDemoNotes(
  base = 60, // middle C
  count = 3,
  step = 1,
  // length = 1,
) {
  return Array.from({ length: 4 }, (_, i) => {
    const time = i * step * 4
    const length = 1 + Math.round(Math.random() * 4)
    // const count = 1 //+ Math.round(Math.random() * 2)
    // const base = 12 //+ Math.floor(Math.random() * 12)
    const notes: Note[] = []
    const y = base + Math.round(Math.random() * 8)

    for (let n = 0; n < count; n++) {
      const note = {
        n: y + n * (2 + Math.round(Math.random() * 2)),
        time,
        length,
        vel: Math.random()
      }
      notes.push($(note))
    }

    return notes
  }).flat().sort(byNoteN)
}

export function byNoteN(a: Note, b: Note) {
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
  min = Math.max(0, min - 6)
  max = Math.min(MAX_NOTE, max + 6)
  const N = max - min
  return { min, max, N }
}
