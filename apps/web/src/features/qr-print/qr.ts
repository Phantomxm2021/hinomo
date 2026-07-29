import QRCode from 'qrcode'

export const boxQrUrl = (origin: string, publicId: string) =>
  `${origin.replace(/\/+$/, '')}/b/${publicId}`

export const boxQrPng = (url: string) =>
  QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 1024,
  })
