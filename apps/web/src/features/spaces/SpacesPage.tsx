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
    <section className="spaces-page page-stack" aria-labelledby="spaces-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">整理你的收纳范围</p>
          <h1 id="spaces-title">空间</h1>
        </div>
        <button
          ref={headerCreateButtonRef}
          className="spaces-create-button"
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
          className="sheet-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor()
          }}
        >
            <section
              ref={editorDialogRef}
              className="space-editor"
              role="dialog"
              aria-modal="true"
              aria-busy={editorPending}
              aria-labelledby="space-editor-title"
            >
            <span
              className="space-editor-focus-sentinel"
              tabIndex={0}
              onFocus={() => getEditorControls(editorDialogRef.current).at(-1)?.focus()}
            />
            <div className="space-editor-heading">
              <h2 id="space-editor-title">{editTarget ? '编辑空间' : '创建空间'}</h2>
              <button
                ref={editorCloseButtonRef}
                className="space-editor-close"
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
            <form className="form-stack" onSubmit={submit} noValidate>
              <label htmlFor="space-name">空间名称</label>
              <input
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
              <label htmlFor="space-description">描述（可选）</label>
              <textarea
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
              <div className="space-editor-actions">
                <button type="button" disabled={editorPending} onClick={closeEditor}>
                  取消
                </button>
                <button
                  ref={editorSubmitButtonRef}
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
              className="space-editor-focus-sentinel"
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
        <div className="empty-state spaces-empty-state">
          <h2>还没有空间</h2>
          <p>从房间或区域开始，让箱子和物品更容易找到。</p>
          <button type="button" onClick={beginCreate}>创建第一个空间</button>
        </div>
      ) : null}
      <div className="card-grid spaces-card-grid">
        {spacesQuery.data?.map((space) => (
          <article className="panel space-card" key={space.id}>
            <Link
              className="space-card-link"
              to={`/app/boxes?space=${encodeURIComponent(space.id)}`}
            >
              <span className="space-card-icon"><AppIcon name="space" size={24} /></span>
              <span className="space-card-content">
                <h2>{space.name}</h2>
                {space.description ? <p>{space.description}</p> : null}
                <small>{space.box_count} 个箱子 · {space.item_count} 件物品</small>
              </span>
            </Link>
            <div className="card-actions">
              <button
                className="space-card-action"
                type="button"
                aria-label={`编辑${space.name}`}
                onClick={() => beginEdit(space)}
              >
                <AppIcon name="edit" size={19} />
              </button>
              <button
                className="space-card-action space-card-delete"
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
