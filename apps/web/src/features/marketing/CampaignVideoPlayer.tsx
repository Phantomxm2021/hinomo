import { useRef, useState, type KeyboardEvent } from 'react'

type CampaignVideoPlayerProps = {
  src: string
  poster: string
  onError: () => void
}

function formatTime(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds))
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

function PlayIcon({ paused }: { paused: boolean }) {
  return paused
    ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return muted
    ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10v4h4l5 4V6L8 10H4ZM17 10l4 4m0-4-4 4" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10v4h4l5 4V6L8 10H4ZM17 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" /></svg>
}

export function CampaignVideoPlayer({ src, poster, onError }: CampaignVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)

  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) await video.play()
    else video.pause()
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const seek = (value: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = value
    setCurrentTime(value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.key !== ' ' && event.key !== 'Enter')) return
    event.preventDefault()
    void togglePlayback()
  }

  const maximum = Number.isFinite(duration) && duration > 0 ? duration : 100

  return (
    <div className="group relative h-full w-full" tabIndex={0} onKeyDown={handleKeyDown} aria-label="Campaign video">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        preload="metadata"
        poster={poster}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
        onError={onError}
        onClick={() => void togglePlayback()}
      >
        <source src={src} type="video/mp4" />
      </video>

      {!isPlaying && (
        <button
          type="button"
          data-testid="campaign-video-primary-control"
          className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-brand-strong text-white shadow-float transition hover:scale-105 hover:bg-[#b64322] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white sm:size-18"
          aria-label="Play video"
          onClick={() => void togglePlayback()}
        >
          <PlayIcon paused />
        </button>
      )}

      {isPlaying && (
        <div data-testid="campaign-video-controls" className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-[#30271e]/95 via-[#30271e]/65 to-transparent px-5 pt-12 pb-4 text-sm font-semibold text-white transition sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100">
          <button type="button" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label="Pause video" onClick={() => videoRef.current?.pause()}>
            <PlayIcon paused={false} />
          </button>
          <span className="tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <input
            aria-label="Video progress"
            className="h-2 min-w-0 flex-1 cursor-pointer accent-brand-strong"
            type="range"
            min="0"
            max={maximum}
            step="0.1"
            value={Math.min(currentTime, maximum)}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <button type="button" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={isMuted ? 'Unmute video' : 'Mute video'} onClick={toggleMute}>
            <VolumeIcon muted={isMuted} />
          </button>
        </div>
      )}
    </div>
  )
}
