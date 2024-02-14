export function MainBtn({ label, onclick, children }: { label: JSX.Element | string | (() => string | JSX.Element), onclick: () => void, children?: any[] }) {
  return <button class="btn" onclick={onclick}>
    <div class="flex flex-col items-center justify-center">
      <span class="text-xs h-4 -mt-1 -mb-1 font-light text-base-content text-opacity-50">
        {label}
      </span>
      {children}
    </div>
  </button>
}
