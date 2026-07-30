const tones = [
  'bg-[#ead7c2] text-[#8b684d]',
  'bg-[#dce4e5] text-[#65747c]',
  'bg-[#eadbbd] text-[#8d6c3e]',
  'bg-[#dce5d8] text-[#657760]',
] as const

export function spaceEmoji(name: string) {
  if (/客厅|起居/.test(name)) return '🛋️'
  if (/卧室|主卧|次卧/.test(name)) return '🛏️'
  if (/书房|办公室|工作/.test(name)) return '👩‍💻'
  if (/储藏|仓库/.test(name)) return '🚪'
  if (/厨房/.test(name)) return '🍳'
  if (/浴室|卫生间/.test(name)) return '🛁'
  if (/儿童|玩具/.test(name)) return '🧸'
  return '🏠'
}

export function spaceTone(index: number) {
  return tones[index % tones.length]
}
