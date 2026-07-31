import type { HTMLAttributes, ReactNode } from 'react'

type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
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
    <div aria-label={label} className={className} role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}
