import type { ReactNode } from 'react'

export type IconName =
  | 'select'
  | 'draw'
  | 'erase'
  | 'pan'
  | 'text'
  | 'undo'
  | 'redo'
  | 'play'
  | 'pause'
  | 'loop'
  | 'book'
  | 'download'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'gear'
  | 'fit'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'theme'
  | 'sun'
  | 'moon'

const SOLID_ICONS = new Set<IconName>(['play', 'pause'])

const paths: Record<IconName, ReactNode> = {
  select: <path d="M4 3.5 20 11l-7 2-2.5 7z" />,
  draw: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
  erase: (
    <>
      <path d="M6 20h13" />
      <path d="M8.5 17.5 4 13l8.5-8.5 6 6-7 7z" />
      <path d="m9.5 7.5 6 6" />
    </>
  ),
  pan: (
    <path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
  ),
  text: <path d="M5 7V5h14v2M12 5v14M9.5 19h5" />,
  undo: <path d="M8 5 3 10l5 5M3 10h10.5a6.5 6.5 0 0 1 6.5 6.5V19" />,
  redo: <path d="m16 5 5 5-5 5M21 10H10.5A6.5 6.5 0 0 0 4 16.5V19" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <path d="M7.5 5h3.4v14H7.5zM13.1 5h3.4v14h-3.4z" />,
  loop: (
    <path d="M17 2.5 21 6.5l-4 4M21 6.5H8.5A5.5 5.5 0 0 0 3 12M7 21.5l-4-4 4-4M3 17.5h12.5A5.5 5.5 0 0 0 21 12" />
  ),
  book: (
    <>
      <path d="M6.5 2H19v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8.5 2v20" />
    </>
  ),
  download: <path d="M12 3v11m-4.5-4.5L12 14l4.5-4.5M4.5 20.5h15" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  gear: (
    <>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V7" />
      <path d="M6.2 7l1 13.2a.9.9 0 0 0 .9.8h7.8a.9.9 0 0 0 .9-.8L17.8 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  'chevron-left': <path d="m14.5 6-6 6 6 6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  theme: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
}

interface IconProps {
  name: IconName
  className?: string
}

export function Icon({ name, className }: IconProps) {
  const solid = SOLID_ICONS.has(name)
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
