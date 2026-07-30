import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { env } from '../../lib/env'
import { useAuth } from '../auth/auth-context'
import { ItemForm } from '../items/ItemForm'
import { deleteItem, type ItemRecord } from '../items/items.api'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { buildLabels, renderLabelsPdf } from '../qr-print/pdf'
import { getBoxByPublicId } from './boxes.api'

export function PublicBoxPage() {
  const { publicId = '' } = useParams<{ publicId: string }>()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null)
  const [printError, setPrintError] = useState(false)
  const [printing, setPrinting] = useState(false)
  const boxQuery = useQuery({
    queryKey: ['box', publicId],
    queryFn: () => getBoxByPublicId(publicId),
    retry: false,
  })
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: async () => {
      setDeleteTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['box', publicId] }),
        queryClient.invalidateQueries({ queryKey: ['items', boxQuery.data?.id] }),
      ])
    },
  })

  if (boxQuery.isPending) return <p role="status">正在加载箱子…</p>
  if (boxQuery.isError || !boxQuery.data) {
    return <main><h1>无权限或内容不存在</h1><p>请检查二维码或联系箱子所有者。</p></main>
  }

  const box = boxQuery.data
  const isOwner = session?.user.id === box.owner_id
  const totalQuantity = box.items.reduce((sum, item) => sum + item.quantity, 0)
  const updatedAt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(box.updated_at))
  const openNewItem = () => {
    setEditingItem(null)
    setShowItemForm(true)
  }
  const openEditItem = (item: ItemRecord) => {
    setEditingItem(item)
    setShowItemForm(true)
  }
  const refreshItems = async () => {
    setShowItemForm(false)
    setEditingItem(null)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['box', publicId] }),
      queryClient.invalidateQueries({ queryKey: ['items', box.id] }),
    ])
  }
  const printLabel = async () => {
    setPrinting(true)
    setPrintError(false)
    try {
      await renderLabelsPdf(buildLabels([box], env.VITE_PUBLIC_APP_ORIGIN))
    } catch {
      setPrintError(true)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-10">
      <section className="grid gap-6 rounded-shell border border-line bg-surface p-5 md:grid-cols-[minmax(16rem,0.8fr)_1.2fr]">
        <div className="aspect-[4/3] min-h-56 overflow-hidden rounded-card bg-placeholder">
          {box.cover_object_key ? (
            <AuthorizedImage objectKey={box.cover_object_key} alt={`${box.name}封面`} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-content-center justify-items-center gap-2 text-muted">
              <AppIcon name="box" size={40} />
              <span className="font-bold">暂无封面</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-6">
          <div className="grid gap-3">
            <p className="font-mono text-sm font-extrabold tracking-wide text-brand">{box.box_code}</p>
            <h1 className="m-0 text-3xl font-black tracking-tight text-ink sm:text-4xl">{box.name}</h1>
            <div className="flex flex-wrap gap-2 text-sm font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-placeholder/70 px-3 py-1.5 text-ink">
                <AppIcon name={box.visibility === 'public' ? 'globe' : 'lock'} size={16} />
                {box.visibility === 'public' ? '公开箱子' : '私密箱子'}
              </span>
              <span className="rounded-full border border-line px-3 py-1.5 text-muted">最近更新 {updatedAt}</span>
            </div>
            <p className="text-base text-muted">{box.space_name} · {box.location || '未填写位置'}</p>
            <p className="leading-7 text-muted">{box.description || '暂无备注'}</p>
            <p className="font-extrabold text-ink">共 {totalQuantity} 件 · {box.items.length} 种物品</p>
          </div>
          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-canvas px-4 font-bold text-ink no-underline" to={`/app/boxes/${box.id}/edit`}>
                <AppIcon name="edit" />编辑箱子
              </Link>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-canvas px-4 font-bold text-ink" type="button" disabled={printing} onClick={() => void printLabel()}>
                <AppIcon name="print" />{printing ? '生成中…' : '打印标签'}
              </button>
              <button className="hidden min-h-11 items-center gap-2 rounded-control border border-brand bg-brand px-4 font-bold text-white md:inline-flex" type="button" onClick={openNewItem}>
                <AppIcon name="plus" />新增物品
              </button>
            </div>
          ) : null}
        </div>
      </section>
      {printError ? <p role="alert">PDF 生成失败，请重试</p> : null}

      {isOwner && (showItemForm || editingItem) ? (
        <ItemForm
          key={editingItem ? `edit-${editingItem.id}` : 'new'}
          boxId={box.id}
          item={editingItem}
          onSaved={() => void refreshItems()}
          onCancel={() => { setShowItemForm(false); setEditingItem(null) }}
        />
      ) : null}

      <section className="grid gap-3" aria-labelledby="box-items-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-extrabold text-brand">箱内清单</p>
            <h2 className="m-0 text-2xl font-black text-ink" id="box-items-heading">物品</h2>
          </div>
          <span className="text-sm font-bold text-muted">{box.items.length} 种</span>
        </div>
        {box.items.map((item) => (
          <article className="grid gap-4 rounded-card border border-line bg-surface p-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:p-4" key={item.id}>
            <div className="aspect-[4/3] overflow-hidden rounded-control bg-placeholder">
              {item.image_object_key ? (
                <AuthorizedImage objectKey={item.image_object_key} alt={`${item.name}图片`} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-content-center justify-items-center gap-1 text-muted">
                  <AppIcon name="box" />
                  <span className="text-xs font-bold">暂无图片</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="m-0 truncate text-lg font-extrabold text-ink">{item.name}</h3>
                <span className="rounded-full bg-placeholder/70 px-2.5 py-1 text-xs font-bold text-ink">{item.category || '未分类'}</span>
              </div>
              <p className="text-sm leading-6 text-muted">{item.description || '暂无描述'}</p>
              <p className="mt-2 font-extrabold text-ink">{item.quantity} 件</p>
            </div>
            {isOwner ? (
              <div className="flex gap-2 sm:self-center">
                <button className="inline-flex size-11 items-center justify-center rounded-control border border-line bg-canvas text-ink" type="button" aria-label={`编辑${item.name}`} onClick={() => openEditItem(item)}>
                  <AppIcon name="edit" />
                </button>
                <button className="inline-flex size-11 items-center justify-center rounded-control border border-danger/30 bg-canvas text-danger" type="button" aria-label={`删除${item.name}`} onClick={() => setDeleteTarget(item)}>
                  <AppIcon name="trash" />
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {box.items.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-muted">箱子里还没有物品</p>
        ) : null}
      </section>

      {isOwner ? (
        <button
          className="fixed inset-x-5 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-20 inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-brand bg-brand px-5 font-extrabold text-white shadow-float md:hidden"
          type="button"
          aria-label="移动端新增物品"
          onClick={openNewItem}
        >
          <AppIcon name="plus" />新增物品
        </button>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`删除“${deleteTarget?.name ?? ''}”？`}
        description="删除后无法恢复。"
        busy={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
      />
    </main>
  )
}
