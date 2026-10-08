/**
 * Блочный редактор в стиле Notion.
 *
 * Клавиатура: Enter — новый блок, Backspace на пустом — удалить,
 * «/» в начале — меню типов, «# », «## », «- », «[] », «> » — быстрые типы,
 * ↑/↓ на краях — переход между блоками, Cmd/Ctrl+Enter — отметить чек-лист.
 * Сохранение — наружу через onChange (родитель делает debounce + API).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../Icon'

import { newBlock, type Block, type BlockType } from './blocks'

export type { Block, BlockType }

const TYPES: { id: BlockType; label: string; hint: string; icon: string }[] = [
  { id: 'p', label: 'Текст', hint: 'Обычный абзац', icon: 'type' },
  { id: 'h1', label: 'Заголовок 1', hint: 'Крупный раздел', icon: 'type' },
  { id: 'h2', label: 'Заголовок 2', hint: 'Подраздел', icon: 'type' },
  { id: 'h3', label: 'Заголовок 3', hint: 'Мелкий заголовок', icon: 'type' },
  { id: 'bullet', label: 'Список', hint: 'Маркированный', icon: 'list' },
  { id: 'numbered', label: 'Нумерация', hint: 'Нумерованный список', icon: 'list' },
  { id: 'todo', label: 'Чек-лист', hint: 'Пункт с флажком', icon: 'check-circle' },
  { id: 'quote', label: 'Цитата', hint: 'Выделенный текст', icon: 'pen' },
  { id: 'callout', label: 'Выноска', hint: 'Важное примечание', icon: 'alert' },
  { id: 'code', label: 'Код', hint: 'Моноширинный блок', icon: 'file' },
  { id: 'divider', label: 'Разделитель', hint: 'Горизонтальная линия', icon: 'more-h' },
]

const SHORTCUTS: [RegExp, BlockType][] = [
  [/^#\s$/, 'h1'], [/^##\s$/, 'h2'], [/^###\s$/, 'h3'],
  [/^[-*]\s$/, 'bullet'], [/^1[.)]\s$/, 'numbered'], [/^\[\]\s$/, 'todo'], [/^>\s$/, 'quote'],
]

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  p: 'Напишите что-нибудь или введите «/» для выбора блока',
  h1: 'Заголовок', h2: 'Заголовок', h3: 'Заголовок', bullet: 'Пункт', numbered: 'Пункт',
  todo: 'Что нужно сделать', quote: 'Цитата', callout: 'Важно', code: 'Код',
}

export default function BlockEditor({
  value, onChange, readOnly = false, autoFocus = false,
}: {
  value: Block[]
  onChange: (blocks: Block[]) => void
  readOnly?: boolean
  autoFocus?: boolean
}) {
  const blocks = value.length ? value : [newBlock()]
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const [menu, setMenu] = useState<{ id: string; query: string; index: number } | null>(null)
  const pendingFocus = useRef<{ id: string; pos?: 'end' | 'start' } | null>(null)

  const focus = useCallback((id: string, pos: 'end' | 'start' = 'end') => {
    pendingFocus.current = { id, pos }
  }, [])

  useEffect(() => {
    const p = pendingFocus.current
    if (!p) return
    const el = refs.current[p.id]
    if (el) {
      el.focus()
      const at = p.pos === 'start' ? 0 : el.value.length
      el.setSelectionRange(at, at)
      pendingFocus.current = null
    }
  })

  useEffect(() => {
    if (autoFocus && blocks[0]) focus(blocks[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = (id: string, patch: Partial<Block>) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  const insertAfter = (id: string, block: Block) => {
    const i = blocks.findIndex((b) => b.id === id)
    onChange([...blocks.slice(0, i + 1), block, ...blocks.slice(i + 1)])
    focus(block.id, 'start')
  }

  const remove = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id)
    if (blocks.length === 1) {
      onChange([newBlock()])
      return
    }
    const next = blocks.filter((b) => b.id !== id)
    onChange(next)
    const target = next[Math.max(0, i - 1)]
    if (target) focus(target.id, 'end')
  }

  const setType = (id: string, type: BlockType) => {
    const b = blocks.find((x) => x.id === id)
    if (!b) return
    update(id, { type, text: menu?.id === id ? '' : b.text, checked: type === 'todo' ? false : undefined })
    setMenu(null)
    focus(id)
  }

  const onInput = (b: Block, text: string) => {
    // «/» в пустом блоке — меню типов; текст после «/» фильтрует список
    if (text.startsWith('/') && !text.includes('\n')) {
      setMenu({ id: b.id, query: text.slice(1).toLowerCase(), index: 0 })
    } else if (menu?.id === b.id) {
      setMenu(null)
    }
    for (const [re, type] of SHORTCUTS) {
      if (b.type === 'p' && re.test(text)) {
        update(b.id, { type, text: '', checked: type === 'todo' ? false : undefined })
        return
      }
    }
    if (b.type === 'p' && text === '---') {
      update(b.id, { type: 'divider', text: '' })
      insertAfter(b.id, newBlock())
      return
    }
    update(b.id, { text })
  }

  const menuItems = menu ? TYPES.filter((t) => !menu.query || t.label.toLowerCase().includes(menu.query) || t.id.includes(menu.query)) : []

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, b: Block) => {
    const el = e.currentTarget
    if (menu?.id === b.id && menuItems.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenu({ ...menu, index: (menu.index + 1) % menuItems.length }); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenu({ ...menu, index: (menu.index - 1 + menuItems.length) % menuItems.length }); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); setType(b.id, menuItems[menu.index].id); return }
      if (e.key === 'Escape') { e.preventDefault(); setMenu(null); update(b.id, { text: '' }); return }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && b.type === 'todo') {
      e.preventDefault()
      update(b.id, { checked: !b.checked })
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && b.type !== 'code') {
      e.preventDefault()
      const before = el.value.slice(0, el.selectionStart)
      const after = el.value.slice(el.selectionEnd)
      // Enter на пустом элементе списка — выход в обычный текст
      if (!el.value && ['bullet', 'numbered', 'todo', 'quote'].includes(b.type)) {
        update(b.id, { type: 'p', checked: undefined })
        return
      }
      const keep = ['bullet', 'numbered', 'todo'].includes(b.type) ? b.type : 'p'
      update(b.id, { text: before })
      const nb = newBlock(keep, after)
      const i = blocks.findIndex((x) => x.id === b.id)
      onChange([...blocks.slice(0, i).map((x) => x), { ...b, text: before }, nb, ...blocks.slice(i + 1)])
      focus(nb.id, 'start')
      return
    }
    if (e.key === 'Backspace' && !el.value) {
      e.preventDefault()
      if (b.type !== 'p') update(b.id, { type: 'p', checked: undefined })
      else remove(b.id)
      return
    }
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      // слить с предыдущим блоком
      const i = blocks.findIndex((x) => x.id === b.id)
      const prev = blocks[i - 1]
      if (prev && prev.type !== 'divider') {
        e.preventDefault()
        const merged = { ...prev, text: prev.text + el.value }
        onChange([...blocks.slice(0, i - 1), merged, ...blocks.slice(i + 1)])
        pendingFocus.current = { id: prev.id, pos: 'end' }
        requestAnimationFrame(() => {
          const pe = refs.current[prev.id]
          if (pe) { pe.focus(); pe.setSelectionRange(prev.text.length, prev.text.length) }
        })
      }
      return
    }
    if (e.key === 'ArrowUp' && el.selectionStart === 0) {
      const i = blocks.findIndex((x) => x.id === b.id)
      const prev = blocks[i - 1]
      if (prev) { e.preventDefault(); focus(prev.id, 'end'); onChange([...blocks]) }
    }
    if (e.key === 'ArrowDown' && el.selectionStart === el.value.length) {
      const i = blocks.findIndex((x) => x.id === b.id)
      const next = blocks[i + 1]
      if (next) { e.preventDefault(); focus(next.id, 'start'); onChange([...blocks]) }
    }
  }

  // номера для нумерованных списков считаем заранее — рендер без мутаций
  const numbers = blocks.reduce<number[]>((acc, b, i) => {
    acc.push(b.type === 'numbered' ? (acc[i - 1] ?? 0) + 1 : 0)
    return acc
  }, [])
  return (
    <div className={`blocks ${readOnly ? 'blocks--ro' : ''}`}>
      {blocks.map((b, bi) => {
        const numbered = numbers[bi]
        if (b.type === 'divider') {
          return (
            <div key={b.id} className="block block--divider" onClick={() => !readOnly && insertAfter(b.id, newBlock())}>
              <hr />
              {!readOnly && <button className="block__x" onClick={(e) => { e.stopPropagation(); remove(b.id) }} aria-label="Удалить"><Icon name="x" size={12} /></button>}
            </div>
          )
        }
        return (
          <div key={b.id} className={`block block--${b.type} ${b.checked ? 'is-checked' : ''}`}>
            {b.type === 'bullet' && <span className="block__marker">•</span>}
            {b.type === 'numbered' && <span className="block__marker">{numbered}.</span>}
            {b.type === 'todo' && (
              <button type="button" className="block__check" disabled={readOnly} onClick={() => update(b.id, { checked: !b.checked })} aria-label="Отметить">
                {b.checked && <Icon name="check" size={12} />}
              </button>
            )}
            {b.type === 'callout' && <span className="block__marker"><Icon name="alert" size={15} /></span>}
            <textarea
              ref={(el) => { refs.current[b.id] = el }}
              className="block__input"
              value={b.text}
              rows={1}
              readOnly={readOnly}
              placeholder={readOnly ? '' : PLACEHOLDER[b.type]}
              onChange={(e) => onInput(b, e.target.value)}
              onKeyDown={(e) => onKey(e, b)}
              onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
              onFocus={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
            />
            {menu?.id === b.id && menuItems.length > 0 && (
              <div className="block-menu" role="listbox">
                {menuItems.map((t, i) => (
                  <button
                    type="button"
                    key={t.id}
                    className={`block-menu__item ${i === menu.index ? 'is-active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); setType(b.id, t.id) }}
                    role="option"
                    aria-selected={i === menu.index}
                  >
                    <Icon name={t.icon} size={15} />
                    <span>{t.label}</span>
                    <small>{t.hint}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {!readOnly && (
        <button type="button" className="blocks__add" onClick={() => insertAfter(blocks[blocks.length - 1].id, newBlock())}>
          <Icon name="plus" size={14} /> Добавить блок
        </button>
      )}
    </div>
  )
}
