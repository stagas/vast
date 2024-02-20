export function MainBtn({ icon, label, onclick, children }: { icon?: JSX.Element | string | null, label: JSX.Element | string | (() => string | JSX.Element), onclick: () => void, children?: any[] }) {
  return <button class="btn" onclick={onclick}>
    {icon}
    <div class="flex flex-col items-center justify-center">
      <span class="text-xs h-4 -mt-[3px] -mb-[5px] font-light text-base-content text-opacity-50">
        {label}
      </span>
      {children}
    </div>
  </button>
}

export function Btn({ icon, onclick, children }: { icon?: JSX.Element | string | null, onclick: () => void, children?: any[] }) {
  return <button class="btn relative flex flex-col items-center justify-items-center" onclick={onclick}>
    {icon && <div class="box-border flex-0 h-[19px] pl-2 pr-2">{icon}</div>}
    <div class="flex flex-col items-center justify-center">
      {children}
    </div>
  </button>
}
