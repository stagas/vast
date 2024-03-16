import { Theme } from 'daisyui'
import themes from 'daisyui/src/theming/themes'
import { screen } from '../screen.tsx'

export function ThemePicker() {
  return <div class="dropdown bg-none h-full">
    <button tabindex="0" role="button" class="m-0 p-3 hover:bg-base-100 focus:ring-1 focus:ring-accent text-primary hover:text-primary">
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        viewBox="-1 -.25 19 15.5"
        class="h-5 w-5"
      >
        <circle stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.85" cx="8" cy="8" r="6" />
      </svg>
    </button>
    <ul tabindex="0" class="dropdown-content z-[1] bg-base-300 menu menu-s p-2 shadow grid-rows-7 grid grid-cols-5 w-[550px] right-0">
      {Object.keys(themes).map(theme =>
        <li><a
          class={() => [
            "hover:bg-base-100 hover:text-primary",
            screen.info.theme === theme && "bg-base-100 text-primary"
          ]}
          onclick={() => screen.info.theme = theme as Theme}
        >{theme}</a></li>
      )}
    </ul>
  </div>
}
