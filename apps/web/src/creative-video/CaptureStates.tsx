import { AppIcon } from '../components/AppIcon'

export type CaptureStateName = 'capture' | 'ai-before' | 'ai-after' | 'inventory' | 'scanner'

function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative h-[932px] w-[430px] overflow-hidden bg-canvas text-ink"
      data-video-capture-root
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-between px-6 text-[0.78rem] font-extrabold text-ink" aria-hidden="true">
        <span>9:41</span>
        <span className="flex items-center gap-1.5"><span>5G</span><span className="block h-2.5 w-5 rounded-[0.2rem] border border-ink/70"><span className="block h-full w-3.5 rounded-[0.12rem] bg-ink" /></span></span>
      </div>
      <div className="h-full pt-12">{children}</div>
    </main>
  )
}

function BrandHeader({ eyebrow, title, onBack = false }: { eyebrow: string; title: string; onBack?: boolean }) {
  return (
    <header className="border-b border-line/70 bg-surface/95 px-5 pb-4 pt-3 backdrop-blur-xl">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center">
        <span className="grid size-10 place-items-center text-brand">{onBack ? '‹' : <img className="size-8 rounded-[0.7rem]" src="/brand/nomo-apple-icon-v2-64.png" alt="" />}</span>
        <div className="min-w-0 text-center"><p className="truncate text-[0.67rem] font-extrabold uppercase tracking-[0.16em] text-brand-strong">{eyebrow}</p><h1 className="m-0 truncate text-[1.05rem] font-extrabold text-ink">{title}</h1></div>
        <span />
      </div>
    </header>
  )
}

function PackingCaptureState() {
  return (
    <MobileFrame>
      <section className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] bg-canvas">
        <header className="relative grid min-h-[5.25rem] grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center border-b border-line/60 bg-surface/95 px-4 pt-2 backdrop-blur-xl">
          <button className="justify-self-start text-[1.02rem] font-semibold text-brand" type="button">Cancel</button>
          <div className="min-w-0 text-center"><h1 className="m-0 truncate text-[1.08rem] font-extrabold text-ink">AI packing</h1><p className="mt-0.5 truncate text-xs font-semibold text-muted">BX-001 · Box 1 · 0 photos</p></div>
          <button className="justify-self-end text-[1.02rem] font-bold text-muted/45" type="button">Done</button>
        </header>
        <div className="grid min-h-0 place-content-center justify-items-center gap-5 px-7 py-7 text-center">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.55rem] bg-ink shadow-float" aria-label="Packing camera preview">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgb(223_101_56_/_22%),transparent_43%),linear-gradient(145deg,rgb(91_75_59),rgb(31_27_23))]" />
            <span className="absolute top-1/2 left-1/2 aspect-square w-44 -translate-x-1/2 -translate-y-1/2 rounded-[1.35rem] border border-white/75" />
            <span className="absolute right-5 bottom-5 rounded-full bg-black/35 px-3 py-1.5 text-[0.7rem] font-bold text-white/90">Box 1</span>
          </div>
          <div className="max-w-sm"><h2 className="m-0 text-[1.45rem] leading-tight font-extrabold text-ink">Start with the first item</h2><p className="mt-2 text-[0.94rem] leading-6 text-muted">Take one photo for each item. No names or quantities are needed—AI will organize a photo inventory when you finish.</p></div>
          <button className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-brand px-7 text-base font-extrabold text-white shadow-soft" type="button" aria-label="Take a photo of this item"><AppIcon name="scan" size={21} />Take a photo</button>
          <p className="text-xs font-semibold text-muted">The rear camera will open and the image will be compressed to JPEG</p>
        </div>
        <div className="h-[calc(1rem+var(--safe-area-bottom))] bg-canvas" />
      </section>
    </MobileFrame>
  )
}

type DetectedItem = { name: string; description: string; quantity: string; actionable?: boolean }

function DetectedItemCard({ item }: { item: DetectedItem }) {
  return (
    <article className="border-b border-line/60 p-4 last:border-b-0">
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
        <span className="grid size-14 place-content-center overflow-hidden rounded-[0.9rem] bg-brand/10 text-brand"><AppIcon name={item.name === 'HDMI cable' ? 'scan' : item.name === 'Power adapter' ? 'plus' : 'box'} size={26} /></span>
        <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><h3 className="m-0 truncate text-[1rem] font-bold text-ink">{item.name}</h3><span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[0.66rem] font-bold text-brand">AI detected</span></div><p className="mt-0.5 truncate text-sm text-muted">{item.description}</p><p className="mt-1 text-sm font-extrabold text-ink">{item.quantity}</p></div>
        <button className="grid size-10 place-items-center rounded-full text-muted" type="button" aria-label={`More actions for ${item.name}`}><AppIcon name="more" /></button>
      </div>
      {item.actionable ? <button className="mt-3 min-h-11 w-full rounded-control bg-ink px-4 font-extrabold text-white" type="button">Add to list</button> : null}
    </article>
  )
}

