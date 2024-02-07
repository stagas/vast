import { Theme } from 'daisyui'
import themes from 'daisyui/src/theming/themes'
import { $, storage } from 'signal-jsx'

class State {
  name = 'Vast'
  theme = storage<Theme>('dark')
  get colors() {
    return themes[state.theme]
  }
  pages = ['Page one', 'Page two']
  page = this.pages[0]
}

export let state = $(new State)

export function replaceState(newState: any) {
  state = newState
}
