/**
 * Быстрый поиск Cmd+K / Ctrl+K: задачи, клиенты, сделки, документы, заявки
 * + переходы по разделам. Результаты — с учётом прав роли (решает сервер).
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'
import { useNav, type EntityType, type Section } from './nav'

type Result = { type: EntityType; id: string; title: string; subtitle: string }
const TYPE_LABEL: Record<string, string> = { task: 'Задачи', client: 'Клиенты', deal: 'Сделки', document: 'Документы', submission: 'Заявки', section: 'Разделы' }
const TYPE_ICON: Record<string, string> = { task: 'board', client: 'user', deal: 'briefcase', document: 'book', submission: 'inbox', section: 'layers' }

export default function CommandPalette({ open, onClose, sections }: { open: boolean; onClose: () => void; sections: { id: Section; label: string }[] }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const nav = useNav()
  const reduce = useReducedMotion()

  useEffect(() => { if (open) { setQ(''); setResults([]); setIndex(0); setTimeout(() => input.current?.focus(), 30) } }, [open])

  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults([]); return }
    let alive = true
    setBusy(true)
    const t = setTimeout(async () => {
      const r = await adminApi('GET', `/api/crm/search?q=${encodeURIComponent(q.trim())}`)
      if (alive) { setResults(r.ok ? r.json.results : []); setBusy(false); setIndex(0) }
    }, 180)
    return () => { alive = false; clearTimeout(t) }
  }, [q, open])

  const sectionHits: Result[] = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return sections.filter((s) => !needle || s.label.toLowerCase().includes(needle)).slice(0, needle ? 4 : 8)
      .map((s) => ({ type: 'section', id: s.id, title: s.label, subtitle: 'Перейти в раздел' }))
  }, [q, sections])

  const all = useMemo(() => [...results, ...sectionHits], [results, sectionHits])
  const grouped = useMemo(() => {
    const g: Record<string, Result[]> = {}
    for (const r of all) (g[r.type] ??= []).push(r)
    return g
  }, [all])

  function pick(r: Result) { onClose(); nav(r.type, r.id) }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(all.length - 1, i + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)) }
    if (e.key === 'Enter' && all[index]) { e.preventDefault(); pick(all[index]) }
    if (e.key === 'Escape') onClose()
  }

  // плоский индекс каждого результата — для подсветки и клавиатуры
  const flatIndex = new Map(all.map((r, i) => [r, i]))
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="palette" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.15 }}>
          <motion.div className="palette__box" onClick={(e) => e.stopPropagation()} initial={reduce ? false : { opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} role="dialog" aria-label="Поиск">
            <div className="palette__input">
              <Icon name="search" size={18} />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Найти задачу, клиента, сделку, документ…" />
              <kbd>esc</kbd>
            </div>
            <div className="palette__list">
              {q.trim().length >= 2 && !busy && results.length === 0 && sectionHits.length === 0 && <div className="palette__empty">Ничего не найдено по запросу «{q}»</div>}
              {Object.entries(grouped).map(([type, list]) => (
                <div key={type}>
                  <div className="palette__group">{TYPE_LABEL[type] ?? type}</div>
                  {list.map((r) => {
                    const i = flatIndex.get(r) ?? 0
                    return (
                      <button key={`${r.type}-${r.id}-${i}`} className={`palette__item ${i === index ? 'is-active' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => pick(r)}>
                        <span className="palette__icon"><Icon name={TYPE_ICON[r.type] ?? 'file'} size={15} /></span>
                        <span style={{ minWidth: 0 }}><strong>{r.title}</strong><small>{r.subtitle}</small></span>
                        {i === index && <Icon name="arrow-right" size={14} />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="palette__foot"><span><kbd>↑↓</kbd>выбор</span><span><kbd>↵</kbd>открыть</span><span><kbd>esc</kbd>закрыть</span></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
