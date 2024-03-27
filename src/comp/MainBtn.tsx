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

export function Btn({ icon, title, onclick, onpointerdown, children }: { title?: string, icon?: JSX.Element | string | null, onclick?: () => void, onpointerdown?: (e: PointerEvent) => void, children?: any[] }) {
  return <button title={title ?? ''} class="btn relative flex flex-col items-center justify-items-center p-4 mt-[-1px] top-[1px] pt-0 pb-[2px]" onclick={onclick} onpointerdown={onpointerdown}>
    {icon && <div class="box-border flex-0 h-[19px] pl-2 pr-2">{icon}</div>}
    <div class="flex flex-col items-center justify-center">
      {children}
    </div>
  </button>
}
