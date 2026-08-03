import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { MobileActionSheet } from '../../components/MobileActionSheet'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { env } from '../../lib/env'
import { formatStoragePath } from '../../lib/format-storage-path'
import { useAuth } from '../auth/auth-context'
import { ItemMovementSheet, type ItemMovementCommand } from '../item-movements/ItemMovementSheet'
import { deriveItemAvailability, formatItemAvailability } from '../item-movements/item-movement-status'
import { listItemMovements, moveItem, returnItem, takeOutItem } from '../item-movements/item-movements.api'
import { ItemForm } from '../items/ItemForm'
import { deleteItem, type ItemRecord } from '../items/items.api'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { buildLabels, renderLabelsPdf } from '../qr-print/pdf'
import { PackingChecklistSection } from '../packing/PackingChecklistSection'
import { PackingCaptureSheet } from '../packing/PackingCapturePage'
import { getBoxByPublicId, listBoxes } from './boxes.api'

export function PublicBoxPage() {
  const { publicId = '' } = useParams<{ publicId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const feedback = useMobileFeedback()
  const queryClient = useQueryClient()
  const desktopAddItemButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileActionsButtonRef = useRef<HTMLButtonElement | null>(null)
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null)
  const [showItemForm, setShowItemForm] = useState(false)
  const [showPackingCapture, setShowPackingCapture] = useState(false)
  const [showMobileActions, setShowMobileActions] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null)
  const [movementItem, setMovementItem] = useState<ItemRecord | null>(null)
  const [printError, setPrintError] = useState(false)
  const [printing, setPrinting] = useState(false)
  const boxQuery = useQuery({
    queryKey: ['box', publicId],
    queryFn: () => getBoxByPublicId(publicId),
    retry: false,
  })
  const targetBoxesQuery = useQuery({
    queryKey: ['boxes'],
    queryFn: listBoxes,
    enabled: Boolean(movementItem),
  })
  const movementHistoryQuery = useQuery({
    queryKey: ['item-movements', movementItem?.id],
    queryFn: () => listItemMovements(movementItem?.id ?? ''),
    enabled: Boolean(movementItem),
  })
  const movementMutation = useMutation({
    mutationFn: (command: ItemMovementCommand) => {
      if (!movementItem) throw new Error('item is required')
      if (command.action === 'take_out') {
        return takeOutItem({
          itemId: movementItem.id,
          quantity: command.quantity,
          handlerLabel: command.handlerLabel,
          note: command.note,
        })
      }
      if (command.action === 'return') {
        return returnItem({ itemId: movementItem.id, quantity: command.quantity, note: command.note })
      }
      return moveItem({ itemId: movementItem.id, targetBoxId: command.targetBoxId, note: command.note })
    },
    onSuccess: async (_, command) => {
      setMovementItem(null)
      feedback.notify(command.action === 'take_out' ? '物品已取出' : command.action === 'return' ? '物品已放回' : '物品已移动')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['box'] }),
        queryClient.invalidateQueries({ queryKey: ['boxes'] }),
        queryClient.invalidateQueries({ queryKey: ['items'] }),
        queryClient.invalidateQueries({ queryKey: ['search-items'] }),
        queryClient.invalidateQueries({ queryKey: ['item-movements'] }),
      ])
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: async () => {
      deleteReturnFocusRef.current = window.matchMedia('(min-width: 48rem)').matches
        ? desktopAddItemButtonRef.current
        : mobileActionsButtonRef.current
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
  const openMovementItem = (item: ItemRecord) => {
    movementMutation.reset()
    setMovementItem(item)
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
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">{box.name} · 箱子详情</span>
        <div className="flex justify-end gap-1" aria-label={isOwner ? '箱子工具' : undefined} aria-hidden={isOwner ? undefined : true}>
          {isOwner ? (
            <button ref={mobileActionsButtonRef} className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label="打开箱子操作菜单" onClick={() => setShowMobileActions(true)}>
              <AppIcon name="plus" size={24} />
            </button>
          ) : null}
        </div>
      </nav>
      {boxQuery.isError ? (
        <ResponsiveOperationError message="箱子刷新失败，正在显示上次内容" busy={boxQuery.isFetching} onRetry={() => void boxQuery.refetch()} />
      ) : null}
      <section data-testid="box-summary" className="hidden gap-4 border-0 bg-transparent p-0 lg:grid lg:grid-cols-[minmax(16rem,0.8fr)_1.2fr] lg:gap-6 lg:rounded-shell lg:border lg:border-line lg:bg-surface lg:p-5">
        <div data-testid="box-cover" className="hidden aspect-[4/3] min-h-0 overflow-hidden rounded-[1.5rem] bg-placeholder lg:block lg:min-h-56 lg:rounded-card">
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
              <button className="inline-flex min-h-11 items-center gap-2 rounded-control border border-brand bg-brand px-4 font-bold text-white" type="button" onClick={() => setShowPackingCapture(true)}>
                <AppIcon name="scan" />AI 装箱
              </button>
            </div>
          ) : null}
        </div>
      </section>
      {printError ? <ResponsiveOperationError message="PDF 生成失败，请重试" onRetry={() => void printLabel()} /> : null}
      {movementMutation.isError ? <ResponsiveOperationError message="物品操作失败，请稍后重试" /> : null}
      {targetBoxesQuery.isError ? <ResponsiveOperationError message="目标箱子加载失败，请重试" busy={targetBoxesQuery.isFetching} onRetry={() => void targetBoxesQuery.refetch()} /> : null}
      {movementHistoryQuery.isError ? <ResponsiveOperationError message="流转记录加载失败，请重试" busy={movementHistoryQuery.isFetching} onRetry={() => void movementHistoryQuery.refetch()} /> : null}

      <MobileActionSheet
        open={isOwner && showMobileActions}
        title="箱子操作"
        onClose={() => setShowMobileActions(false)}
        actions={[
          { label: 'AI 装箱', onSelect: () => setShowPackingCapture(true) },
          { label: '新增物品', onSelect: openNewItem },
          { label: '编辑箱子', onSelect: () => navigate(`/app/boxes/${box.id}/edit`) },
          { label: printing ? '正在生成标签…' : '打印标签', disabled: printing, onSelect: () => void printLabel() },
        ]}
      />

      <ItemMovementSheet
        open={isOwner && Boolean(movementItem)}
        item={movementItem}
        currentBoxId={box.id}
        boxes={targetBoxesQuery.data ?? []}
        movements={movementHistoryQuery.data ?? []}
        historyLoading={movementHistoryQuery.isPending}
        pending={movementMutation.isPending}
        onClose={() => { if (!movementMutation.isPending) { setMovementItem(null); movementMutation.reset() } }}
        onEdit={(item) => { setMovementItem(null); openEditItem(item) }}
        onSubmit={async (command) => { await movementMutation.mutateAsync(command) }}
      />

      {isOwner && (showItemForm || editingItem) ? (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/30 lg:static lg:block lg:bg-transparent" role="dialog" aria-modal="true" aria-labelledby="item-form-title">
          <div className="max-h-[calc(100dvh-var(--safe-area-top))] w-full overflow-y-auto rounded-t-[1.5rem] bg-canvas pb-[max(1rem,var(--safe-area-bottom))] shadow-float lg:max-h-none lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="mx-auto w-full max-w-6xl lg:px-0">
              <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-line lg:hidden" aria-hidden="true" />
              <ItemForm
                key={editingItem ? `edit-${editingItem.id}` : 'new'}
                boxId={box.id}
                item={editingItem}
                onSaved={() => void refreshItems()}
                onCancel={() => { setShowItemForm(false); setEditingItem(null) }}
                onDelete={editingItem ? () => {
                  deleteReturnFocusRef.current = mobileActionsButtonRef.current
                  setShowItemForm(false)
                  setEditingItem(null)
                  setDeleteTarget(editingItem)
                } : undefined}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isOwner && showPackingCapture ? (
        <PackingCaptureSheet
          boxId={box.id}
          onClose={() => setShowPackingCapture(false)}
          onCompleted={() => {
            setShowPackingCapture(false)
            feedback.notify('照片已提交，AI 正在整理清单')
          }}
        />
      ) : null}

      {isOwner ? <PackingChecklistSection boxId={box.id} /> : null}

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
              <article className="border-b border-line/60 last:border-b-0 lg:grid lg:grid-cols-[7rem_minmax(0,1fr)_auto] lg:items-center lg:gap-4 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-4" key={item.id}>
                {isOwner ? (
                  <div className="lg:hidden">
                    <button className="grid w-full min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left active:bg-placeholder/50" type="button" aria-label={`打开${item.name}操作`} onClick={() => openMovementItem(item)}>
                      <div className="grid size-14 place-content-center overflow-hidden rounded-[0.9rem] bg-placeholder text-muted">
                        {item.image_object_key ? <AuthorizedImage objectKey={item.image_object_key} alt="" className="h-full w-full object-cover" /> : <AppIcon name="box" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="m-0 truncate text-[1rem] font-bold text-ink">{item.name}</h3>
                        <p className="mt-0.5 truncate text-sm text-muted">{item.description || item.category || '未添加说明'}</p>
                        <p className="mt-1 flex min-w-0 items-center gap-2 text-xs font-bold"><span className="shrink-0 text-muted">{item.quantity} 件</span><span className="truncate text-brand">{formatItemAvailability(deriveItemAvailability(item.quantity, item.stored_quantity))}</span></p>
                      </div>
                      <AppIcon className="text-muted" name="chevron-right" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 p-3 lg:hidden">
                    <div className="grid size-14 place-content-center overflow-hidden rounded-[0.9rem] bg-placeholder text-muted">
                      {item.image_object_key ? <AuthorizedImage objectKey={item.image_object_key} alt={`${item.name}图片`} className="h-full w-full object-cover" /> : <AppIcon name="box" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="m-0 truncate text-[1rem] font-bold text-ink">{item.name}</h3>
                      <p className="mt-0.5 truncate text-sm text-muted">{item.description || item.category || '未添加说明'}</p>
                      <p className="mt-1 truncate text-xs font-bold text-brand">{formatItemAvailability(deriveItemAvailability(item.quantity, item.stored_quantity))}</p>
                    </div>
                    <span className="text-sm font-semibold text-muted">{item.quantity} 件</span>
                  </div>
                )}
                <div className="hidden lg:contents">
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
                  <p className="mt-1 text-sm font-extrabold text-ink lg:mt-2 lg:text-base">{item.quantity} 件 <span className="ml-2 text-sm text-brand">{formatItemAvailability(deriveItemAvailability(item.quantity, item.stored_quantity))}</span></p>
                </div>
                {isOwner ? (
                  <div className="col-start-2 flex justify-end gap-1.5 lg:col-auto lg:self-center">
                    <button className="inline-flex size-10 items-center justify-center rounded-full border-0 bg-brand/8 text-brand active:opacity-70 lg:size-11 lg:rounded-control lg:border lg:border-brand/20 lg:bg-canvas" type="button" aria-label={`管理${item.name}`} onClick={() => openMovementItem(item)}>
                      <AppIcon name="more" />
                    </button>
                    <button className="inline-flex size-10 items-center justify-center rounded-full border-0 bg-placeholder/60 text-ink active:opacity-70 lg:size-11 lg:rounded-control lg:border lg:border-line lg:bg-canvas" type="button" aria-label={`编辑${item.name}`} onClick={() => openEditItem(item)}>
                      <AppIcon name="edit" />
                    </button>
                    <button className="inline-flex size-10 items-center justify-center rounded-full border-0 bg-danger/5 text-danger active:opacity-70 lg:size-11 lg:rounded-control lg:border lg:border-danger/30 lg:bg-canvas" type="button" aria-label={`删除${item.name}`} onClick={(event) => requestDelete(item, event.currentTarget)}>
                      <AppIcon name="trash" />
                    </button>
                  </div>
                ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {box.items.length === 0 ? (
          <PageState
            state="empty"
            icon="box"
            title="箱子里还没有物品"
            description={isOwner ? '拍下箱内物品让 AI 帮你整理，或从第一件物品开始手动记录。' : undefined}
            action={isOwner ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="border-brand! bg-brand! text-white!" type="button" onClick={() => setShowPackingCapture(true)}>拍照识别物品</button>
                <button type="button" onClick={openNewItem}>手动记录</button>
              </div>
            ) : undefined}
          />
        ) : null}
      </section>

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
