import type { ReactNode } from 'react'

const shapes = {
  analysis: <><path d="M4 20h16M5 4v16m3-5 4-5 4 2 4-7"/><path d="M16 5h4v4"/></>,
  design: <><path d="M5 4h14v4h-5v8h5v4H5v-4h5V8H5z"/><path d="M3 12h4m10 0h4"/></>,
  load: <path d="M12 3v13m-4-4 4 4 4-4M4 20h16" />,
  support: <path d="M12 4l7 12H5L12 4ZM3 19h18m-13 0-2 2m7-2-2 2m7-2-2 2" />,
  brand: <><path d="M3 18 12 4l9 14ZM7.4 11h9.2M12 4v14"/><circle cx="12" cy="4" r="1.5"/><circle cx="3" cy="18" r="1.5"/><circle cx="21" cy="18" r="1.5"/></>,
  select: <path d="m5 3 14 9-7 1-3 7L5 3Z"/>,
  node: <><circle cx="12" cy="12" r="5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></>,
  bar: <><path d="m6 18 12-12"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></>,
  move: <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>,
  pan: <path d="M8 13V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v5c0 5-2.5 8-7 8h-1c-2 0-3.6-1-5-3l-3.2-4.5A1.6 1.6 0 0 1 6 12l2 2"/>,
  fit: <><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  grid: <path d="M4 4h16v16H4zM4 9h16M4 15h16M9 4v16m6-16v16"/>,
  axes: <><path d="M5 4v15h15M5 4l-2 2m2-2 2 2m13 13-2-2m2 2-2 2"/></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/></>,
  book: <path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>,
  target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></>,
  snap: <path d="M6 4 3 7l7 7a4 4 0 0 0 6-6l-4-4-3 3 4 4m-3 3-4-4m4-4 3 3m5 6 3-1m-6 4-1 3m4-3 2 2"/>,
  sliders: <path d="M4 7h7m4 0h5M4 17h3m4 0h9M11 4v6m4-6v6M7 14v6m4-6v6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  undo: <path d="M9 6 4 11l5 5m-5-5h10a5 5 0 0 1 0 10"/>,
  redo: <path d="m15 6 5 5-5 5m5-5H10a5 5 0 0 0 0 10"/>,
  warning: <path d="M12 3 2 21h20L12 3Zm0 6v5m0 3v.2"/>,
  cursor: <path d="M12 3v6m0 6v6M3 12h6m6 0h6"/>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h1m4 0h1m4 0h1M6 13h1m4 0h1m4 0h1m-8 3h6"/></>,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof shapes

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    {shapes[name]}
  </svg>
}
