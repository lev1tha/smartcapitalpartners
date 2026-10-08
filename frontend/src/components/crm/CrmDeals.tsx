/**
 * Smart Capital Pipeline: доска сделок (drag-and-drop по этапам), карточка сделки
 * с финансами, платежами/P&L, заметками (блочный редактор), задачами и документами.
 * Поля amount/commission приходят null, если роль их не видит.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'
import BlockEditor from './BlockEditor'
import type { Block } from './blocks'
import { useNav } from './nav'
import { TASK_STATUS_CLASS, TASK_STATUS_LABEL, dueLabel, fmtDate, formatMoney } from './format'
import { Avatar, Drawer, DrawerHead, Money } from './ui'

export type Deal = {
  id: string; title: string; clientId: string; clientName: string; pipeline: string; stage: string; position: number
  owner: { id: string; name: string; role: string } | null; currency: string
  amount: number | null; commission: number | null; probability: number | null
  expectedClose: string; closedAt: string; customFields: Record<string, unknown>; createdAt: string; updatedAt: string
  hidden: string[]; editable: Record<string, boolean>
  notes?: Block[]; payments?: Payment[]; pnl?: Pnl
  tasks?: { id: string; title: string; status: string; dueDate: string; priority: string }[]
  documents?: { id: string; title: string; updatedAt: string }[]
  paymentKinds?: Record<string, string>; canEditPayments?: boolean
}
export type Payment = { id: string; dealId: string; date: string; amount: number; direction: 'in' | 'out'; kind: string; note: string; createdBy: { name: string } | null }
export type Pnl = { income: number; expense: number; net: number }
type Pipelines = Record<string, { label: string; stages: { id: string; label: string }[] }>
type ClientOpt = { id: string; name: string }
type FieldDef = { id: string; label: string; type: string; options: string[] }

export default function CrmDeals({ openId, canEdit, isManager }: { openId?: string | null; canEdit: boolean; isManager: boolean }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [pipelines, setPipelines] = useState<Pipelines>({})
  const [pipeline, setPipeline] = useState('sales')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/deals')
    if (r.ok) {
      setDeals(r.json.deals ?? [])
      setPipelines(r.json.pipelines ?? {})
    } else setErr(r.json?.error ?? 'Не удалось загрузить сделки')
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (openId) setOpen(openId) }, [openId])

  const stages = pipelines[pipeline]?.stages ?? []
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return deals.filter((d) => d.pipeline === pipeline && (!needle || d.title.toLowerCase().includes(needle) || d.clientName.toLowerCase().includes(needle)))
  }, [deals, pipeline, q])
  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const d of visible) if (d.amount !== null) t[d.stage] = (t[d.stage] ?? 0) + d.amount
    return t
  }, [visible])
  const maxTotal = Math.max(1, ...Object.values(totals))
  const amountsHidden = deals.length > 0 && deals.every((d) => d.amount === null)

  async function dropTo(stage: string) {
    const id = dragId
    setDragId(null); setOver(null)
    if (!id || !canEdit) return
    const deal = deals.find((d) => d.id === id)
    if (!deal || deal.stage === stage) return
    // оптимистично: сразу переносим карточку, при ошибке — откат
    const prev = deals
    setDeals(deals.map((d) => (d.id === id ? { ...d, stage } : d)))
    const r = await adminApi('POST', '/api/crm/deals/move', { id, stage })
    if (!r.ok) { setDeals(prev); setErr(r.json?.error ?? 'Не удалось переместить') } else load()
  }

  return (
    <div className="crm-deals">
      <div className="crm-toolbar">
        <div className="crm-toolbar__group">
          <div className="seg">
            {Object.entries(pipelines).map(([id, p]) => (
              <button key={id} className={pipeline === id ? 'is-active' : ''} onClick={() => setPipeline(id)}>{p.label}</button>
            ))}
          </div>
          <input className="admin-input admin-input--search" placeholder="Поиск по сделкам и клиентам" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {canEdit && <button className="admin-btn admin-btn--mint" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Новая сделка</button>}
      </div>
      {err && <p className="admin-note admin-note--err">{err}</p>}
      {loading && <p className="admin-note">Загрузка…</p>}
      {amountsHidden && <p className="hint" style={{ marginBottom: 12 }}><Icon name="lock" size={12} /> Суммы сделок скрыты для вашей роли.</p>}

      <div className="pipeline">
        {stages.map((s) => {
          const col = visible.filter((d) => d.stage === s.id)
          const total = totals[s.id] ?? 0
          const closed = s.id === 'won' || s.id === 'lost'
          return (
            <div key={s.id} className={`pipeline__col ${over === s.id ? 'is-over' : ''} ${closed ? 'is-closed' : ''} ${s.id === 'lost' ? 'is-lost' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (over !== s.id) setOver(s.id) }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={() => dropTo(s.id)}>
              <div className="pipeline__head">
                <div className="pipeline__head-row">
                  <span className="pipeline__stage">{s.label} <span className="kanban-col__count">{col.length}</span></span>
                  {!amountsHidden && <span className="pipeline__total money" title={formatMoney(total)}>{total ? formatMoney(total, 'KGS', true) : '—'}</span>}
                </div>
                <div className="capital-bar"><i style={{ width: `${amountsHidden ? 0 : (total / maxTotal) * 100}%` }} /></div>
              </div>
              <div className="pipeline__body">
                {col.map((d) => <DealCard key={d.id} deal={d} canDrag={canEdit} dragging={dragId === d.id} onDrag={() => setDragId(d.id)} onDragEnd={() => { setDragId(null); setOver(null) }} onOpen={() => setOpen(d.id)} />)}
                {col.length === 0 && <div className="kanban-empty">пусто</div>}
              </div>
            </div>
          )
        })}
      </div>

      <DealDrawer id={open} onClose={() => setOpen(null)} onChanged={load} pipelines={pipelines} canEdit={canEdit} isManager={isManager} />
      {creating && <NewDealForm pipeline={pipeline} pipelines={pipelines} onClose={() => setCreating(false)} onSaved={(d) => { setCreating(false); load(); setOpen(d.id) }} />}
    </div>
  )
}

function DealCard({ deal, canDrag, dragging, onDrag, onDragEnd, onOpen }: { deal: Deal; canDrag: boolean; dragging: boolean; onDrag: () => void; onDragEnd: () => void; onOpen: () => void }) {
  const due = dueLabel(deal.expectedClose)
  return (
    <div className={`deal-card ${dragging ? 'is-dragging' : ''}`} draggable={canDrag} onDragStart={onDrag} onDragEnd={onDragEnd} onClick={onOpen} style={{ cursor: canDrag ? 'grab' : 'pointer' }}>
      <span className="deal-card__title">{deal.title}</span>
      <span className="deal-card__client"><Icon name="user" size={12} /> {deal.clientName}</span>
      <div className="deal-card__foot">
        <Money value={deal.amount} currency={deal.currency} />
        <span className="deal-card__meta">
          {due && deal.stage !== 'won' && deal.stage !== 'lost' && <span className={`chip chip--${due.tone} chip--sm`}>{due.text}</span>}
          {deal.owner && <Avatar name={deal.owner.name} size={22} />}
        </span>
      </div>
      {deal.probability !== null && deal.stage !== 'won' && deal.stage !== 'lost' && (
        <div className="prob" title={`Вероятность ${deal.probability}%`}><i style={{ width: `${deal.probability}%` }} /></div>
      )}
    </div>
  )
}

/* ---------- Карточка сделки ---------- */
export function DealDrawer({ id, onClose, onChanged, pipelines, canEdit, isManager }: {
  id: string | null; onClose: () => void; onChanged: () => void; pipelines: Pipelines; canEdit: boolean; isManager: boolean
}) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [err, setErr] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [fields, setFields] = useState<FieldDef[]>([])
  const nav = useNav()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const r = await adminApi('GET', `/api/crm/deals/${id}`)
    if (r.ok) setDeal(r.json.deal); else setErr(r.json?.error ?? 'Сделка не найдена')
  }, [id])
  useEffect(() => { setDeal(null); setErr(''); load() }, [load])
  useEffect(() => { adminApi('GET', '/api/crm/fields?resource=deal').then((r) => r.ok && setFields(r.json.fields ?? [])) }, [])

  const patch = useCallback(async (item: Record<string, unknown>, silent = false) => {
    if (!deal) return
    setSaveState('saving')
    const r = await adminApi('POST', '/api/crm/deals/save', { item: { id: deal.id, title: deal.title, ...item } })
    if (r.ok) {
      setDeal((d) => (d ? { ...d, ...r.json.deal } : d))
      setSaveState('saved')
      if (!silent) onChanged()
    } else { setErr(r.json?.error ?? 'Не сохранилось'); setSaveState('idle') }
  }, [deal, onChanged])

  const onNotes = (blocks: Block[]) => {
    setDeal((d) => (d ? { ...d, notes: blocks } : d))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => patch({ notes: blocks }, true), 700)
  }

  async function remove() {
    if (!deal || !confirm(`Удалить сделку «${deal.title}»? Платежи удалятся вместе с ней.`)) return
    const r = await adminApi('POST', '/api/crm/deals/delete', { id: deal.id })
    if (r.ok) { onChanged(); onClose() } else setErr(r.json?.error ?? 'Ошибка')
  }

  const stages = deal ? pipelines[deal.pipeline]?.stages ?? [] : []
  const stageLabel = stages.find((s) => s.id === deal?.stage)?.label ?? deal?.stage
  const closed = deal?.stage === 'won' || deal?.stage === 'lost'

  return (
    <Drawer open={!!id} onClose={onClose} width="lg">
      <DrawerHead onClose={onClose}>
        {deal && (
          <>
            <span className={`chip ${deal.stage === 'won' ? 'chip--ok' : deal.stage === 'lost' ? 'chip--muted' : 'chip--info'}`}>{stageLabel}</span>
            <span className="hint">{pipelines[deal.pipeline]?.label}</span>
            <SaveState state={saveState} />
          </>
        )}
      </DrawerHead>
      {err && <p className="admin-note admin-note--err">{err}</p>}
      {!deal && !err && <p className="admin-note">Загрузка…</p>}
      {deal && (
        <>
          <input className="drawer__title-input" value={deal.title} readOnly={!canEdit} onChange={(e) => setDeal({ ...deal, title: e.target.value })}
            onBlur={(e) => e.target.value.trim() && e.target.value !== deal.title ? patch({ title: e.target.value.trim() }) : null} placeholder="Название сделки" />

          <dl className="props">
            <dt><Icon name="user" size={13} /> Клиент</dt>
            <dd><button className="prop-link" onClick={() => nav('client', deal.clientId)}>{deal.clientName} <Icon name="arrow-right" size={12} /></button></dd>
            <dt><Icon name="layers" size={13} /> Этап</dt>
            <dd>
              {canEdit ? (
                <select className="admin-input admin-input--inline" value={deal.stage} onChange={(e) => patch({ stage: e.target.value })}>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              ) : stageLabel}
            </dd>
            <dt><Icon name="coins" size={13} /> Сумма</dt>
            <dd><MoneyField value={deal.amount} currency={deal.currency} editable={canEdit && deal.editable.amount} onSave={(v) => patch({ amount: v })} /></dd>
            <dt><Icon name="trending" size={13} /> Комиссия</dt>
            <dd><MoneyField value={deal.commission} currency={deal.currency} editable={canEdit && deal.editable.commission} onSave={(v) => patch({ commission: v })} /></dd>
            <dt><Icon name="target" size={13} /> Вероятность</dt>
            <dd>
              {deal.probability === null ? <span className="prop-hidden"><Icon name="lock" size={12} /> скрыто</span>
                : canEdit && deal.editable.probability && !closed
                  ? <input className="admin-input admin-input--inline" type="number" min={0} max={100} style={{ width: 90 }} defaultValue={deal.probability} key={deal.probability} onBlur={(e) => Number(e.target.value) !== deal.probability && patch({ probability: Number(e.target.value) })} />
                  : `${deal.probability}%`}
            </dd>
            <dt><Icon name="calendar" size={13} /> Закрытие</dt>
            <dd>
              {closed ? <span>{fmtDate(deal.closedAt, true)}</span>
                : canEdit ? <input className="admin-input admin-input--inline" type="date" style={{ width: 170 }} value={deal.expectedClose} onChange={(e) => patch({ expectedClose: e.target.value })} />
                  : deal.expectedClose ? fmtDate(deal.expectedClose) : '—'}
              {!closed && dueLabel(deal.expectedClose) && <span className={`chip chip--sm chip--${dueLabel(deal.expectedClose)!.tone}`}>{dueLabel(deal.expectedClose)!.text}</span>}
            </dd>
            <dt><Icon name="users" size={13} /> Ответственный</dt>
            <dd>{deal.owner ? <><Avatar name={deal.owner.name} size={22} /> {deal.owner.name}</> : '—'}</dd>
            {fields.map((f) => (
              <CustomField key={f.id} def={f} value={deal.customFields[f.id]} editable={canEdit} onSave={(v) => patch({ customFields: { ...deal.customFields, [f.id]: v } })} />
            ))}
          </dl>

          {deal.pnl && deal.payments && (
            <div className="drawer__section">
              <h3>Финансы и платежи</h3>
              <PnlBlock pnl={deal.pnl} currency={deal.currency} />
              <PaymentsTable deal={deal} canEdit={!!deal.canEditPayments} onChange={(payments, pnl) => { setDeal({ ...deal, payments, pnl }); onChanged() }} />
            </div>
          )}

          <div className="drawer__section">
            <h3>Заметки</h3>
            <BlockEditor value={deal.notes ?? []} onChange={onNotes} readOnly={!canEdit} />
          </div>

          <div className="drawer__section">
            <h3>Задачи <button className="admin-btn admin-btn--ghost" onClick={() => nav('section', 'tasks')}>Все задачи</button></h3>
            {deal.tasks?.length ? (
              <div className="row-list">
                {deal.tasks.map((t) => (
                  <button key={t.id} className="row-item" onClick={() => nav('task', t.id)}>
                    <span className={`prio prio--${t.priority || 'normal'}`} />
                    <span className="row-item__main"><span className="row-item__title">{t.title}</span></span>
                    <span className={`st ${TASK_STATUS_CLASS[t.status] ?? 'st-new'}`}>{TASK_STATUS_LABEL[t.status] ?? t.status}</span>
                  </button>
                ))}
              </div>
            ) : <p className="hint">Задач по сделке нет. Поставить задачу можно из раздела «Задачи», указав сделку.</p>}
          </div>

          {deal.documents && deal.documents.length > 0 && (
            <div className="drawer__section">
              <h3>Документы</h3>
              <div className="row-list">
                {deal.documents.map((d) => (
                  <button key={d.id} className="row-item" onClick={() => nav('document', d.id)}>
                    <Icon name="book" size={15} /><span className="row-item__main"><span className="row-item__title">{d.title}</span><span className="row-item__sub">{fmtDate(d.updatedAt, true)}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isManager && <button className="drawer__delete" onClick={remove}>Удалить сделку</button>}
        </>
      )}
    </Drawer>
  )
}

export function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return null
  return <span className={`save-state is-${state}`}>{state === 'saving' ? 'Сохранение…' : <><Icon name="check" size={12} /> Сохранено</>}</span>
}

function MoneyField({ value, currency, editable, onSave }: { value: number | null; currency: string; editable: boolean; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  if (value === null) return <span className="prop-hidden"><Icon name="lock" size={12} /> скрыто правами доступа</span>
  if (!editable) return <Money value={value} currency={currency} />
  if (!editing) return <button className="prop-link" style={{ color: 'inherit' }} onClick={() => { setDraft(String(value)); setEditing(true) }}><Money value={value} currency={currency} /> <Icon name="edit" size={12} /></button>
  return (
    <input className="admin-input" type="number" step="0.01" style={{ width: 180 }} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); const n = Number(draft); if (!Number.isNaN(n) && n !== value) onSave(n) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }} />
  )
}

