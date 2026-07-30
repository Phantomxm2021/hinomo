import type { ReactNode } from 'react'

type PageStateProps =
  | { state: 'loading'; label: string }
  | { state: 'empty'; title: string; action?: ReactNode }
  | { state: 'error'; message: string; onRetry: () => void }

export function PageState(props: PageStateProps) {
  if (props.state === 'loading') {
    return (
      <div className="grid min-h-40 place-content-center rounded-card border border-dashed border-line bg-surface/70 p-6 text-center text-muted" role="status">
        {props.label}
      </div>
    )
  }

  if (props.state === 'empty') {
    return (
      <div className="grid min-h-40 place-content-center justify-items-center gap-4 rounded-card border border-dashed border-line bg-surface/70 p-6 text-center">
        <h2 className="m-0 text-xl font-extrabold text-ink">{props.title}</h2>
        {props.action}
      </div>
    )
  }

  return (
    <div className="grid min-h-40 place-content-center justify-items-center gap-4 rounded-card border border-danger/25 bg-surface p-6 text-center" role="alert">
      <h2 className="m-0 text-xl font-extrabold text-danger">{props.message}</h2>
      <button className="min-h-11 rounded-control border border-danger/30 bg-danger/5 px-4 py-2 font-bold text-danger" type="button" onClick={props.onRetry}>重试</button>
    </div>
  )
}
