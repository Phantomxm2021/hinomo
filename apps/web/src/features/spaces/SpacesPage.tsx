import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { spaceSchema, type SpaceFormValues } from './space.schema'
import {
  createSpace,
  deleteSpace,
  listSpaces,
  type SpaceSummary,
  updateSpace,
} from './spaces.api'

function getEditorControls(dialog: HTMLElement | null) {
  if (!dialog) return []
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
    ),
  )
}

export function SpacesPage() {
  const queryClient = useQueryClient()
  const editorOpenerRef = useRef<HTMLElement | null>(null)
  const headerCreateButtonRef = useRef<HTMLButtonElement | null>(null)
  const editorDialogRef = useRef<HTMLElement | null>(null)
  const editorCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const editorSubmitButtonRef = useRef<HTMLButtonElement | null>(null)
  const submissionPendingRef = useRef(false)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SpaceSummary | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
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
  const editorPending = createMutation.isPending || updateMutation.isPending
  const resetCreateMutation = createMutation.reset
  const resetUpdateMutation = updateMutation.reset

  const restoreEditorFocus = useCallback(() => {
    const opener = editorOpenerRef.current
    const focusTarget = opener?.isConnected && opener.tabIndex >= 0 && !opener.hasAttribute('disabled')
      ? opener
      : headerCreateButtonRef.current
    focusTarget?.focus()
    editorOpenerRef.current = null
  }, [])

  const closeEditor = useCallback(() => {
    if (editorPending) return
    setEditorOpen(false)
    setEditTarget(null)
    reset({ name: '', description: '' })
    resetCreateMutation()
    resetUpdateMutation()
  }, [editorPending, reset, resetCreateMutation, resetUpdateMutation])

  useEffect(() => {
    if (!editorOpen && editorOpenerRef.current) restoreEditorFocus()
  }, [editorOpen, restoreEditorFocus])

  const closeEditorOnEscape = useCallback((event: {
    key: string
  }) => {
    if (event.key === 'Escape') closeEditor()
  }, [closeEditor])

  useEffect(() => {
    if (!editorOpen) return

    document.addEventListener('keydown', closeEditorOnEscape)
    return () => document.removeEventListener('keydown', closeEditorOnEscape)
  }, [closeEditorOnEscape, editorOpen])

  useEffect(() => {
    if (!editorOpen) return

    const appShell = document.querySelector<HTMLElement>('.app-shell')
    const previousAriaHidden = appShell?.getAttribute('aria-hidden') ?? null
    const hadInert = appShell?.hasAttribute('inert') ?? false
    const previousBodyOverflow = document.body.style.overflow
    appShell?.setAttribute('inert', '')
    appShell?.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = 'hidden'

    return () => {
      if (appShell) {
        if (!hadInert) appShell.removeAttribute('inert')
        if (previousAriaHidden === null) appShell.removeAttribute('aria-hidden')
        else appShell.setAttribute('aria-hidden', previousAriaHidden)
      }
      document.body.style.overflow = previousBodyOverflow
    }
  }, [editorOpen])

  const submit = handleSubmit(async (values) => {
    if (submissionPendingRef.current) return
    submissionPendingRef.current = true
    const input = {
      name: values.name,
      description: values.description || null,
    }

    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, input })
      } else {
        await createMutation.mutateAsync(input)
      }
      setEditorOpen(false)
      setEditTarget(null)
      reset({ name: '', description: '' })
    } catch {
      // Mutation state renders a stable Chinese error without leaking backend text.
    } finally {
      submissionPendingRef.current = false
    }
  })

  function beginEdit(space: SpaceSummary) {
    editorOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    createMutation.reset()
    updateMutation.reset()
    setEditTarget(space)
    reset({ name: space.name, description: space.description ?? '' })
    setEditorOpen(true)
  }

  function beginCreate() {
    editorOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    createMutation.reset()
    updateMutation.reset()
    setEditTarget(null)
    reset({ name: '', description: '' })
    setEditorOpen(true)
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
    <section className="mx-auto grid w-full max-w-7xl gap-6" aria-labelledby="spaces-title">
      <header className="flex flex-col items-stretch justify-between gap-5 py-3 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">整理你的收纳范围</p>
          <h1 className="mb-0" id="spaces-title">空间</h1>
        </div>
        <button
          ref={headerCreateButtonRef}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-brand bg-brand px-4 py-2.5 font-bold text-white hover:bg-brand-strong sm:w-auto"
          type="button"
          onClick={beginCreate}
        >
          <AppIcon name="plus" size={20} />
          创建空间
        </button>
      </header>

      {editorOpen
        ? createPortal(
          <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor()
          }}
        >
            <section
              ref={editorDialogRef}
              className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-shell border border-line bg-surface p-6 shadow-float"
              role="dialog"
              aria-modal="true"
              aria-busy={editorPending}
              aria-labelledby="space-editor-title"
            >
            <span
              className="pointer-events-none fixed h-px w-px overflow-hidden opacity-0"
              tabIndex={0}
              onFocus={() => getEditorControls(editorDialogRef.current).at(-1)?.focus()}
            />
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="mb-0" id="space-editor-title">{editTarget ? '编辑空间' : '创建空间'}</h2>
              <button
                ref={editorCloseButtonRef}
                className="grid min-h-11 w-11 flex-none place-items-center rounded-control border border-line bg-canvas p-0 text-ink"
                type="button"
                aria-label={`关闭${editTarget ? '编辑空间' : '创建空间'}编辑器`}
                disabled={editorPending}
                onClick={closeEditor}
                onKeyDown={(event) => {
                  if (event.key === 'Tab' && event.shiftKey) {
                    event.preventDefault()
                    editorSubmitButtonRef.current?.focus()
                  }
                }}
              >
                <AppIcon name="close" />
              </button>
            </div>
            <form className="grid gap-3" onSubmit={submit} noValidate>
              <label className="font-bold text-ink" htmlFor="space-name">空间名称</label>
              <input
                className="min-h-12 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
                id="space-name"
                {...register('name')}
                autoFocus
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'space-name-error' : undefined}
                readOnly={editorPending}
              />
              {errors.name ? (
                <p id="space-name-error" role="alert">{errors.name.message}</p>
              ) : null}
              <label className="font-bold text-ink" htmlFor="space-description">描述（可选）</label>
              <textarea
                className="min-h-28 w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
                id="space-description"
                rows={3}
                {...register('description')}
                aria-invalid={errors.description ? 'true' : undefined}
                aria-describedby={errors.description ? 'space-description-error' : undefined}
                readOnly={editorPending}
              />
              {errors.description ? (
                <p id="space-description-error" role="alert">
                  {errors.description.message}
                </p>
              ) : null}
              {createMutation.isError || updateMutation.isError ? (
                <p role="alert">保存失败，请稍后重试</p>
              ) : null}
              {editorPending ? (
                <p role="status" aria-live="polite">正在保存空间…</p>
              ) : null}
              <div className="mt-3 flex justify-end gap-2.5">
                <button className="min-h-11 rounded-control border border-brand/40 bg-brand/10 px-4.5 py-2.5 font-bold text-ink" type="button" disabled={editorPending} onClick={closeEditor}>
                  取消
                </button>
                <button
                  ref={editorSubmitButtonRef}
                  className="min-h-11 rounded-control border border-brand bg-brand px-4.5 py-2.5 font-bold text-white hover:bg-brand-strong"
                  type="submit"
                  disabled={editorPending}
                  onKeyDown={(event) => {
                    if (event.key === 'Tab' && !event.shiftKey) {
                      event.preventDefault()
                      editorCloseButtonRef.current?.focus()
                    }
                  }}
                >
                  {editorPending ? '保存中…' : editTarget ? '保存空间' : '创建空间'}
                </button>
              </div>
            </form>
            <span
              className="pointer-events-none fixed h-px w-px overflow-hidden opacity-0"
              tabIndex={0}
              onFocus={() => getEditorControls(editorDialogRef.current)[0]?.focus()}
            />
            </section>
          </div>,
          document.body,
        )
        : null}

      {blockedMessage ? <p role="alert">{blockedMessage}</p> : null}
      {deleteMutation.isError ? <p role="alert">删除失败，请稍后重试</p> : null}
      {spacesQuery.isPending ? <p role="status">正在加载空间…</p> : null}
      {spacesQuery.isError ? <p role="alert">空间加载失败，请重试</p> : null}
      {spacesQuery.data?.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-card border border-dashed border-line bg-surface/70 p-7 text-center sm:p-12">
          <h2 className="mb-0">还没有空间</h2>
          <p>从房间或区域开始，让箱子和物品更容易找到。</p>
          <button className="inline-flex min-h-11 items-center justify-center rounded-control border border-brand bg-brand px-4 py-2.5 font-bold text-white hover:bg-brand-strong" type="button" onClick={beginCreate}>创建第一个空间</button>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {spacesQuery.data?.map((space) => (
          <article className="flex min-w-0 items-center justify-between gap-4 rounded-card border border-line bg-surface p-3" key={space.id}>
            <Link
              className="flex min-h-23 min-w-0 flex-1 items-center gap-3.5 rounded-control p-2 text-muted no-underline hover:bg-brand/10"
              to={`/app/boxes?space=${encodeURIComponent(space.id)}`}
            >
              <span className="grid h-12 w-12 flex-none place-items-center rounded-control bg-brand/10 text-brand-strong"><AppIcon name="space" size={24} /></span>
              <span className="min-w-0">
                <h2 className="mb-1.5 text-lg">{space.name}</h2>
                {space.description ? <p className="truncate">{space.description}</p> : null}
                <small className="mt-2 block">{space.box_count} 个箱子 · {space.item_count} 件物品</small>
              </span>
            </Link>
            <div className="flex flex-nowrap justify-end gap-2">
              <button
                className="grid min-h-11 w-11 place-items-center rounded-control border border-brand/40 bg-brand/10 p-0 text-ink"
                type="button"
                aria-label={`编辑${space.name}`}
                onClick={() => beginEdit(space)}
              >
                <AppIcon name="edit" size={19} />
              </button>
              <button
                className="grid min-h-11 w-11 place-items-center rounded-control border border-danger/30 bg-danger/5 p-0 text-danger"
                type="button"
                aria-label={`删除${space.name}`}
                onClick={() => requestDelete(space)}
              >
                <AppIcon name="trash" size={19} />
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
