export function AccountAvatar({ src, name, size }: {
  src?: string | null
  name: string
  size: 'sm' | 'lg'
}) {
  return src
    ? <img className={`${size === 'lg' ? 'size-20' : 'size-10'} rounded-full object-cover`} src={src} alt={`${name}头像`} />
    : <span className={`grid ${size === 'lg' ? 'size-20 text-3xl' : 'size-10'} place-items-center rounded-full bg-brand font-black text-white`} aria-label={`${name}头像`}>{name.slice(0, 1).toUpperCase()}</span>
}

export function AvatarUploadControl({ src, name, pending, onChange, className = '' }: {
  src?: string | null
  name: string
  pending: boolean
  onChange: (file: File) => void
  className?: string
}) {
  return (
    <label className={`group relative block size-20 cursor-pointer overflow-hidden rounded-full ${className || 'mx-auto'}`} aria-label="更换头像">
      <AccountAvatar src={src} name={name} size="lg" />
      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/65 px-2 text-center text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {pending ? '上传中…' : '更换头像'}
      </span>
      <input
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onChange(file)
          event.currentTarget.value = ''
        }}
      />
    </label>
  )
}

export function ReadOnlyAccountField({ label, value, listRow = false }: { label: string; value: string; listRow?: boolean }) {
  if (listRow) {
    return (
      <label className="flex min-h-12 items-center justify-between gap-4 border-t border-line px-4 text-ink lg:grid lg:gap-1 lg:border-0 lg:px-0 lg:font-bold">
        <span>{label}</span>
        <input className="min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-muted outline-none lg:min-h-12 lg:w-full lg:flex-none lg:rounded-control lg:border lg:border-line lg:bg-canvas lg:px-3 lg:text-left" value={value} readOnly />
      </label>
    )
  }
  return <label className="grid gap-1 font-bold text-ink">{label}<input className="min-h-12 rounded-control border border-line bg-canvas px-3 text-muted" value={value} readOnly /></label>
}
