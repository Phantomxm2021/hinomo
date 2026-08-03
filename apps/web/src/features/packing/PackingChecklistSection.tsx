import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { PackingAuthorizedImage } from './PackingAuthorizedImage'
import {
  getPackingPhoto,
  listDetectedPackingItems,
  listPackingSessions,
  mergeDetectedPackingItems,
  requestPackingItemPromotion,
  requestPackingReanalysis,
  updateDetectedPackingItem,
  type PackingDetectedItem,
} from './packing.api'

const sessionLabels: Record<string, string> = {
  capturing: '正在拍摄', uploading: '正在上传', queued: '等待分析', processing: 'AI 正在生成清单',
  ready: '分析完成', partial_failed: '部分完成', failed: '分析失败', canceled: '已取消',
}

function quantityLabel(kind: string, value: number | null): string {
  if (kind === 'unknown' || value === null) return '数量未知'
  if (kind === 'at_least') return `至少 ${value} 件`
  if (kind === 'approximate') return `约 ${value} 件`
  return `${value} 件`
}

function normalizedBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4 || value.some((part) => typeof part !== 'number')) return null
  const [x1, y1, x2, y2] = value as number[]
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return null
  return [x1, y1, x2, y2]
}

function EvidenceOverlay({ item, onClose }: { item: PackingDetectedItem; onClose: () => void }) {
  const photoId = item.crop_source_photo_id ?? item.first_seen_photo_id
  const photoQuery = useQuery({
    queryKey: ['packing-evidence-photo', photoId],
    queryFn: () => getPackingPhoto(photoId ?? ''),
    enabled: Boolean(photoId),
  })
  const bbox = normalizedBbox(item.crop_bbox)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label={`${item.name}原图证据`}>
      <div className="w-full max-w-3xl rounded-[1.25rem] bg-surface p-4 shadow-float">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><p className="font-extrabold text-ink">{item.name}</p><p className="text-sm text-muted">框选区域来自 AI 定位，可返回裁剪图核对。</p></div>
          <button className="min-h-11 rounded-control px-4 font-bold text-ink" type="button" onClick={onClose}>关闭</button>
        </div>
        {photoQuery.data ? (
          <div className="relative mx-auto max-h-[70dvh] w-fit overflow-hidden rounded-control bg-placeholder">
            <PackingAuthorizedImage objectKey={photoQuery.data.object_key} alt={`${item.name}来源原图`} className="block max-h-[70dvh] max-w-full object-contain" />
            {bbox ? <span className="pointer-events-none absolute border-[3px] border-danger shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" style={{ left: `${bbox[0] * 100}%`, top: `${bbox[1] * 100}%`, width: `${(bbox[2] - bbox[0]) * 100}%`, height: `${(bbox[3] - bbox[1]) * 100}%` }} /> : null}
          </div>
        ) : <p className="grid min-h-48 place-content-center text-muted">{photoId ? '正在读取原图…' : '没有可用的原图证据'}</p>}
      </div>
    </div>
  )
}

