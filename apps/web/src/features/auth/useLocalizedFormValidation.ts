import { useEffect, useRef } from 'react'

type FieldName = string

export function useLocalizedFormValidation<TFieldName extends FieldName>({
  locale,
  trigger,
  touchedFields,
  errorFields,
  submitAttempted,
}: {
  locale: string
  trigger: (names?: TFieldName | TFieldName[]) => Promise<boolean>
  touchedFields: Partial<Record<TFieldName, unknown>>
  errorFields: Partial<Record<TFieldName, unknown>>
  submitAttempted: boolean
}) {
  const previousLocale = useRef(locale)

  useEffect(() => {
    if (previousLocale.current === locale) return
    previousLocale.current = locale

    const fieldNames = new Set<TFieldName>(Object.keys(touchedFields) as TFieldName[])
    if (submitAttempted) {
      for (const fieldName of Object.keys(errorFields) as TFieldName[]) fieldNames.add(fieldName)
    }
    if (fieldNames.size > 0) void trigger([...fieldNames])
  }, [errorFields, locale, submitAttempted, touchedFields, trigger])
}
