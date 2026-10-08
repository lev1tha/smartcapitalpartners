/**
 * База знаний: страницы в стиле Notion с вложенностью и привязкой к клиенту/сделке.
 * Автосохранение с задержкой 700 мс после последнего изменения.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'
import BlockEditor from './BlockEditor'
import { newBlock, type Block } from './blocks'
import { SaveState } from './CrmDeals'
import { useNav } from './nav'
import { fmtDate } from './format'
import { Empty } from './ui'

type DocBrief = { id: string; title: string; parentId: string; clientId: string; dealId: string; updatedAt: string; updatedBy: string }
type Doc = DocBrief & { content: Block[]; clientName: string; dealTitle: string; children: DocBrief[] }

export default function CrmDocs({ openId }: { openId?: string | null }) {
  const [docs, setDocs] = useState<DocBrief[]>([])
  const [current, setCurrent] = useState<Doc | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [err, setErr] = useState('')
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nav = useNav()

  const loadList = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/docs')
    if (r.ok) setDocs(r.json.documents ?? [])
  }, [])
  useEffect(() => { loadList(); adminApi('GET', '/api/crm/clients').then((r) => r.ok && setClients(r.json.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))) }, [loadList])

  const openDoc = useCallback(async (id: string) => {
    const r = await adminApi('GET', `/api/crm/docs/${id}`)
    if (r.ok) { setCurrent(r.json.document); setErr(''); setSaveState('idle') } else setErr(r.json?.error ?? 'Документ не найден')
  }, [])
  useEffect(() => { if (openId) openDoc(openId) }, [openId, openDoc])

  const save = useCallback(async (item: Record<string, unknown>) => {
    if (!current) return
    setSaveState('saving')
    const r = await adminApi('POST', '/api/crm/docs/save', { item: { id: current.id, ...item } })
    if (r.ok) { setSaveState('saved'); loadList() } else { setErr(r.json?.error ?? 'Не сохранилось'); setSaveState('idle') }
  }, [current, loadList])

  const debounced = (item: Record<string, unknown>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(item), 700)
  }

  async function create(parentId = '') {
    const r = await adminApi('POST', '/api/crm/docs/save', { item: { title: '', content: [newBlock()], parentId } })
    if (r.ok) { await loadList(); openDoc(r.json.document.id) } else setErr(r.json?.error ?? 'Ошибка')
  }

  async function remove() {
    if (!current || !confirm(`Удалить «${current.title}»? Вложенные страницы тоже удалятся.`)) return
    const r = await adminApi('POST', '/api/crm/docs/delete', { id: current.id })
    if (r.ok) { setCurrent(null); loadList() } else setErr(r.json?.error ?? 'Ошибка')
  }

  const roots = docs.filter((d) => !d.parentId || !docs.some((x) => x.id === d.parentId))
  const childrenOf = (id: string) => docs.filter((d) => d.parentId === id)

  return (
    <div className="docs">
      <aside className="docs__side">
        <button className="admin-btn admin-btn--mint" onClick={() => create()}><Icon name="plus" size={14} /> Новая страница</button>
        {docs.length === 0 ? <p className="hint" style={{ marginTop: 8 }}>Регламенты, скрипты продаж, базы по клиентам — всё хранится здесь.</p> : (
          <div className="docs__tree" style={{ marginTop: 6 }}>
            {roots.map((d) => (
              <div key={d.id}>
                <button className={`doc-link ${current?.id === d.id ? 'is-active' : ''}`} onClick={() => openDoc(d.id)}><Icon name="file" size={15} /><span>{d.title || 'Без названия'}</span></button>
                {childrenOf(d.id).map((c) => (
                  <button key={c.id} className={`doc-link doc-link--child ${current?.id === c.id ? 'is-active' : ''}`} onClick={() => openDoc(c.id)}><Icon name="chevron-right" size={12} /><span>{c.title || 'Без названия'}</span></button>
                ))}
              </div>
            ))}
          </div>
        )}
      </aside>

      <section className="docs__editor">
        {err && <p className="admin-note admin-note--err">{err}</p>}
        {!current ? (
          <Empty icon="book" title="Выберите страницу или создайте новую" hint="Блоки как в Notion: заголовки, чек-листы, цитаты. Введите «/» в пустой строке, чтобы выбрать тип." />
        ) : (
          <>
            <input className="drawer__title-input" placeholder="Без названия" value={current.title} autoFocus={!current.title}
              onChange={(e) => { setCurrent({ ...current, title: e.target.value }); debounced({ title: e.target.value }) }} />
            <div className="docs__meta">
              <span>{current.updatedBy ? `${current.updatedBy} · ` : ''}{fmtDate(current.updatedAt, true)}</span>
              <SaveState state={saveState} />
              <span style={{ flex: 1 }} />
              <label className="hint">Клиент:&nbsp;
                <select className="admin-input" value={current.clientId} onChange={(e) => { setCurrent({ ...current, clientId: e.target.value }); save({ clientId: e.target.value }) }}>
                  <option value="">—</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              {current.clientId && <button className="prop-link" onClick={() => nav('client', current.clientId)}>открыть <Icon name="arrow-right" size={11} /></button>}
              {current.dealId && <button className="prop-link" onClick={() => nav('deal', current.dealId)}><Icon name="briefcase" size={12} /> {current.dealTitle}</button>}
              <button className="admin-btn admin-btn--ghost" style={{ height: 30, fontSize: 12 }} onClick={() => create(current.id)}><Icon name="plus" size={12} /> Подстраница</button>
              <button className="icon-btn" style={{ width: 30, height: 30 }} title="Удалить" onClick={remove}><Icon name="trash" size={13} /></button>
            </div>
            <BlockEditor key={current.id} value={current.content} onChange={(blocks) => { setCurrent({ ...current, content: blocks }); debounced({ content: blocks }) }} />
            {current.children.length > 0 && (
              <div className="drawer__section">
                <h3>Вложенные страницы</h3>
                <div className="row-list">
                  {current.children.map((c) => (
                    <button key={c.id} className="row-item" onClick={() => openDoc(c.id)}><Icon name="file" size={15} /><span className="row-item__main"><span className="row-item__title">{c.title || 'Без названия'}</span><span className="row-item__sub">{fmtDate(c.updatedAt, true)}</span></span></button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
