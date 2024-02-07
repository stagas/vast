/** @jsxImportSource signal-jsx */
import { cleanup, fx, hmr, mount } from 'signal-jsx'
import { Main } from './comp/Main.tsx'
import { replaceState, state } from './state.ts'

export const start = mount('#container', target => {
  return fx(() => {
    target.replaceChildren(<div><Main /></div>)
    return cleanup
  })
})

if (import.meta.hot) {
  import.meta.hot.accept(hmr(start, state, replaceState))
}
else {
  start()
}
