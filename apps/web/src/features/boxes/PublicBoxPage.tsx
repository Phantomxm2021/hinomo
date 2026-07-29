import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useAuth } from '../auth/auth-context'
import { ItemForm } from '../items/ItemForm'
import { deleteItem, type ItemRecord } from '../items/items.api'
import { getBoxByPublicId } from './boxes.api'

export function PublicBoxPage() {
  const { publicId = '' } = useParams<{ publicId: string }>()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null)
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
  const refreshItems = async () => {
    setShowItemForm(false)
    setEditingItem(null)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['box', publicId] }),
      queryClient.invalidateQueries({ queryKey: ['items', box.id] }),
    ])
  }

  return (
    <main className="public-box page-stack">
      <header className="page-heading heading-actions">
        <div>
          <p className="box-code">{box.box_code}</p>
          <h1>{box.name}</h1>
          <p>{box.space_name} · {box.location || '未填写位置'}</p>
        </div>
        {isOwner ? <button type="button" onClick={() => setShowItemForm(true)}>新增物品</button> : null}
      </header>
      <p>{box.description || '暂无备注'}</p>
      <p className="summary-count">共 {totalQuantity} 件 · {box.items.length} 种物品</p>

      {isOwner && (showItemForm || editingItem) ? (
        <ItemForm
          boxId={box.id}
          item={editingItem}
          onSaved={() => void refreshItems()}
          onCancel={() => { setShowItemForm(false); setEditingItem(null) }}
        />
      ) : null}

      <div className="card-grid">
        {box.items.map((item) => (
          <article className="panel item-card" key={item.id}>
            <div><h2>{item.name}</h2><p>{item.category || '未分类'} · {item.quantity} 件</p></div>
            {isOwner ? (
              <div className="card-actions">
                <button type="button" aria-label={`编辑${item.name}`} onClick={() => setEditingItem(item)}>编辑</button>
                <button type="button" aria-label={`删除${item.name}`} onClick={() => setDeleteTarget(item)}>删除</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

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
