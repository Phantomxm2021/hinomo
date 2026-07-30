import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { deleteBox, listBoxes, type BoxSummary } from './boxes.api'

const secondaryAction = 'inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-3.5 py-2 font-bold text-ink no-underline transition hover:border-brand/40 hover:text-brand'

export function BoxesPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<BoxSummary | null>(null)
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const deleteMutation = useMutation({
    mutationFn: (boxId: string) => deleteBox(boxId),
    onSuccess: async () => {
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['boxes'] })
    },
  })
  const boxes = boxesQuery.data ?? []
  const selectedSpace = searchParams.get('space') ?? ''
  const spaces = [...new Map(boxes.map((box) => [box.space_id, box.space_name])).entries()]
  const visibleBoxes = selectedSpace
    ? boxes.filter((box) => box.space_id === selectedSpace)
    : boxes

  const selectSpace = (spaceId: string) => {
    const next = new URLSearchParams(searchParams)
    if (spaceId) next.set('space', spaceId)
    else next.delete('space')
    setSearchParams(next, { replace: true })
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-7" aria-labelledby="boxes-title">
      <header className="flex flex-col gap-5 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">快速找到每一件物品</p>
          <h1 className="mb-0" id="boxes-title">箱子</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={secondaryAction} to="/app/print">
            <AppIcon name="print" className="mr-2" />
            批量打印
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-control border border-brand bg-brand px-4 py-2 font-bold text-white no-underline transition hover:bg-brand-strong" to="/app/boxes/new">
            <AppIcon name="plus" className="mr-2" />
            创建箱子
          </Link>
        </div>
      </header>

      {boxesQuery.isPending ? <PageState state="loading" label="正在加载箱子…" /> : null}
      {boxesQuery.isError ? <PageState state="error" message="箱子加载失败，请重试" onRetry={() => void boxesQuery.refetch()} /> : null}
      {deleteMutation.isError ? <p role="alert">删除失败，请稍后重试</p> : null}

      {boxes.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="按空间筛选">
          <button
            className={`min-h-11 shrink-0 rounded-full border px-4 py-2 font-bold transition ${selectedSpace === '' ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted hover:border-brand/40 hover:text-ink'}`}
            type="button"
            aria-pressed={selectedSpace === ''}
            onClick={() => selectSpace('')}
          >
            全部空间
          </button>
          {spaces.map(([spaceId, spaceName]) => {
            const selected = selectedSpace === spaceId
            return (
              <button
                className={`min-h-11 shrink-0 rounded-full border px-4 py-2 font-bold transition ${selected ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted hover:border-brand/40 hover:text-ink'}`}
                type="button"
                aria-pressed={selected}
                onClick={() => selectSpace(spaceId)}
                key={spaceId}
              >
                {spaceName}
              </button>
            )
          })}
        </div>
      ) : null}

      {boxesQuery.isSuccess && visibleBoxes.length === 0 ? (
        <PageState state="empty" title="还没有箱子" action={<Link className="inline-flex min-h-11 items-center rounded-control bg-brand px-4 py-2 font-bold text-white no-underline" to="/app/boxes/new">创建箱子</Link>} />
      ) : null}

      <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {visibleBoxes.map((box) => (
          <article
            className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface"
            aria-labelledby={`box-${box.id}-name`}
            key={box.id}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-placeholder">
              {box.cover_object_key ? (
                <AuthorizedImage
                  objectKey={box.cover_object_key}
                  alt={`${box.name}封面`}
                  className="block h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-content-center justify-items-center gap-3 bg-placeholder text-brand" role="img" aria-label="箱子封面占位图">
                  <span className="grid size-20 place-items-center rounded-card border border-brand/25 bg-surface/65">
                    <AppIcon name="box" size={40} />
                  </span>
                  <span className="text-sm font-bold text-muted">箱子封面占位图</span>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5">
              <div className="min-w-0">
                <p className="font-mono text-xs font-extrabold text-brand">{box.box_code}</p>
                <h2 className="mt-1 mb-2 truncate text-xl" id={`box-${box.id}-name`}>{box.name}</h2>
                <p className="truncate text-sm">{box.space_name} · {box.location || '未填写位置'}</p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                <span className="font-bold text-ink">{box.item_count} 件物品</span>
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <AppIcon name={box.visibility === 'public' ? 'globe' : 'lock'} size={16} />
                  {box.visibility === 'public' ? '公开' : '私有'}
                </span>
              </div>

              <div className="mt-auto grid grid-cols-3 gap-2">
                <Link className={secondaryAction} to={`/b/${box.public_id}`}>查看</Link>
                <Link className={secondaryAction} to={`/app/boxes/${box.id}/edit`}>编辑</Link>
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-control border border-danger/25 bg-surface px-3 py-2 font-bold text-danger transition hover:bg-danger/5"
                  type="button"
                  aria-label={`删除${box.name}`}
                  onClick={() => setDeleteTarget(box)}
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`删除“${deleteTarget?.name ?? ''}”？`}
        description="箱子内的物品也会被删除，此操作无法恢复。"
        busy={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </section>
  )
}
