import { $, of } from 'signal'
import { Matrix } from 'std'

export class Misc {
  innerMatrix = $(new Matrix)
  lineComment: string = ';'
  isFocused = false
  isTyping = false
  isPanning = false
  isScrolling = false
  wasScrolling = false
  isHandlingSlider = false
}