export function CustomField({ def, value, editable, onSave }: { def: FieldDef; value: unknown; editable: boolean; onSave: (v: unknown) => void }) {
  const str = value === undefined || value === null ? '' : String(value)
  return (
    <>
      <dt><Icon name="type" size={13} /> {def.label}</dt>
      <dd>
        {!editable ? (def.type === 'checkbox' ? (value ? 'да' : 'нет') : str || '—')
          : def.type === 'select' ? (
            <select className="admin-input admin-input--inline" value={str} onChange={(e) => onSave(e.target.value)}>
              <option value="">—</option>
              {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : def.type === 'checkbox' ? (
            <input type="checkbox" checked={!!value} onChange={(e) => onSave(e.target.checked)} />
          ) : (
            <input className="admin-input admin-input--inline" type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'} defaultValue={str} key={str}
              onBlur={(e) => e.target.value !== str && onSave(def.type === 'number' ? Number(e.target.value) : e.target.value)} />
          )}
      </dd>
    </>
  )
}

export function PnlBlock({ pnl, currency }: { pnl: Pnl; currency: string }) {
  return (
    <div className="pnl" style={{ marginBottom: 12 }}>
      <div className="is-income"><span>Поступления</span><Money value={pnl.income} currency={currency} /></div>
      <div><span>Расходы</span><Money value={pnl.expense ? -pnl.expense : 0} currency={currency} /></div>
      <div><span>Итог</span><Money value={pnl.net} currency={currency} signed /></div>
    </div>
  )
}

function PaymentsTable({ deal, canEdit, onChange }: { deal: Deal; canEdit: boolean; onChange: (p: Payment[], pnl: Pnl) => void }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ amount: '', direction: 'in', kind: 'payment', date: new Date().toISOString().slice(0, 10), note: '' })
  const [err, setErr] = useState('')
  const kinds = deal.paymentKinds ?? {}

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    const r = await adminApi('POST', '/api/crm/payments/save', { item: { dealId: deal.id, ...form } })
    if (r.ok) { onChange(r.json.payments, r.json.pnl); setAdding(false); setForm({ ...form, amount: '', note: '' }) } else setErr(r.json?.error ?? 'Ошибка')
  }
  async function remove(id: string) {
    if (!confirm('Удалить платёж?')) return
    const r = await adminApi('POST', '/api/crm/payments/delete', { id })
    if (r.ok) onChange(r.json.payments, r.json.pnl)
  }

  return (
    <>
      {deal.payments!.length > 0 ? (
        <table className="payments">
          <thead><tr><th>Дата</th><th>Тип</th><th>Комментарий</th><th className="num">Сумма</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {deal.payments!.map((p) => (
              <tr key={p.id}>
                <td>{fmtDate(p.date)}</td>
                <td>{kinds[p.kind] ?? p.kind}</td>
                <td>{p.note || <span className="hint">—</span>}</td>
                <td className={`num ${p.direction === 'in' ? 'pay-in' : 'pay-out'}`}><Money value={p.direction === 'in' ? p.amount : -p.amount} currency={deal.currency} signed /></td>
                {canEdit && <td><button className="icon-btn" onClick={() => remove(p.id)} aria-label="Удалить"><Icon name="trash" size={13} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="hint">Платежей пока нет.</p>}
      {canEdit && !adding && <button className="admin-btn admin-btn--ghost" style={{ marginTop: 10 }} onClick={() => setAdding(true)}><Icon name="plus" size={14} /> Добавить платёж</button>}
      {adding && (
        <form className="drawer__form" style={{ marginTop: 10 }} onSubmit={add}>
          <div className="inline-form">
            <input className="admin-input" type="number" step="0.01" min="0.01" placeholder="Сумма" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus required />
            <select className="admin-input" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="in">Поступление</option><option value="out">Расход</option>
            </select>
            <select className="admin-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="admin-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <input className="admin-input" placeholder="Комментарий (необязательно)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          {err && <p className="err">{err}</p>}
          <div className="inline-form">
            <button className="admin-btn admin-btn--mint" type="submit">Сохранить платёж</button>
            <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setAdding(false)}>Отмена</button>
          </div>
        </form>
      )}
    </>
  )
}

/* ---------- Новая сделка ---------- */
export function NewDealForm({ pipeline, pipelines, clientId, onClose, onSaved }: {
  pipeline: string; pipelines: Pipelines; clientId?: string; onClose: () => void; onSaved: (d: Deal) => void
}) {
  const [clients, setClients] = useState<ClientOpt[]>([])
  const [form, setForm] = useState({ title: '', clientId: clientId ?? '', pipeline, amount: '', commission: '', currency: 'KGS', probability: '20', expectedClose: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState<string[]>([])

  useEffect(() => {
    adminApi('GET', '/api/crm/clients').then((r) => r.ok && setClients(r.json.clients.map((c: ClientOpt) => ({ id: c.id, name: c.name }))))
    adminApi('GET', '/api/crm/me').then((r) => r.ok && setHidden(Object.entries(r.json.fields?.deal ?? {}).filter(([, v]) => !(v as { edit: boolean }).edit).map(([k]) => k)))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    const item: Record<string, unknown> = { title: form.title, clientId: form.clientId, pipeline: form.pipeline, currency: form.currency, expectedClose: form.expectedClose }
    if (!hidden.includes('amount')) item.amount = form.amount
    if (!hidden.includes('commission')) item.commission = form.commission
    if (!hidden.includes('probability')) item.probability = form.probability
    const r = await adminApi('POST', '/api/crm/deals/save', { item })
    setBusy(false)
    if (r.ok) onSaved(r.json.deal); else setErr(r.json?.error ?? 'Ошибка')
  }

  return (
    <Drawer open onClose={onClose}>
      <form onSubmit={save}>
        <DrawerHead onClose={onClose}><h2 className="drawer__title" style={{ margin: 0 }}>Новая сделка</h2></DrawerHead>
        <div className="drawer__form">
          <input className="admin-input" placeholder="Название сделки *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
          <label className="cms-field"><span>Клиент *</span>
            <select className="admin-input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
              <option value="">Выберите клиента</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="cms-field"><span>Воронка</span>
            <select className="admin-input" value={form.pipeline} onChange={(e) => setForm({ ...form, pipeline: e.target.value })}>
              {Object.entries(pipelines).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
            </select>
          </label>
          <div className="field-grid">
            {!hidden.includes('amount') && <label className="cms-field"><span>Сумма</span><input className="admin-input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>}
            <label className="cms-field"><span>Валюта</span>
              <select className="admin-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {['KGS', 'USD', 'EUR', 'RUB', 'KZT'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            {!hidden.includes('commission') && <label className="cms-field"><span>Комиссия</span><input className="admin-input" type="number" step="0.01" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} /></label>}
            {!hidden.includes('probability') && <label className="cms-field"><span>Вероятность, %</span><input className="admin-input" type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></label>}
            <label className="cms-field"><span>Ожидаемое закрытие</span><input className="admin-input" type="date" value={form.expectedClose} onChange={(e) => setForm({ ...form, expectedClose: e.target.value })} /></label>
          </div>
          {err && <p className="err">{err}</p>}
          <button className="admin-btn admin-btn--mint" type="submit" disabled={busy}>{busy ? 'Сохранение…' : 'Создать сделку'}</button>
        </div>
      </form>
    </Drawer>
  )
}
