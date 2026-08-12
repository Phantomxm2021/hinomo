import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { CampaignVideoPlayer } from './CampaignVideoPlayer'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('uses branded controls instead of browser controls', () => {
  render(<CampaignVideoPlayer src="/demo.mp4" poster="/poster.jpg" onError={() => {}} />)

  expect(screen.getByTestId('campaign-video-primary-control')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Resume video' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mute video' })).not.toBeInTheDocument()
  expect(screen.queryByRole('slider', { name: 'Video progress' })).not.toBeInTheDocument()
  expect(document.querySelector('video')).not.toHaveAttribute('controls')
})

it('plays, seeks, and mutes through the custom controls', async () => {
  const user = userEvent.setup()
  render(<CampaignVideoPlayer src="/demo.mp4" poster="/poster.jpg" onError={() => {}} />)
  const video = document.querySelector('video') as HTMLVideoElement
  const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)

  await user.click(screen.getByTestId('campaign-video-primary-control'))
  expect(play).toHaveBeenCalled()

  fireEvent.play(video)
  fireEvent.change(screen.getByRole('slider', { name: 'Video progress' }), { target: { value: '12' } })
  expect(video.currentTime).toBe(12)

  await user.click(screen.getByRole('button', { name: 'Mute video' }))
  expect(video.muted).toBe(true)
})

it('hides the central play button after playback starts', () => {
  render(<CampaignVideoPlayer src="/demo.mp4" poster="/poster.jpg" onError={() => {}} />)
  const video = document.querySelector('video') as HTMLVideoElement

  fireEvent.play(video)

  expect(screen.queryByTestId('campaign-video-primary-control')).not.toBeInTheDocument()
})

it('reveals playback controls on hover while active and pauses when the video is clicked', () => {
  render(<CampaignVideoPlayer src="/demo.mp4" poster="/poster.jpg" onError={() => {}} />)
  const video = document.querySelector('video') as HTMLVideoElement
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {})

  fireEvent.play(video)

  const controls = screen.getByTestId('campaign-video-controls')
  expect(controls).toHaveClass('sm:opacity-0', 'sm:group-hover:opacity-100')
  expect(screen.getByRole('button', { name: 'Pause video' })).toBeVisible()

  fireEvent.click(video)
  expect(pause).toHaveBeenCalled()

  fireEvent.pause(video)
  expect(screen.getByTestId('campaign-video-primary-control')).toBeVisible()
  expect(screen.queryByRole('slider', { name: 'Video progress' })).not.toBeInTheDocument()
})
