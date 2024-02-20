import { state } from '../state.ts'

export function MainMenu() {
  return <div class="dropdown bg-none h-full">
    <button tabindex="0" role="button" class="m-0 p-3 pr-[14px] pl-4 hover:text-base-content hover:bg-base-100 focus:ring-1 focus:ring-accent">
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none"
        viewBox="0 -1.25 17 15"
        class="h-5 w-4"
        >
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M1 1h15M1 7h15M1 13h15" />
      </svg>
    </button>
    <ul tabindex="0" class="dropdown-content z-[1] bg-base-300 menu p-2 shadow w-40 right-0">
      {state.pages.map(page =>
        <li><a class={() => `hover:bg-base-100 hover:text-primary ${state.page === page ? "bg-base-100 text-primary" : ""}`}
          onclick={() => state.page = page}
        >{page}</a></li>
      )}
    </ul>
  </div>
}