const detectedItems: DetectedItem[] = [
  { name: 'HDMI cable', description: 'Black braided video cable', quantity: '1', actionable: true },
  { name: 'Power adapter', description: 'Compact white wall adapter', quantity: '1' },
  { name: 'Tape measure', description: 'Small beige household tool', quantity: '1' },
]

function AiResultState({ after }: { after: boolean }) {
  const items = after ? detectedItems.filter((item) => item.name !== 'HDMI cable') : detectedItems
  return (
    <MobileFrame>
      <section className="h-full bg-canvas">
        <BrandHeader eyebrow="Box 1 · AI packing" title="Analysis result" onBack />
        <div className="px-4 py-5">
          <section className="overflow-hidden rounded-[1.35rem] border border-line bg-surface shadow-soft">
            <div className="flex items-end justify-between gap-3 border-b border-line/60 px-4 py-4"><div><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-brand-strong">Recognized items</p><h2 className="mt-1 text-[1.55rem] font-extrabold text-ink">{items.length} items found</h2></div><span className="mb-1 rounded-full bg-success/12 px-3 py-1 text-xs font-extrabold text-success">Analysis complete</span></div>
            <div>{items.map((item) => <DetectedItemCard key={item.name} item={item} />)}</div>
          </section>
          {after ? <p className="mt-4 rounded-control bg-brand/10 px-4 py-3 text-center text-sm font-bold text-brand-strong">HDMI cable added to Box 1</p> : null}
        </div>
      </section>
    </MobileFrame>
  )
}

function InventoryState() {
  const items = [
    { name: 'HDMI cable', description: 'Black braided video cable' },
    { name: 'Power adapter', description: 'Compact white wall adapter' },
    { name: 'Tape measure', description: 'Small beige household tool' },
  ]
  return (
    <MobileFrame>
      <section className="h-full bg-canvas">
        <BrandHeader eyebrow="Living room · BX-001" title="Box 1" onBack />
        <div className="px-5 py-5">
          <section className="rounded-[1.55rem] bg-ink p-5 text-white shadow-float"><div className="flex items-center justify-between"><span className="grid size-14 place-items-center rounded-[1rem] bg-white/12"><AppIcon name="box" size={27} /></span><span className="rounded-full bg-white/12 px-3 py-1 text-xs font-extrabold">3 items</span></div><p className="mt-5 text-[1.75rem] font-extrabold text-white">Box 1</p><p className="mt-1 text-sm text-white/65">Living room storage · Updated just now</p></section>
          <div className="mt-6 flex items-center justify-between"><h2 className="text-[1.25rem] font-extrabold text-ink">Inside this box</h2><span className="text-sm font-bold text-muted">3 total</span></div>
          <section className="mt-3 overflow-hidden rounded-[1.3rem] border border-line bg-surface shadow-soft">{items.map((item) => <article className="flex items-center gap-3 border-b border-line/60 p-4 last:border-0" key={item.name}><span className="grid size-14 shrink-0 place-items-center rounded-[0.9rem] bg-brand/10 text-brand"><AppIcon name={item.name === 'HDMI cable' ? 'scan' : 'plus'} size={25} /></span><div><h3 className="font-extrabold text-ink">{item.name}</h3><p className="mt-1 text-sm text-muted">{item.description}</p><p className="mt-1 text-sm font-bold text-ink">Quantity 1</p></div></article>)}</section>
        </div>
      </section>
    </MobileFrame>
  )
}

function ScannerState() {
  return (
    <MobileFrame>
      <section className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] bg-canvas px-5 pb-6">
        <header className="py-5"><p className="mb-1 text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-brand-strong">Point at the QR code on a box</p><h1 className="m-0 text-[2rem] font-extrabold text-ink">Scan to view</h1></header>
        <div className="scanner-camera relative min-h-0 overflow-hidden rounded-[1.65rem] bg-ink shadow-float" aria-label="QR scanner view">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgb(122_95_68_/_45%),transparent_46%),linear-gradient(145deg,rgb(76_63_50),rgb(24_21_18))]" />
          <div className="scanner-feedback pointer-events-none absolute inset-0" aria-hidden="true"><span className="scanner-vignette absolute inset-0" /><span className="scanner-target absolute top-1/2 left-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2"><span className="scanner-corner scanner-corner-top-left absolute top-0 left-0" /><span className="scanner-corner scanner-corner-top-right absolute top-0 right-0" /><span className="scanner-corner scanner-corner-bottom-left absolute bottom-0 left-0" /><span className="scanner-corner scanner-corner-bottom-right absolute right-0 bottom-0" /><span className="scanner-beam absolute right-[4%] left-[4%] h-px" /><span className="scanner-focus-dot absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" /></span></div>
        </div>
        <p className="px-4 pt-5 text-center text-sm font-semibold leading-6 text-muted">Hold the label inside the frame. Nomo opens the matching box automatically.</p>
      </section>
    </MobileFrame>
  )
}

export function CaptureState({ state }: { state: CaptureStateName }) {
  if (state === 'capture') return <PackingCaptureState />
  if (state === 'ai-before') return <AiResultState after={false} />
  if (state === 'ai-after') return <AiResultState after />
  if (state === 'inventory') return <InventoryState />
  return <ScannerState />
}
