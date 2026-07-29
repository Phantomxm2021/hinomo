import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { spaceSchema, type SpaceFormValues } from './space.schema'
import {
  createSpace,
  deleteSpace,
  listSpaces,
  type SpaceSummary,
  updateSpace,
} from './spaces.api'

export function SpacesPage() {
  const queryClient = useQueryClient()
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SpaceSummary | null>(null)
  const [editTarget, setEditTarget] = useState<SpaceSummary | null>(null)
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createSpace>[0]) => createSpace(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (spaceId: string) => deleteSpace(spaceId),
    onSuccess: async () => {
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['spaces'] })
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateSpace>[1] }) =>
      updateSpace(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: { name: '', description: '' },
  })

  const submit = handleSubmit(async (values) => {
    const input = {
      name: values.name,
      description: values.description || null,
    }

    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, input })
        setEditTarget(null)
      } else {
        await createMutation.mutateAsync(input)
      }
      reset()
    } catch {
      // Mutation state renders a stable Chinese error without leaking backend text.
    }
  })

  function beginEdit(space: SpaceSummary) {
    setEditTarget(space)
    reset({ name: space.name, description: space.description ?? '' })
  }

  function requestDelete(space: SpaceSummary) {
    setBlockedMessage(null)
    if (space.box_count > 0) {
      setBlockedMessage(`请先移动或删除其中的 ${space.box_count} 个箱子`)
      return
    }
    setDeleteTarget(space)
  }

  return (
    <section className="page-stack" aria-labelledby="spaces-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">整理你的收纳范围</p>
          <h1 id="spaces-title">空间</h1>
        </div>
      </header>

      <form className="panel form-stack" onSubmit={submit} noValidate>
        <h2>{editTarget ? '编辑空间' : '创建空间'}</h2>
        <label htmlFor="space-name">空间名称</label>
        <input id="space-name" {...register('name')} />
        {errors.name ? <p role="alert">{errors.name.message}</p> : null}
        <label htmlFor="space-description">描述（可选）</label>
        <textarea id="space-description" rows={3} {...register('description')} />
        {errors.description ? <p role="alert">{errors.description.message}</p> : null}
        {createMutation.isError || updateMutation.isError ? (
          <p role="alert">保存失败，请稍后重试</p>
        ) : null}
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? '保存中…'
            : editTarget
              ? '保存空间'
              : '创建空间'}
        </button>
        {editTarget ? (
          <button
            type="button"
            onClick={() => {
              setEditTarget(null)
              reset()
            }}
          >
            取消编辑
          </button>
        ) : null}
      </form>

      {blockedMessage ? <p role="alert">{blockedMessage}</p> : null}
      {deleteMutation.isError ? <p role="alert">删除失败，请稍后重试</p> : null}
      {spacesQuery.isPending ? <p role="status">正在加载空间…</p> : null}
      {spacesQuery.isError ? <p role="alert">空间加载失败，请重试</p> : null}
      {spacesQuery.data?.length === 0 ? <p className="empty-state">还没有空间</p> : null}
      <div className="card-grid">
        {spacesQuery.data?.map((space) => (
          <article className="panel space-card" key={space.id}>
            <div>
              <h2>{space.name}</h2>
              <p>{space.description || '暂无描述'}</p>
              <small>{space.box_count} 个箱子</small>
            </div>
            <div className="card-actions">
              <button
                type="button"
                aria-label={`编辑${space.name}`}
                onClick={() => beginEdit(space)}
              >
                编辑
              </button>
              <button
                type="button"
                aria-label={`删除${space.name}`}
                aria-disabled={space.box_count > 0}
                onClick={() => requestDelete(space)}
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
        description="删除后无法恢复。"
        busy={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </section>
  )
}
