/** @jsxImportSource signal-jsx */
import { state } from '../state.ts'
import { MainMenu } from './MainMenu.tsx'
import { Page } from './Page.tsx'
import { ThemePicker } from './ThemePicker.tsx'

export function Main() {
  return <main data-theme={() => state.theme} class="bg-base-100 h-full w-full">
    <nav class="navbar bg-base-300 border-b-black border-b-2 p-0 min-h-0">
      <div class="flex-1">
        <a class="btn hover:bg-base-100 border-none bg-transparent text-xl font-light h-10 min-h-10 px-3">{state.name}</a>
      </div>
      <ThemePicker />
      <MainMenu />
    </nav>

    <article>
      <Page />
    </article>
  </main>
}
