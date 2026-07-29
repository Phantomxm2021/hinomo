import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { env } from '../../lib/env'
import { isUploadPending, uploadStageLabel } from '../media/media-ui'
import { useMediaUpload } from '../media/useMediaUpload'
import { boxQrPng, boxQrUrl } from '../qr-print/qr'
import { listSpaces } from '../spaces/spaces.api'
import { boxSchema, type BoxFormValues } from './box.schema'
import { createBox, getBox, type CreatedBox, updateBox } from './boxes.api'

export function BoxFormPage() {
  const { boxId } = useParams<{ boxId: string }>()
  const editing = Boolean(boxId)
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
  const boxQuery = useQuery({
    queryKey: ['box-edit', boxId],
    queryFn: () => getBox(boxId!),
    enabled: editing,
  })
  const [createdBox, setCreatedBox] = useState<CreatedBox | null>(null)
  const [saved, setSaved] = useState(false)
  const [qrPng, setQrPng] = useState<string | null>(null)
  const [qrError, setQrError] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [pendingBox, setPendingBox] = useState<CreatedBox | null>(null)
  const [mediaError, setMediaError] = useState(false)
  const mediaUpload = useMediaUpload()
  const mediaStatus = uploadStageLabel(mediaUpload.stage)
  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createBox>[0]) => createBox(input),
  })
  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateBox>[1]) => updateBox(boxId!, input),
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BoxFormValues>({
    resolver: zodResolver(boxSchema),
    defaultValues: {
      space_id: '',
      name: '',
      category: '',
      location: '',
      description: '',
      visibility: 'private',
    },
  })

  useEffect(() => {
    if (!boxQuery.data) return
    reset({
      space_id: boxQuery.data.space_id,
      name: boxQuery.data.name,
      category: boxQuery.data.category ?? '',
      location: boxQuery.data.location ?? '',
      description: boxQuery.data.description ?? '',
      visibility: boxQuery.data.visibility,
    })
  }, [boxQuery.data, reset])

  async function generateQr(box: CreatedBox) {
    setQrError(false)
    try {
      setQrPng(
        await boxQrPng(boxQrUrl(env.VITE_PUBLIC_APP_ORIGIN, box.public_id)),
      )
    } catch {
      setQrError(true)
    }
  }

  async function uploadCover(target: CreatedBox) {
    if (!coverFile) return
    await mediaUpload.upload({
      file: coverFile,
      boxId: target.id,
      itemId: null,
      kind: 'cover',
    })
  }

  async function retryCoverUpload() {
    if (!coverFile) return
    setMediaError(false)
    try {
      if (editing && boxId) {
        await mediaUpload.upload({ file: coverFile, boxId, itemId: null, kind: 'cover' })
        setSaved(true)
        return
      }
      if (pendingBox) {
        await uploadCover(pendingBox)
        setCreatedBox(pendingBox)
        await generateQr(pendingBox)
      }
    } catch {
      setMediaError(true)
    }
  }

  const submit = handleSubmit(async (values) => {
    let recordSaved = false
    const input = {
      space_id: values.space_id,
      name: values.name,
      category: values.category || null,
      location: values.location || null,
      description: values.description || null,
      visibility: values.visibility,
    }
    setMediaError(false)
    setSaved(false)
    try {
      if (editing) {
        await updateMutation.mutateAsync(input)
        recordSaved = true
        if (coverFile && boxId) {
          await mediaUpload.upload({ file: coverFile, boxId, itemId: null, kind: 'cover' })
        }
        setSaved(true)
        return
      }
      const box = await createMutation.mutateAsync(input)
      recordSaved = true
      setPendingBox(box)
      await uploadCover(box)
      setCreatedBox(box)
      await generateQr(box)
    } catch {
      if (recordSaved) setMediaError(true)
    }
  })

  if (createdBox) {
    const publicUrl = boxQrUrl(env.VITE_PUBLIC_APP_ORIGIN, createdBox.public_id)
    return (
      <section className="page-stack" aria-labelledby="created-box-title">
        <p className="eyebrow">箱子已创建</p>
        <h1 id="created-box-title">{createdBox.name}</h1>
        <div className="panel qr-panel">
          <strong>{createdBox.box_code}</strong>
          <a href={publicUrl}>{publicUrl}</a>
          {qrPng ? <img src={qrPng} alt={`${createdBox.name}二维码`} /> : null}
          {qrError ? <p role="alert">二维码生成失败，请重试</p> : null}
          <div className="card-actions">
            <button type="button" onClick={() => void generateQr(createdBox)}>
              重新生成
            </button>
            {qrPng ? (
              <a download={`${createdBox.box_code}.png`} href={qrPng}>
                下载 PNG
              </a>
            ) : null}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="page-stack" aria-labelledby="box-form-title">
      <header className="page-heading">
        <p className="eyebrow">为实体箱子建立数字身份</p>
        <h1 id="box-form-title">{editing ? '编辑箱子' : '创建箱子'}</h1>
      </header>
      <form className="panel form-stack" onSubmit={submit} noValidate>
        <label htmlFor="box-space">空间</label>
        <select id="box-space" {...register('space_id')}>
          <option value="">请选择空间</option>
          {spacesQuery.data?.map((space) => (
            <option value={space.id} key={space.id}>{space.name}</option>
          ))}
        </select>
        {errors.space_id ? <p role="alert">{errors.space_id.message}</p> : null}

        <label htmlFor="box-name">箱子名称</label>
        <input id="box-name" {...register('name')} />
        {errors.name ? <p role="alert">{errors.name.message}</p> : null}

        <label htmlFor="box-category">分类（可选）</label>
        <input id="box-category" {...register('category')} />
        <label htmlFor="box-location">具体位置</label>
        <input id="box-location" {...register('location')} />
        <label htmlFor="box-description">备注（可选）</label>
        <textarea id="box-description" rows={4} {...register('description')} />

        <label htmlFor="box-cover">箱子封面（可选）</label>
        <input
          id="box-cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            setCoverFile(event.target.files?.[0] ?? null)
            setMediaError(false)
            mediaUpload.reset()
          }}
        />

        <label htmlFor="box-visibility">查看权限</label>
        <select id="box-visibility" {...register('visibility')}>
          <option value="private">私有</option>
          <option value="public">公开</option>
        </select>

        {boxQuery.isError ? <p role="alert">箱子加载失败，请重试</p> : null}
        {createMutation.isError || updateMutation.isError ? (
          <p role="alert">保存失败，请稍后重试</p>
        ) : null}
        {saved ? <p role="status">修改已保存</p> : null}
        {mediaStatus ? <p role="status">图片处理中：{mediaStatus}</p> : null}
        {mediaError ? (
          <div className="upload-error" role="alert">
            <p>图片上传失败，已保留填写内容。</p>
            <button type="button" onClick={() => void retryCoverUpload()}>重试上传</button>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending || isUploadPending(mediaUpload.stage)}
        >
          {createMutation.isPending || updateMutation.isPending
            ? '保存中…'
            : editing
              ? '保存修改'
              : '创建箱子'}
        </button>
      </form>
    </section>
  )
}
