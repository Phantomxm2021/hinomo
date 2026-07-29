import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { deleteBox, listBoxes, type BoxSummary } from './boxes.api'

export function BoxesPage() {
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<BoxSummary | null>(null)
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const deleteMutation = useMutation({
    mutationFn: (boxId: string) => deleteBox(boxId),
    onSuccess: async () => {
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['boxes'] })
    },
  })

  return (
    <section className="page-stack" aria-labelledby="boxes-title">
      <header className="page-heading heading-actions">
        <div>
          <p className="eyebrow">快速找到每一件物品</p>
          <h1 id="boxes-title">箱子</h1>
        </div>
        <div className="card-actions">
          <Link to="/app/print">批量打印</Link>
          <Link className="primary-link" to="/app/boxes/new">创建箱子</Link>
        </div>
      </header>

      {boxesQuery.isPending ? <p role="status">正在加载箱子…</p> : null}
      {boxesQuery.isError ? <p role="alert">箱子加载失败，请重试</p> : null}
      {deleteMutation.isError ? <p role="alert">删除失败，请稍后重试</p> : null}
      {boxesQuery.data?.length === 0 ? <p className="empty-state">还没有箱子</p> : null}

      <div className="card-grid">
        {boxesQuery.data?.map((box) => (
          <article className="panel box-card" key={box.id}>
            <div>
              <p className="box-code">{box.box_code}</p>
              <h2>{box.name}</h2>
              <p>{box.space_name} · {box.location || '未填写位置'}</p>
              <small>{box.visibility === 'public' ? '公开' : '私有'}</small>
            </div>
            <div className="card-actions">
              <Link to={`/b/${box.public_id}`}>查看</Link>
              <Link to={`/app/boxes/${box.id}/edit`}>编辑</Link>
              <button
                type="button"
                aria-label={`删除${box.name}`}
                onClick={() => setDeleteTarget(box)}
              >
                删除
              </button>
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
