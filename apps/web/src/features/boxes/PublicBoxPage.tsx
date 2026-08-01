import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { env } from '../../lib/env'
import { formatStoragePath } from '../../lib/format-storage-path'
import { useAuth } from '../auth/auth-context'
import { ItemForm } from '../items/ItemForm'
import { deleteItem, type ItemRecord } from '../items/items.api'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { buildLabels, renderLabelsPdf } from '../qr-print/pdf'
import { getBoxByPublicId } from './boxes.api'

export function PublicBoxPage() {
  const { publicId = '' } = useParams<{ publicId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const desktopAddItemButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileAddItemButtonRef = useRef<HTMLButtonElement | null>(null)
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null)
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
      deleteReturnFocusRef.current = window.matchMedia('(min-width: 48rem)').matches
        ? desktopAddItemButtonRef.current
        : mobileAddItemButtonRef.current
      setDeleteTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['box', publicId] }),
        queryClient.invalidateQueries({ queryKey: ['items', boxQuery.data?.id] }),
      ])
    },
  })
  const frameClassName = 'mx-auto grid min-w-0 w-full max-w-6xl gap-6 px-4 pb-[calc(6rem+var(--safe-area-bottom))] pt-3 min-[360px]:px-5 lg:gap-6 lg:px-8 lg:pb-10 lg:pt-5'

  if (boxQuery.isPending && boxQuery.data === undefined) {
    return (
      <main className={frameClassName}>
        <SkeletonGroup className="grid gap-5 lg:gap-6" label="正在加载箱子">
          <div data-testid="box-summary-skeleton" className="grid gap-4 border-0 bg-transparent p-0 lg:grid-cols-[minmax(16rem,0.8fr)_1.2fr] lg:gap-6 lg:rounded-shell lg:border lg:border-line lg:bg-surface lg:p-5">
            <Skeleton className="aspect-[4/3] min-h-0 rounded-[1.5rem] lg:min-h-56 lg:rounded-control" />
            <div className="grid content-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-full" />
            </div>
          </div>
          <div className="grid gap-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SkeletonGroup>
      </main>
    )
  }
  if ((boxQuery.isError && boxQuery.data === undefined) || !boxQuery.data) {
    return <main className={frameClassName}><PageState state="error" message="无权限或内容不存在" onRetry={() => void boxQuery.refetch()} /></main>
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
  const requestDelete = (item: ItemRecord, trigger: HTMLButtonElement) => {
    deleteReturnFocusRef.current = trigger
    setDeleteTarget(item)
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
    <main className={frameClassName}>
      <nav className="sticky top-0 z-20 -mx-4 -mt-3 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label="箱子详情导航">
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label="返回" onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">箱子详情</span>
        <div className="flex justify-end gap-1" aria-label={isOwner ? '箱子工具' : undefined} aria-hidden={isOwner ? undefined : true}>
          {isOwner ? (
            <>
              <Link className="inline-flex size-11 items-center justify-center rounded-full text-ink no-underline active:bg-placeholder/70 active:opacity-70" to={`/app/boxes/${box.id}/edit`} aria-label="编辑箱子">
                <AppIcon name="edit" />
              </Link>
              <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70 disabled:opacity-40" type="button" aria-label="打印标签" disabled={printing} onClick={() => void printLabel()}>
                <AppIcon name="print" />
              </button>
            </>
          ) : null}
        </div>
      </nav>
      {boxQuery.isError ? (
        <ResponsiveOperationError message="箱子刷新失败，正在显示上次内容" busy={boxQuery.isFetching} onRetry={() => void boxQuery.refetch()} />
      ) : null}
      <section data-testid="box-summary" className="grid gap-4 border-0 bg-transparent p-0 lg:grid-cols-[minmax(16rem,0.8fr)_1.2fr] lg:gap-6 lg:rounded-shell lg:border lg:border-line lg:bg-surface lg:p-5">
        <div className="aspect-[4/3] min-h-0 overflow-hidden rounded-[1.5rem] bg-placeholder lg:min-h-56 lg:rounded-card">
          {box.cover_object_key ? (
            <AuthorizedImage objectKey={box.cover_object_key} alt={`${box.name}封面`} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-content-center justify-items-center gap-2 text-muted">
              <AppIcon name="box" size={40} />
              <span className="font-bold">暂无封面</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-5 lg:gap-6">
          <div className="grid gap-2.5 lg:gap-3">
            <p className="font-mono text-xs font-extrabold tracking-[0.08em] text-brand lg:text-sm lg:tracking-wide">{box.box_code}</p>
            <h1 className="m-0 text-[1.75rem] leading-tight text-ink lg:text-page-title font-extrabold">{box.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold lg:gap-2 lg:font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-placeholder/70 px-2.5 py-1 text-ink lg:px-3 lg:py-1.5">
                <AppIcon name={box.visibility === 'public' ? 'globe' : 'lock'} size={16} />
                {box.visibility === 'public' ? '公开箱子' : '私密箱子'}
              </span>
              <span className="rounded-full border-0 bg-transparent px-0 py-1 text-muted lg:border lg:border-line lg:px-3 lg:py-1.5">最近更新 {updatedAt}</span>
            </div>
            <div data-testid="box-detail-facts" className="hidden lg:contents">
              <p className="text-sm leading-6 text-muted lg:text-base">{formatStoragePath([box.venue_name, box.space_name, box.location || '未填写位置'])}</p>
              <p className="text-sm leading-6 text-muted lg:text-base lg:leading-7">{box.description || '暂无备注'}</p>
              <p className="font-extrabold text-ink">共 {totalQuantity} 件 · {box.items.length} 种物品</p>
            </div>
          </div>
          {isOwner ? (
            <div data-testid="desktop-box-actions" className="hidden lg:flex lg:flex-wrap lg:gap-2">
              <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] border-0 bg-surface px-4 font-bold text-ink no-underline shadow-[inset_0_0_0_1px_rgba(79,64,48,0.08)] active:opacity-70 lg:min-h-11 lg:justify-start lg:rounded-control lg:border lg:border-line lg:bg-canvas lg:shadow-none" to={`/app/boxes/${box.id}/edit`}>
                <AppIcon name="edit" />编辑箱子
              </Link>
              <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] border-0 bg-surface px-4 font-bold text-ink shadow-[inset_0_0_0_1px_rgba(79,64,48,0.08)] active:opacity-70 lg:min-h-11 lg:justify-start lg:rounded-control lg:border lg:border-line lg:bg-canvas lg:shadow-none" type="button" disabled={printing} onClick={() => void printLabel()}>
                <AppIcon name="print" />{printing ? '生成中…' : '打印标签'}
              </button>
              <button ref={desktopAddItemButtonRef} className="hidden min-h-11 items-center gap-2 rounded-control border border-brand bg-brand px-4 font-bold text-white lg:inline-flex" type="button" onClick={openNewItem}>
                <AppIcon name="plus" />新增物品
              </button>
            </div>
          ) : null}
        </div>
      </section>
      {printError ? <ResponsiveOperationError message="PDF 生成失败，请重试" onRetry={() => void printLabel()} /> : null}

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
            <h2 className="m-0 text-section-title font-bold text-ink" id="box-items-heading">物品</h2>
          </div>
          <span className="text-sm font-bold text-muted">{box.items.length} 种</span>
        </div>
        {box.items.length > 0 ? (
          <div data-testid="box-item-list" className="overflow-hidden rounded-[1.25rem] bg-surface shadow-[inset_0_0_0_1px_rgba(79,64,48,0.06)] lg:contents lg:rounded-none lg:bg-transparent lg:shadow-none">
            {box.items.map((item) => (
              <article className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-line/60 p-3 last:border-b-0 lg:grid-cols-[7rem_minmax(0,1fr)_auto] lg:items-center lg:gap-4 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-4" key={item.id}>
                <div className="aspect-[4/3] overflow-hidden rounded-[0.85rem] bg-placeholder lg:rounded-control">
                  {item.image_object_key ? (
                    <AuthorizedImage objectKey={item.image_object_key} alt={`${item.name}图片`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-content-center justify-items-center gap-1 text-muted">
                      <AppIcon name="box" />
                      <span className="hidden text-xs font-bold min-[380px]:inline lg:inline">暂无图片</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 self-center">
                  <div className="mb-1 flex min-w-0 items-center gap-2 lg:mb-2 lg:flex-wrap">
                    <h3 className="m-0 min-w-0 flex-1 truncate text-base font-extrabold text-ink lg:flex-none lg:text-lg">{item.name}</h3>
                    <span className="shrink-0 rounded-full bg-placeholder/70 px-2 py-0.5 text-[0.6875rem] font-bold text-ink lg:px-2.5 lg:py-1 lg:text-xs">{item.category || '未分类'}</span>
                  </div>
                  <p className="truncate text-sm leading-5 text-muted lg:leading-6">{item.description || '暂无描述'}</p>
                  <p className="mt-1 text-sm font-extrabold text-ink lg:mt-2 lg:text-base">{item.quantity} 件</p>
                </div>
                {isOwner ? (
                  <div className="col-start-2 flex justify-end gap-1.5 lg:col-auto lg:self-center">
                    <button className="inline-flex size-10 items-center justify-center rounded-full border-0 bg-placeholder/60 text-ink active:opacity-70 lg:size-11 lg:rounded-control lg:border lg:border-line lg:bg-canvas" type="button" aria-label={`编辑${item.name}`} onClick={() => openEditItem(item)}>
                      <AppIcon name="edit" />
                    </button>
                    <button className="inline-flex size-10 items-center justify-center rounded-full border-0 bg-danger/5 text-danger active:opacity-70 lg:size-11 lg:rounded-control lg:border lg:border-danger/30 lg:bg-canvas" type="button" aria-label={`删除${item.name}`} onClick={(event) => requestDelete(item, event.currentTarget)}>
                      <AppIcon name="trash" />
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
        {box.items.length === 0 ? (
          <p className="grid min-h-32 place-content-center justify-items-center gap-2 rounded-[1.25rem] border-0 bg-surface/60 p-8 text-center text-muted lg:rounded-card lg:border lg:border-dashed lg:border-line lg:bg-surface">
            <AppIcon name="box" size={28} />
            箱子里还没有物品
          </p>
        ) : null}
      </section>

      {isOwner && !showItemForm && !editingItem ? (
        <button
          ref={mobileAddItemButtonRef}
          className="fixed inset-x-4 bottom-[max(1rem,var(--safe-area-bottom))] z-20 inline-flex min-h-12 items-center justify-center gap-2 rounded-[1rem] border border-brand bg-brand px-5 font-extrabold text-white shadow-float active:opacity-80 min-[360px]:inset-x-5 lg:hidden"
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
        returnFocusRef={deleteReturnFocusRef}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
      />
    </main>
  )
}
