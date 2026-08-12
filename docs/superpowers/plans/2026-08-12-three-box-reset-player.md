# Three-Box Reset Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the campaign demo's browser-native controls with an accessible, Nomo-styled video player.

**Architecture:** Add a focused `CampaignVideoPlayer` component beside the marketing page. It wraps a native HTML video element and synchronizes UI state from media events; the campaign page retains loading-error fallback responsibility.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library.

---

### Task 1: Add player behavior tests

**Files:**

- Create: `apps/web/src/features/marketing/CampaignVideoPlayer.test.tsx`
- Modify: `apps/web/src/features/marketing/ThreeBoxResetPage.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
it('uses branded controls instead of browser controls', () => {
  render(<CampaignVideoPlayer src="/demo.mp4" poster="/poster.jpg" onError={() => {}} />)
  expect(screen.getByRole('button', { name: 'Play video' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Mute video' })).toBeVisible()
  expect(screen.getByRole('slider', { name: 'Video progress' })).toBeVisible()
  expect(document.querySelector('video')).not.toHaveAttribute('controls')
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test --workspace=@nomo/web -- --run src/features/marketing/CampaignVideoPlayer.test.tsx`

Expected: FAIL because `CampaignVideoPlayer` does not exist.

- [ ] **Step 3: Add interaction test expectations**

```tsx
it('plays, seeks, and mutes through the custom controls', async () => {
  const user = userEvent.setup()
  render(<CampaignVideoPlayer src="/demo.mp4" poster="/poster.jpg" onError={() => {}} />)
  const video = document.querySelector('video') as HTMLVideoElement
  await user.click(screen.getByRole('button', { name: 'Play video' }))
  expect(video.play).toHaveBeenCalled()
  fireEvent.change(screen.getByRole('slider', { name: 'Video progress' }), { target: { value: '12' } })
  expect(video.currentTime).toBe(12)
  await user.click(screen.getByRole('button', { name: 'Mute video' }))
  expect(video.muted).toBe(true)
})
```

- [ ] **Step 4: Commit the RED tests**

```bash
git add apps/web/src/features/marketing/CampaignVideoPlayer.test.tsx
git commit -m "test: define campaign player behavior"
```

### Task 2: Implement the lightweight campaign player

**Files:**

- Create: `apps/web/src/features/marketing/CampaignVideoPlayer.tsx`
- Test: `apps/web/src/features/marketing/CampaignVideoPlayer.test.tsx`

- [ ] **Step 1: Implement the typed component contract**

```tsx
type CampaignVideoPlayerProps = {
  src: string
  poster: string
  onError: () => void
}
```

- [ ] **Step 2: Implement playback and progress synchronization**

```tsx
<video ref={videoRef} className="h-full w-full object-cover" playsInline preload="metadata" poster={poster}
  onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onError={onError}>
  <source src={src} type="video/mp4" />
</video>
```

- [ ] **Step 3: Implement the Nomo control overlay**

```tsx
<button aria-label={isPlaying ? 'Pause video' : 'Play video'} onClick={togglePlayback} />
<input aria-label="Video progress" type="range" min="0" max={duration || 0} value={currentTime} onChange={seek} />
<button aria-label={isMuted ? 'Unmute video' : 'Mute video'} onClick={toggleMute} />
```

Use cream, deep-brown, and orange Tailwind classes, with the lower strip visible during hover, focus, or pause and `focus-visible` outlines.

- [ ] **Step 4: Run focused player tests and verify GREEN**

Run: `npm test --workspace=@nomo/web -- --run src/features/marketing/CampaignVideoPlayer.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the component**

```bash
git add apps/web/src/features/marketing/CampaignVideoPlayer.tsx apps/web/src/features/marketing/CampaignVideoPlayer.test.tsx
git commit -m "feat: add branded campaign video player"
```

### Task 3: Integrate and verify the landing page

**Files:**

- Modify: `apps/web/src/features/marketing/ThreeBoxResetPage.tsx`
- Modify: `apps/web/src/features/marketing/ThreeBoxResetPage.test.tsx`

- [ ] **Step 1: Write the failing integration assertion**

```tsx
expect(within(demo).getByRole('button', { name: 'Play video' })).toBeVisible()
expect(demo.querySelector('video')).not.toHaveAttribute('controls')
```

- [ ] **Step 2: Run the page test and verify RED**

Run: `npm test --workspace=@nomo/web -- --run src/features/marketing/ThreeBoxResetPage.test.tsx`

Expected: FAIL because the page still renders `video controls`.

- [ ] **Step 3: Replace the direct video element with the component**

```tsx
<CampaignVideoPlayer src="/marketing/three-box-reset-demo.mp4" poster="/landing/hero-home-v2.jpg" onError={() => setVideoUnavailable(true)} />
```

- [ ] **Step 4: Run focused integration and player tests**

Run: `npm test --workspace=@nomo/web -- --run src/features/marketing/CampaignVideoPlayer.test.tsx src/features/marketing/ThreeBoxResetPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run full verification and commit**

Run: `npm test --workspace=@nomo/web && npm run typecheck --workspace=@nomo/web && npm run lint --workspace=@nomo/web && git diff --check`

Expected: all commands exit 0.

```bash
git add apps/web/src/features/marketing/ThreeBoxResetPage.tsx apps/web/src/features/marketing/ThreeBoxResetPage.test.tsx
git commit -m "feat: style three-box campaign player"
```
