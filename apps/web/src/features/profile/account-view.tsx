export function AccountAvatar({ src, name, size, avatarLabel }: {
  src?: string | null
  name: string
  size: 'sm' | 'lg'
  avatarLabel?: string
}) {
  const resolvedAvatarLabel = avatarLabel ?? `${name}头像`
  return src
    ? <img className={`${size === 'lg' ? 'size-20' : 'size-10'} rounded-full object-cover`} src={src} alt={resolvedAvatarLabel} />
    : <span className={`grid ${size === 'lg' ? 'size-20 text-3xl' : 'size-10'} place-items-center rounded-full bg-brand font-black text-white`} aria-label={resolvedAvatarLabel}>{name.slice(0, 1).toUpperCase()}</span>
}

export function AvatarUploadControl({ src, name, pending, onChange, className = '', avatarLabel, pendingLabel, changeLabel }: {
  src?: string | null
  name: string
  pending: boolean
  onChange: (file: File) => void
  className?: string
  avatarLabel?: string
  pendingLabel?: string
  changeLabel?: string
}) {
  const uploadLabel = changeLabel ?? '更换头像'
  const pendingLabelText = pendingLabel ?? '上传中…'
  return (
    <label className={`group relative block size-20 cursor-pointer overflow-hidden rounded-full ${className || 'mx-auto'}`} aria-label={uploadLabel}>
      <AccountAvatar src={src} name={name} size="lg" avatarLabel={avatarLabel} />
      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/65 px-2 text-center text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {pending ? pendingLabelText : uploadLabel}
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
