import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { CaptureState, type CaptureStateName } from './CaptureStates'

const requestedState = new URLSearchParams(window.location.search).get('state')
const captureStates = new Set<CaptureStateName>(['capture', 'ai-before', 'ai-after', 'inventory', 'scanner'])
const state: CaptureStateName = requestedState && captureStates.has(requestedState as CaptureStateName)
  ? requestedState as CaptureStateName
  : 'capture'

window.localStorage.setItem('nomo-locale', 'en-US')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptureState state={state} />
  </StrictMode>,
)
