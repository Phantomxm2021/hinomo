import { describe, expect, it } from 'vitest'
import { formatStoragePath } from './format-storage-path'

describe('formatStoragePath', () => {
  it('joins non-empty venue, space, and location without stray separators', () => {
    expect(formatStoragePath(['公司', '会议室', '文件柜'])).toBe('公司 · 会议室 · 文件柜')
    expect(formatStoragePath(['家里', '卧室', null])).toBe('家里 · 卧室')
    expect(formatStoragePath(['', ' 书房 ', undefined])).toBe('书房')
  })
})
