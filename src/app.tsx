/** @jsxImportSource signal-jsx */
import { cleanup, fx, hmr, mount } from 'signal-jsx'
import { replaceState, state } from './state.ts'
import { Main } from './comp/Main.tsx'

export const start = mount('#container', target => {
  return fx(() => {
    target.replaceChildren(<Main />)
    return cleanup
  })
})

if (import.meta.hot) {
  import.meta.hot.accept(hmr(start, state, replaceState))
}
else {
  start()
}
