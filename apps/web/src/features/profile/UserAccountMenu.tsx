import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import { Skeleton } from '../../components/Skeleton'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { getAvatarDownload, getProfile, updateLocale, uploadAvatar } from './profile.api'

function userName(user: NonNullable<ReturnType<typeof useAuth>['session']>['user']) {
  return user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Nomo 用户'
}

export function UserAccountMenu() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'profile' | 'settings' | null>(null)
  const user = session?.user
  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  })
  const avatarQuery = useQuery({
    queryKey: ['profile-avatar', user?.id, profileQuery.data?.avatar_object_key],
    queryFn: getAvatarDownload,
    enabled: Boolean(profileQuery.data?.avatar_object_key),
  })
  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      await queryClient.invalidateQueries({ queryKey: ['profile-avatar', user?.id] })
    },
  })
  const localeMutation = useMutation({
    mutationFn: updateLocale,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['profile', user?.id] }) },
  })

  if (!user) return null
  const name = profileQuery.data?.display_name || userName(user)
  const avatar = avatarQuery.data || user.user_metadata?.avatar_url
  const accountPending = profileQuery.isPending
    || (Boolean(profileQuery.data?.avatar_object_key) && avatarQuery.isPending)

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="relative mt-auto">
      <button
        className="flex w-full items-center gap-3 border-t border-line pt-5 text-left"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="打开账户菜单"
        onClick={() => setOpen((value) => !value)}
      >
        {accountPending ? (
          <span className="flex min-w-0 flex-1 items-center gap-3" role="status" aria-label="正在加载账户资料">
            <span className="sr-only">正在加载账户资料</span>
            <Skeleton as="span" className="block size-10 shrink-0 rounded-full" />
            <span className="grid min-w-0 flex-1 gap-2">
              <Skeleton as="span" className="block h-4 w-2/3" />
              <Skeleton as="span" className="block h-3 w-5/6" />
            </span>
          </span>
        ) : (
          <>
            <Avatar src={avatar} name={name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-bold text-ink">{name}</span>
              <span className="block truncate text-meta text-muted">{user.email}</span>
            </span>
          </>
        )}
        {accountPending && user.email ? <span className="sr-only">{user.email}</span> : null}
        <AppIcon name="chevron-right" size={18} />
      </button>
      {open ? createPortal(
        <div className="fixed bottom-28 left-6 z-[60] grid w-72 max-w-[calc(100vw-3rem)] gap-1 rounded-card border border-line bg-surface p-2 shadow-float" role="menu">
          <button className="flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-body font-medium text-ink hover:bg-canvas" type="button" role="menuitem" onClick={() => { setDialog('profile'); setOpen(false) }}>
            <AppIcon name="user" size={18} />账户信息
          </button>
          <button className="flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-body font-medium text-ink hover:bg-canvas" type="button" role="menuitem" onClick={() => { setDialog('settings'); setOpen(false) }}>
            <AppIcon name="settings" size={18} />设置
          </button>
          <button className="flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-body font-medium text-danger hover:bg-danger/5" type="button" role="menuitem" onClick={() => void signOut()}>
            <AppIcon name="logout" size={18} />退出登录
          </button>
        </div>,
        document.body,
      ) : null}
      {dialog === 'profile' ? (
        <Dialog title="账户信息" onClose={() => setDialog(null)}>
          <div className="grid gap-4">
            <label className="group relative mx-auto block size-20 cursor-pointer overflow-hidden rounded-full" aria-label="更换头像">
              <Avatar src={avatar} name={name} size="lg" />
              <span className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/65 px-2 text-center text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">更换头像</span>
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) avatarMutation.mutate(file) }} />
            </label>
            {avatarMutation.isError ? <p role="alert">头像上传失败，请重试</p> : null}
            <ReadOnlyField label="昵称" value={name} />
            <ReadOnlyField label="邮箱" value={user.email ?? '未设置'} />
          </div>
        </Dialog>
      ) : null}
      {dialog === 'settings' ? (
        <Dialog title="设置" onClose={() => setDialog(null)}>
          <label className="grid gap-2 font-bold text-ink" htmlFor="locale-setting">语言
            <select className="min-h-12 rounded-control border border-line bg-canvas px-3 font-normal" id="locale-setting" value={profileQuery.data?.locale ?? 'zh-CN'} onChange={(event) => localeMutation.mutate(event.target.value as 'zh-CN' | 'en-US')}>
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          </label>
          {localeMutation.isSuccess ? <p role="status">设置已保存</p> : null}
          {localeMutation.isError ? <p role="alert">设置保存失败，请重试</p> : null}
        </Dialog>
      ) : null}
    </div>
  )
}

function Avatar({ src, name, size }: { src?: string | null; name: string; size: 'sm' | 'lg' }) {
  return src ? <img className={`${size === 'lg' ? 'size-20' : 'size-10'} rounded-full object-cover`} src={src} alt={`${name}头像`} /> : <span className={`grid ${size === 'lg' ? 'size-20 text-3xl' : 'size-10'} place-items-center rounded-full bg-brand font-black text-white`} aria-label={`${name}头像`}>{name.slice(0, 1).toUpperCase()}</span>
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <label className="grid gap-1 font-bold text-ink">{label}<input className="min-h-12 rounded-control border border-line bg-canvas px-3 text-muted" value={value} readOnly /></label>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="w-full max-w-md rounded-shell border border-line bg-surface p-6 shadow-float" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-section-title font-bold" id="user-dialog-title">{title}</h2>
          <button className="grid size-11 place-items-center rounded-control border border-line bg-canvas" type="button" aria-label="关闭" onClick={onClose}><AppIcon name="close" /></button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  )
}
