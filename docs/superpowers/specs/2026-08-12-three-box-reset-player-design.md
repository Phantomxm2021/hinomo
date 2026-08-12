# Three-Box Reset Player Design

## Goal

Replace the browser-native video controls in the Three-Box Reset campaign demo with a compact Nomo-styled player that keeps the video readable and accessible.

## Scope

- Keep the existing MP4 source, poster, 16:9 container, and `object-cover` crop behavior.
- Use a central orange circular play button while paused.
- Before playback, show only the central play button. During playback, replace it with a restrained bottom control strip: pause, elapsed and total time, scrubber, and mute toggle. Clicking the video itself also pauses playback.
- Use the page palette: cream controls, deep-brown translucent control surface, and Nomo orange for the active progress indicator.
- Support click-to-toggle playback and keyboard Space/Enter on the video region.
- Expose labelled buttons, keyboard-focus indicators, and a native range input for accessible seeking.

## Non-goals

- No browser-native `controls` attribute.
- No new dependencies.
- No fullscreen, playback-speed selector, picture-in-picture, captions, or volume slider.
- No changes to the media asset or campaign copy.

## Component design

Create a page-local `CampaignVideoPlayer` component in the marketing feature. It owns the `HTMLVideoElement` reference and local state for `isPlaying`, `currentTime`, `duration`, `isMuted`, and whether controls should be visible.

The video is rendered in the existing rounded 16:9 shell. A large overlay button starts playback. Once playback starts, that button is removed and the bottom control strip appears; clicking the video or its pause control pauses. The strip uses a gradient at the bottom to preserve contrast without an opaque black bar. Playback events update state; the range input seeks by setting `video.currentTime`; mute toggles `video.muted`.

The existing error handler remains at the page boundary: if the video cannot load, the campaign fallback image and message replace the player.

## Verification

- Component tests assert the native controls are absent, the accessible play and mute actions are present, play toggles state, seeking writes the media time, and mute toggles the media muted property.
- Run the focused tests, the full web test suite, web typecheck, and lint after integration.
