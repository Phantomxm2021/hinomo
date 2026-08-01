import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { Skeleton } from '../../components/Skeleton'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { userDisplayName } from './account-name'
import { AccountAvatar, AvatarUploadControl, ReadOnlyAccountField } from './account-view'
import { getAvatarDownload, getProfile, uploadAvatar } from './profile.api'

export function UserAccountMenu() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'profile' | null>(null)
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

  if (!user) return null
  const name = profileQuery.data?.display_name || userDisplayName(user)
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
            <AccountAvatar src={avatar} name={name} size="sm" />
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
          <Link className="flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-body font-medium text-ink no-underline hover:bg-canvas" to="/app/me/settings" role="menuitem" onClick={() => setOpen(false)}>
            <AppIcon name="settings" size={18} />设置
          </Link>
          <button className="flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-body font-medium text-danger hover:bg-danger/5" type="button" role="menuitem" onClick={() => void signOut()}>
            <AppIcon name="logout" size={18} />退出登录
          </button>
        </div>,
        document.body,
      ) : null}
      {dialog === 'profile' ? (
        <Dialog title="账户信息" onClose={() => setDialog(null)}>
          <div className="grid gap-4">
            <AvatarUploadControl src={avatar} name={name} pending={avatarMutation.isPending} onChange={(file) => avatarMutation.mutate(file)} />
            {avatarMutation.isError ? <p role="alert">头像上传失败，请重试</p> : null}
            <ReadOnlyAccountField label="昵称" value={name} />
            <ReadOnlyAccountField label="邮箱" value={user.email ?? '未设置'} />
          </div>
        </Dialog>
      ) : null}
    </div>
  )
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
