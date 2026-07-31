import type { HTMLAttributes, ReactNode } from 'react'

type SkeletonProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'span'
}

export function Skeleton({ as, className = '', ...props }: SkeletonProps) {
  const Component = as ?? 'div'
  return (
    <Component
      {...props}
      aria-hidden="true"
      className={`rounded-control bg-placeholder/80 motion-safe:animate-pulse ${className}`.trim()}
      data-testid="skeleton"
    />
  )
}

type SkeletonGroupProps = {
  label: string
  className?: string
  children: ReactNode
}

export function SkeletonGroup({ label, className, children }: SkeletonGroupProps) {
  return (
    <div aria-label={label} role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={className}>{children}</div>
    </div>
  )
}
