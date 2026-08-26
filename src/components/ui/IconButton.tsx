import type { ReactNode } from 'react'

interface IconButtonProps {
  children: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  className?: string
}

export function IconButton({
  children,
  label,
  onClick,
  disabled,
  active,
  className,
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${
        active
          ? 'bg-accent-400/15 text-accent-400'
          : 'text-chrome-400 hover:bg-chrome-800 hover:text-chrome-200'
      } disabled:pointer-events-none disabled:opacity-35 ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
