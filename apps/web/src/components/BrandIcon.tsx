type BrandIconProps = {
  className?: string
}

export function BrandIcon({ className = '' }: BrandIconProps) {
  return (
    <img
      aria-hidden="true"
      className={`shrink-0 object-cover ${className}`}
      draggable={false}
      src="/brand/nomo-apple-icon-v2-192.png"
      alt=""
    />
  )
}
