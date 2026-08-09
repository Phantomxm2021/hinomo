import { AppleAlert, type AppleAlertProps } from './AppleAlert'

export type MobileAlertProps = AppleAlertProps

export function MobileAlert(props: MobileAlertProps) {
  return <AppleAlert {...props} />
}
