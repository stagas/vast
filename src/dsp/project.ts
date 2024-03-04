import { Signal } from 'signal-jsx'
import { Source } from '../source.ts'
import { tokenize } from '../lang/tokenize.ts'

interface SourceData {
  code?: string
}

interface ValueData {
  time: number
  length: number
  slope: number
  amt: number
}

interface ParamData {
  name: string
  values: ValueData[]
}

export interface BoxData {
  source_id: number
  time: number
  length: number
  pitch: number
  params: ParamData[]
}

export interface TrackData {
  boxes: BoxData[]
}

interface CommentData {
  id: number
  time: number
  nick: string
  avatar: string
  message: string
  reply_to: number
}

export interface ProjectData {
  id: number
  timestamp: number
  title: string
  creator: string
  remix_of: number
  bpm: number
  pitch: number
  sources: Source[]
  tracks: TrackData[]
  comments: CommentData[]
}

export type Project = ReturnType<typeof Project>

export function Project(data: ProjectData, isSaved: boolean = true) {
  using $ = Signal()

  // TODO(Signal): $.deep({...})
  const info = $({
    isSaved,
    data: $(data, {
      tracks: data.tracks.map(track => $(track, {
        boxes: track.boxes.map(box => $(box, {
          track,
          params: box.params.map(param => $(param, {
            values: param.values.map(value => $(value)),
          })),
        })),
      })),
      comments: data.comments.map(comment => $(comment)),
    }),
  })

  return { info }
}
