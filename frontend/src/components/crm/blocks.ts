/** Тип блока документа и хелперы без React. */

export type Block = { id: string; type: BlockType; text: string; checked?: boolean }
export type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'todo' | 'quote' | 'callout' | 'code' | 'divider'

export const newBlock = (type: BlockType = 'p', text = ''): Block => ({
  id: 'b' + Math.random().toString(36).slice(2, 10), type, text,
  ...(type === 'todo' ? { checked: false } : {}),
})

/** Плоский текст для превью карточек. */
export const blocksPreview = (blocks?: Block[] | null, max = 120) => {
  const text = (blocks ?? []).map((b) => b.text).filter(Boolean).join(' · ')
  return text.length > max ? text.slice(0, max) + '…' : text
}
