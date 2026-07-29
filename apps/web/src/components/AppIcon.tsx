import type { ReactNode, SVGProps } from 'react'

export type AppIconName =
  | 'home'
  | 'space'
  | 'scan'
  | 'box'
  | 'search'
  | 'print'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'lock'
  | 'globe'
  | 'chevron-right'
  | 'minus'
  | 'close'

const iconPaths: Record<AppIconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
    </>
  ),
  space: (
    <>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="15" width="7" height="5" rx="1.5" />
      <rect x="14" y="15" width="7" height="5" rx="1.5" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M7 12h10" />
    </>
  ),
  box: (
    <>
      <path d="m4 7 8-4 8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7M12 11v10" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M13.5 6.5 17.5 10.5M4 20l3.5-.8L19.4 7.3a2.1 2.1 0 0 0-3-3L4.8 16.2 4 20Z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 3h6l1 4M6.5 7l1 14h9l1-14M10 11v6M14 11v6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.3 2.5 3.5 5.5 3.5 9s-1.2 6.5-3.5 9c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z" />
    </>
  ),
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  minus: <path d="M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
}

type AppIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  name: AppIconName
  size?: number
}

export function AppIcon({ name, size = 20, className, ...props }: AppIconProps) {
  return (
    <svg
      {...props}
      className={className ? `app-icon ${className}` : 'app-icon'}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  )
}
