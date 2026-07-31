import { createContext, useContext } from 'react'
import type { MobileSheetAction } from './MobileActionSheet'

export type MobileAlertOptions = {
  title: string
  message?: string
  primaryLabel?: string
  onPrimary?: () => void
  cancelLabel?: string
}

export type MobileSheetOptions = {
  title: string
  message?: string
  actions: MobileSheetAction[]
  cancelLabel?: string
}

export type MobileFeedbackApi = {
  notify: (message: string) => void
  showAlert: (options: MobileAlertOptions) => void
  showActionSheet: (options: MobileSheetOptions) => void
  dismiss: () => void
}

const noop = () => undefined
export const MobileFeedbackContext = createContext<MobileFeedbackApi>({
  notify: noop,
  showAlert: noop,
  showActionSheet: noop,
  dismiss: noop,
})

export function useMobileFeedback() {
  return useContext(MobileFeedbackContext)
}