function ChecklistItem({ item, boxId, mergeTargets }: { item: PackingDetectedItem; boxId: string; mergeTargets: PackingDetectedItem[] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [quantityKind, setQuantityKind] = useState(item.quantity_kind)
  const [quantityValue, setQuantityValue] = useState(item.quantity_value?.toString() ?? '')

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['packing-detected-items', boxId] })
  const updateMutation = useMutation({
    mutationFn: (reviewStatus: PackingDetectedItem['review_status']) => updateDetectedPackingItem(item.id, {
      name: name.trim(), category: category.trim() || null, description: description.trim() || null,
      quantity_kind: quantityKind,
      quantity_value: quantityKind === 'unknown' ? null : Number(quantityValue),
      review_status: reviewStatus,
    }),
    onSuccess: () => { setEditing(false); void refresh() },
  })
  const promotionMutation = useMutation({
    mutationFn: () => requestPackingItemPromotion(item.id),
    onSuccess: () => { void refresh() },
  })
  const mergeMutation = useMutation({
    mutationFn: () => mergeDetectedPackingItems(mergeTargetId, item.id),
    onSuccess: () => { setMerging(false); void refresh() },
  })

  const canSave = name.trim().length > 0 && (quantityKind === 'unknown' || Number(quantityValue) > 0)
  const canPromote = item.quantity_kind === 'exact' && item.quantity_value !== null && item.crop_status === 'ready'

  return (
    <article className="border-b border-line/60 p-3 last:border-b-0">
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3">
        <button className="grid size-14 place-content-center overflow-hidden rounded-[0.9rem] bg-placeholder text-muted" type="button" aria-label={`查看${item.name}原图证据`} onClick={() => setShowEvidence(true)}>
          {item.cover_object_key ? <PackingAuthorizedImage objectKey={item.cover_object_key} alt={`${item.name}裁剪图片`} className="h-full w-full object-cover" /> : <AppIcon name="box" />}
        </button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2"><h3 className="m-0 truncate font-bold text-ink">{item.name}</h3><span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[0.6875rem] font-bold text-brand">AI 识别</span></div>
          <p className="mt-0.5 truncate text-sm text-muted">{item.description || item.category || '未分类'}</p>
          {item.review_status === 'needs_review' || item.crop_status !== 'ready' ? <p className="mt-1 text-xs font-bold text-danger">需要确认</p> : null}
        </div>
        <span className="text-sm font-bold text-muted">{quantityLabel(item.quantity_kind, item.quantity_value)}</span>
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2 rounded-control bg-canvas p-3">
          <input className="min-h-11 rounded-control border border-line bg-surface px-3" aria-label="AI 物品名称" value={name} onChange={(event) => setName(event.target.value)} />
          <div className="grid grid-cols-2 gap-2"><input className="min-h-11 rounded-control border border-line bg-surface px-3" aria-label="AI 物品分类" placeholder="分类（可选）" value={category} onChange={(event) => setCategory(event.target.value)} /><input className="min-h-11 rounded-control border border-line bg-surface px-3" aria-label="AI 物品描述" placeholder="描述（可选）" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2"><select className="min-h-11 rounded-control border border-line bg-surface px-3" aria-label="AI 数量类型" value={quantityKind} onChange={(event) => setQuantityKind(event.target.value as PackingDetectedItem['quantity_kind'])}><option value="exact">精确</option><option value="at_least">至少</option><option value="approximate">大约</option><option value="unknown">未知</option></select><input className="min-h-11 rounded-control border border-line bg-surface px-3 disabled:opacity-50" aria-label="AI 物品数量" type="number" min="1" disabled={quantityKind === 'unknown'} value={quantityValue} onChange={(event) => setQuantityValue(event.target.value)} /></div>
          <div className="flex justify-end gap-2"><button className="min-h-10 px-3 font-bold text-muted" type="button" onClick={() => setEditing(false)}>取消</button><button className="min-h-10 rounded-control bg-brand px-4 font-bold text-white disabled:opacity-50" type="button" disabled={!canSave || updateMutation.isPending} onClick={() => updateMutation.mutate('corrected')}>保存修正</button></div>
        </div>
      ) : merging ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-control bg-canvas p-3">
          <label className="mr-auto text-sm font-bold text-muted" htmlFor={`merge-${item.id}`}>合并到</label>
          <select id={`merge-${item.id}`} className="min-h-10 min-w-40 rounded-control border border-line bg-surface px-3" value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}><option value="">选择保留项</option>{mergeTargets.map((target) => <option key={target.id} value={target.id}>{target.name} · {quantityLabel(target.quantity_kind, target.quantity_value)}</option>)}</select>
          <button className="min-h-10 px-3 font-bold text-muted" type="button" onClick={() => setMerging(false)}>取消</button>
          <button className="min-h-10 rounded-control bg-brand px-4 font-bold text-white disabled:opacity-50" type="button" disabled={!mergeTargetId || mergeMutation.isPending} onClick={() => mergeMutation.mutate()}>确认合并</button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap justify-end gap-1">
          <button className="min-h-9 px-3 text-sm font-bold text-muted" type="button" onClick={() => setShowEvidence(true)}>原图</button>
          <button className="min-h-9 px-3 text-sm font-bold text-muted" type="button" onClick={() => setEditing(true)}>修改</button>
          {mergeTargets.length > 0 ? <button className="min-h-9 px-3 text-sm font-bold text-muted" type="button" onClick={() => setMerging(true)}>合并</button> : null}
          <button className="min-h-9 px-3 text-sm font-bold text-danger" type="button" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate('dismissed')}>驳回</button>
          {item.review_status !== 'confirmed' ? <button className="min-h-9 rounded-control bg-brand/10 px-3 text-sm font-bold text-brand" type="button" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate('confirmed')}>确认</button> : null}
          <button className="min-h-9 rounded-control bg-ink px-3 text-sm font-bold text-white disabled:opacity-40" type="button" title={canPromote ? undefined : '需要精确数量和有效裁剪图'} disabled={!canPromote || promotionMutation.isPending || promotionMutation.isSuccess} onClick={() => promotionMutation.mutate()}>{promotionMutation.isPending || promotionMutation.isSuccess ? '正在转为正式物品' : '设为正式物品'}</button>
        </div>
      )}
      {updateMutation.isError || promotionMutation.isError || mergeMutation.isError ? <p className="mt-2 text-right text-xs font-bold text-danger">操作失败，请稍后重试</p> : null}
      {showEvidence ? <EvidenceOverlay item={item} onClose={() => setShowEvidence(false)} /> : null}
    </article>
  )
}

