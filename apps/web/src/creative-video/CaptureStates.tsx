import { AppIcon } from '../components/AppIcon'

export type CaptureStateName = 'camera-capture' | 'photo-confirmation' | 'ai-pending' | 'ai-after-add' | 'box-details' | 'scanner'

const packedBoxPhoto = '/creative/box-1-packed-photo.png'

function MobileFrame({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <main className={`relative h-[932px] w-[430px] overflow-hidden ${dark ? 'bg-black text-white' : 'bg-canvas text-ink'}`} data-video-capture-root>
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex h-12 items-center justify-between px-6 text-[0.78rem] font-extrabold ${dark ? 'text-white' : 'text-ink'}`} aria-hidden="true">
        <span>9:41</span><span className="flex items-center gap-1.5"><span>5G</span><span className={`block h-2.5 w-5 rounded-[0.2rem] border ${dark ? 'border-white/70' : 'border-ink/70'}`}><span className={`block h-full w-3.5 rounded-[0.12rem] ${dark ? 'bg-white' : 'bg-ink'}`} /></span></span>
      </div>
      {children}
    </main>
  )
}

function CameraImage({ label }: { label: string }) {
  return <img className="h-full w-full object-cover" src={packedBoxPhoto} alt={label} />
}

function CameraCaptureState() {
  return (
    <MobileFrame dark>
      <section className="grid h-full grid-rows-[minmax(0,1fr)_10rem] pt-12">
        <div className="relative overflow-hidden bg-black" aria-label="Camera preview of the packed Box 1">
          <CameraImage label="Camera preview of the packed Box 1" />
          <span className="absolute top-4 right-5 grid size-11 place-items-center rounded-full bg-black/55 text-white"><AppIcon name="scan" size={19} /></span>
        </div>
        <div className="relative grid grid-rows-[auto_auto] place-items-center bg-black pt-3">
          <div className="flex items-center gap-7 text-lg font-medium text-white/90"><span>0.5</span><span className="rounded-full bg-white/15 px-3 py-1 text-brand">1×</span><span>2</span><span>4</span></div>
          <button className="grid size-[5.6rem] place-items-center rounded-full border-[0.42rem] border-white bg-white shadow-[0_0_0_4px_rgb(255_255_255_/_20%)]" type="button" aria-label="Take photo"><span className="sr-only">Take a photo</span></button>
          <span className="absolute bottom-5 left-8 rounded-full border border-white/25 px-4 py-2 text-xs font-bold">PHOTO</span>
        </div>
      </section>
      <h1 className="sr-only">Take a photo</h1>
    </MobileFrame>
  )
}

function PhotoConfirmationState() {
  return (
    <MobileFrame dark>
      <section className="grid h-full grid-rows-[minmax(0,1fr)_8.5rem] pt-12">
        <div className="overflow-hidden bg-black" aria-label="Captured photo of the packed Box 1"><CameraImage label="Captured photo of the packed Box 1" /></div>
        <div className="flex items-center justify-between bg-[#141414] px-7"><button className="text-xl font-medium" type="button" aria-label="Retake photo">Retake</button><button className="text-xl font-medium" type="button" aria-label="Use photo">Use Photo</button></div>
      </section>
    </MobileFrame>
  )
}

function BrandHeader({ title }: { title: string }) {
  return <header className="flex h-[4.6rem] items-center justify-between border-b border-line/70 px-5"><span className="text-3xl leading-none">‹</span><h1 className="text-[1.05rem] font-extrabold">Nomo Box · {title}</h1><span className="text-2xl">＋</span></header>
}

type DetectedItem = { name: string; description: string; photoPosition: string }

const detectedItems: DetectedItem[] = [
  { name: 'HDMI cable', description: 'Black braided video cable', photoPosition: 'right bottom' },
  { name: 'White power adapter', description: 'Compact white wall adapter', photoPosition: 'left bottom' },
  { name: 'Tape measure', description: 'Small beige household tool', photoPosition: 'center bottom' },
]

function ItemCard({ item }: { item: DetectedItem }) {
  return <article className="border-b border-line/70 p-3 last:border-b-0"><div className="flex gap-3"><img className="size-[3.75rem] rounded-xl object-cover" style={{ objectPosition: item.photoPosition }} src={packedBoxPhoto} alt="" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-[1rem] font-extrabold">{item.name}</h3><span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[0.65rem] font-bold text-brand">AI detected</span></div><p className="mt-1 truncate text-sm text-muted">{item.description}</p><p className="mt-1 font-bold">1</p></div><AppIcon name="more" className="mt-1 shrink-0 text-muted" /></div><button className="mt-3 min-h-11 w-full rounded-control bg-ink font-extrabold text-white" type="button">Add to list</button></article>
}

function AiSmartListState({ afterAdd }: { afterAdd: boolean }) {
  const items = afterAdd ? detectedItems.slice(1) : detectedItems
  return <MobileFrame><section className="h-full pt-12"><BrandHeader title="Box details" /><div className="rounded-t-[2rem] border-t border-line bg-canvas pt-5"><div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" /><div className="px-7"><h2 className="text-[1.45rem] font-extrabold">AI smart list</h2><p className="text-lg font-bold text-muted">{items.length} items pending</p></div><div className="mt-4 border-y border-line bg-surface px-5 py-5"><h3 className="text-[1.1rem] font-extrabold">Recognized items</h3><p className="mt-2 text-[0.95rem] leading-6 text-muted">Add correct results to your inventory, or use More to edit them first.</p></div>{afterAdd ? <div className="mx-4 mt-5 rounded-[1.2rem] border border-brand/25 bg-brand/10 px-5 py-4 text-[1rem] font-bold text-ink"><span className="mr-3 inline-block size-3 rounded-full bg-brand" />1 item submitted and being added in the background</div> : null}<section className="mx-4 mt-5 overflow-hidden rounded-[1.3rem] bg-surface shadow-soft">{items.map((item) => <ItemCard item={item} key={item.name} />)}</section></div></section></MobileFrame>
}

function BoxDetailsState() {
  const saved = detectedItems.slice(0, 1)
  return <MobileFrame><section className="h-full pt-12"><BrandHeader title="Box details" /><div className="px-5 pt-7"><p className="font-bold text-brand">Box inventory</p><div className="mt-3 flex items-baseline justify-between"><h2 className="text-[1.45rem] font-extrabold">Items</h2><span className="text-lg font-bold text-muted">1 type</span></div><section className="mt-4 overflow-hidden rounded-[1.5rem] bg-surface shadow-soft">{saved.map((item) => <article className="flex gap-3 p-4" key={item.name}><img className="size-[3.75rem] rounded-xl object-cover" style={{ objectPosition: item.photoPosition }} src={packedBoxPhoto} alt="" /><div className="min-w-0 flex-1"><h3 className="text-[1rem] font-extrabold">{item.name}</h3><p className="mt-1 text-sm text-muted">{item.description}</p><p className="mt-1 font-bold">1 item <span className="ml-2 text-brand">Stored · 1/1</span></p></div><span className="self-center text-2xl text-muted">›</span></article>)}</section></div></section></MobileFrame>
}

function ScannerState() {
  return <MobileFrame><section className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] px-5 pb-5 pt-12"><header className="py-5"><h1 className="text-[2rem] font-extrabold">Scan to view</h1></header><div className="scanner-camera relative overflow-hidden rounded-[1.65rem] bg-ink shadow-float" aria-label="QR scanner view"><img className="absolute inset-0 h-full w-full object-cover" src="/creative/box-1-closed-labeled-user.png" alt="Live scanner view of the labeled Box 1" /><div className="absolute inset-0 bg-black/25" /><div className="scanner-feedback pointer-events-none absolute inset-0" aria-hidden="true"><span className="scanner-vignette absolute inset-0" /><span className="scanner-target absolute top-1/2 left-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2"><span className="scanner-corner scanner-corner-top-left absolute top-0 left-0" /><span className="scanner-corner scanner-corner-top-right absolute top-0 right-0" /><span className="scanner-corner scanner-corner-bottom-left absolute bottom-0 left-0" /><span className="scanner-corner scanner-corner-bottom-right absolute right-0 bottom-0" /><span className="scanner-beam absolute right-[4%] left-[4%] h-px" /><span className="scanner-focus-dot absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" /></span></div></div><p className="px-4 pt-5 text-center text-sm font-semibold leading-6 text-muted">Hold the label inside the frame. Nomo opens the matching box automatically.</p></section></MobileFrame>
}

export function CaptureState({ state }: { state: CaptureStateName }) {
  if (state === 'camera-capture') return <CameraCaptureState />
  if (state === 'photo-confirmation') return <PhotoConfirmationState />
  if (state === 'ai-pending') return <AiSmartListState afterAdd={false} />
  if (state === 'ai-after-add') return <AiSmartListState afterAdd />
  if (state === 'box-details') return <BoxDetailsState />
  return <ScannerState />
}
