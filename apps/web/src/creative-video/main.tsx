import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { CaptureState, type CaptureStateName } from './CaptureStates'

const requestedState = new URLSearchParams(window.location.search).get('state')
const captureStates = new Set<CaptureStateName>(['camera-capture', 'photo-confirmation', 'ai-pending', 'ai-after-add', 'box-details', 'scanner'])
const state: CaptureStateName = requestedState && captureStates.has(requestedState as CaptureStateName)
  ? requestedState as CaptureStateName
  : 'camera-capture'

window.localStorage.setItem('nomo-locale', 'en-US')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptureState state={state} />
  </StrictMode>,
)
