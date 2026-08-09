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
  | 'user'
  | 'settings'
  | 'logout'
  | 'more'
  | 'family'
  | 'history'
  | 'share'
  | 'copy'

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
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21c.7-4 2.9-6 7-6s6.3 2 7 6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  logout: <path d="M14 4H5v16h9M11 12h10M17 8l4 4-4 4" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  family: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3.5 20c.7-4 2.6-6 5.5-6 3 0 4.9 2 5.6 6M14.5 20c.4-2.3 1.6-3.8 3.8-4.3" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" />
      <path d="M4 4v4.5h4.5M12 7v5l3.5 2" />
    </>
  ),
  share: <path d="M8.5 12 15.5 5M10 5h5.5v5.5M16 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h5.5" />,
  copy: (
    <>
      <rect x="8" y="8" width="11" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
    </>
  ),
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
