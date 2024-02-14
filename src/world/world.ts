import { Matrix, Rect } from 'std'
import { Anim } from './anim.ts'
import { Mouse } from './mouse.ts'

export interface World {
  anim: Anim
  mouse: Mouse
  view: Rect
  matrix: Matrix
}