export function PackingChecklistSection({ boxId }: { boxId: string }) {
  const queryClient = useQueryClient()
  const sessionsQuery = useQuery({ queryKey: ['packing-sessions', boxId], queryFn: () => listPackingSessions(boxId), refetchInterval: (query) => query.state.data?.some((session) => ['queued', 'processing'].includes(session.status)) ? 3000 : false })
  const itemsQuery = useQuery({ queryKey: ['packing-detected-items', boxId], queryFn: () => listDetectedPackingItems(boxId), refetchInterval: 5000 })
  const activeSession = sessionsQuery.data?.find((session) => ['queued', 'processing', 'partial_failed', 'failed'].includes(session.status))
  const items = itemsQuery.data ?? []
  const reanalysisMutation = useMutation({ mutationFn: () => requestPackingReanalysis(activeSession?.id ?? ''), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['packing-sessions', boxId] }) } })

  if (!activeSession && items.length === 0) return null
  return (
    <section className="grid gap-3" aria-labelledby="ai-packing-heading">
      <div className="flex items-end justify-between gap-4"><div><p className="mb-1 text-sm font-extrabold text-brand">AI 装箱</p><h2 className="m-0 text-section-title font-bold text-ink" id="ai-packing-heading">智能清单</h2></div>{activeSession ? <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{sessionLabels[activeSession.status]}</span> : null}</div>
      {activeSession && ['queued', 'processing'].includes(activeSession.status) ? <div className="flex items-center gap-3 rounded-card border border-brand/15 bg-brand/5 p-4" role="status"><span className="size-4 animate-pulse rounded-full bg-brand" /><div><p className="font-bold text-ink">正在整理 {activeSession.photo_count} 张装箱照片</p><p className="mt-1 text-sm text-muted">可以先离开，完成后清单会自动出现在这里。</p></div></div> : null}
      {activeSession && ['partial_failed', 'failed'].includes(activeSession.status) ? <div className="flex items-center justify-between gap-3 rounded-card border border-danger/20 bg-danger/5 p-4"><p className="font-bold text-danger">本次分析没有完整完成，已保留可用结果。</p><button className="min-h-10 shrink-0 rounded-control bg-danger px-4 font-bold text-white" type="button" disabled={reanalysisMutation.isPending} onClick={() => reanalysisMutation.mutate()}>重新分析</button></div> : null}
      {items.length > 0 ? <div className="overflow-hidden rounded-[1.25rem] bg-surface shadow-[inset_0_0_0_1px_rgba(79,64,48,0.06)]">{items.map((item) => <ChecklistItem key={item.id} item={item} boxId={boxId} mergeTargets={items.filter((candidate) => candidate.id !== item.id)} />)}</div> : null}
    </section>
  )
}
