import { createContext, useContext } from 'react'
import type { MobileSheetAction } from './MobileActionSheet'

export type MobileAlertCloseReason = 'primary' | 'cancel' | 'escape'

export type MobileAlertOptions = {
  key?: string
  owner?: string
  title: string
  message?: string
  primaryLabel?: string
  onPrimary?: () => void | Promise<void>
  cancelLabel?: string
  onCancel?: () => void | Promise<void>
  onDismiss?: (reason?: MobileAlertCloseReason) => void
  onActionError?: (error: unknown) => void
  primaryDisabled?: boolean
  primaryBusy?: boolean
}

export type FeedbackErrorOptions = {
  key: string
  owner?: string
  title: string
  message?: string
  retry?: () => void | Promise<void>
  retryLabel?: string
  retrying?: boolean
  onDismiss?: (reason?: MobileAlertCloseReason) => void
  onActionError?: (error: unknown) => void
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
  error: (options: FeedbackErrorOptions) => void
  confirm: (options: MobileAlertOptions) => void
  dismiss: (owner?: string) => void
}

const noop = () => undefined
export const MobileFeedbackContext = createContext<MobileFeedbackApi>({
  notify: noop,
  showAlert: noop,
  showActionSheet: noop,
  error: noop,
  confirm: noop,
  dismiss: noop,
})

export function useMobileFeedback() {
  return useContext(MobileFeedbackContext)
}
