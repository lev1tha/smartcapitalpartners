/**
 * Клиенты: список с поиском и фильтром, профиль клиента (контакты, сделки,
 * P&L по всем сделкам, задачи, документы, заметки). Контакты и финансы
 * скрываются матрицей прав (null → замок).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'
import BlockEditor from './BlockEditor'
import type { Block } from './blocks'
import { CustomField, NewDealForm, PnlBlock, SaveState, type Deal, type Payment, type Pnl } from './CrmDeals'
import { useNav } from './nav'
import { TASK_STATUS_CLASS, TASK_STATUS_LABEL, fmtDate } from './format'
import { Avatar, Drawer, DrawerHead, Empty, Money } from './ui'

type Client = {
  id: string; name: string; company: string; kind: string; status: string
  email: string | null; phone: string | null; telegram: string | null
  owner: { id: string; name: string } | null; tags: string[]; customFields: Record<string, unknown>
  createdAt: string; updatedAt: string; hidden: string[]; dealsCount?: number; openDeals?: number
  notes?: Block[]; deals?: Deal[]; pnl?: Pnl; payments?: Payment[]; wonAmount?: number | null
  tasks?: { id: string; title: string; status: string; dueDate: string; priority: string }[]
  documents?: { id: string; title: string; updatedAt: string }[]
}
type FieldDef = { id: string; label: string; type: string; options: string[] }
const STATUS_TONE: Record<string, string> = { lead: 'info', active: 'ok', paused: 'warn', archived: 'muted' }

export default function CrmClients({ openId, canEdit, isManager, pipelines }: {
  openId?: string | null; canEdit: boolean; isManager: boolean; pipelines: Record<string, { label: string; stages: { id: string; label: string }[] }>
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (status) params.set('status', status)
    const r = await adminApi('GET', `/api/crm/clients?${params}`)
    if (r.ok) { setClients(r.json.clients ?? []); setStatuses(r.json.statuses ?? {}) } else setErr(r.json?.error ?? 'Не удалось загрузить')
    setLoading(false)
  }, [q, status])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  useEffect(() => { if (openId) setOpen(openId) }, [openId])

  const contactsHidden = clients.length > 0 && clients[0].hidden.includes('phone') && clients[0].hidden.includes('email')

  return (
    <div className="crm-clients">
      <div className="crm-toolbar">
        <div className="crm-toolbar__group">
          <input className="admin-input admin-input--search" placeholder="Имя, компания, телефон, email" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="seg">
            <button className={status === '' ? 'is-active' : ''} onClick={() => setStatus('')}>Все</button>
            {Object.entries(statuses).map(([k, v]) => <button key={k} className={status === k ? 'is-active' : ''} onClick={() => setStatus(k)}>{v}</button>)}
          </div>
        </div>
        {canEdit && <button className="admin-btn admin-btn--mint" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Новый клиент</button>}
      </div>
      {err && <p className="admin-note admin-note--err">{err}</p>}
      {loading && <p className="admin-note">Загрузка…</p>}

      {!loading && clients.length === 0 ? (
        <Empty icon="users" title={q || status ? 'Ничего не найдено' : 'Клиентов пока нет'} hint={q || status ? 'Попробуйте другой запрос или фильтр.' : 'Добавьте первого клиента — к нему можно привязать сделки, задачи и документы.'}
          action={canEdit && !q && !status ? <button className="admin-btn admin-btn--mint" onClick={() => setCreating(true)}>Добавить клиента</button> : undefined} />
      ) : (
        <div className="clients">
          <div className="clients__head"><span /><span>Клиент</span><span>{contactsHidden ? '' : 'Контакты'}</span><span>Статус</span><span>Сделок</span><span>В работе</span></div>
          {clients.map((c) => (
            <button key={c.id} className="client-row" onClick={() => setOpen(c.id)}>
              <Avatar name={c.name} size={36} />
              <span style={{ minWidth: 0 }}>
                <span className="client-row__name">{c.name}</span>
                <span className="client-row__sub">{c.company || (c.kind === 'person' ? 'Физлицо' : 'Компания')}{c.tags.length ? ' · ' + c.tags.join(', ') : ''}</span>
              </span>
              <span className="client-row__contacts">
                {c.phone !== null && c.phone && <span><Icon name="phone" size={12} /> {c.phone}</span>}
                {c.email !== null && c.email && <span><Icon name="mail" size={12} /> {c.email}</span>}
                {c.phone === null && c.email === null && <span className="prop-hidden"><Icon name="lock" size={12} /> скрыто</span>}
              </span>
              <span><span className={`chip chip--${STATUS_TONE[c.status] ?? 'muted'} chip--sm`}>{statuses[c.status] ?? c.status}</span></span>
              <span className="client-row__num">{c.dealsCount ?? 0}</span>
              <span className="client-row__num">{c.openDeals ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      <ClientDrawer id={open} onClose={() => setOpen(null)} onChanged={load} canEdit={canEdit} isManager={isManager} statuses={statuses} pipelines={pipelines} />
      {creating && <ClientForm onClose={() => setCreating(false)} onSaved={(c) => { setCreating(false); load(); setOpen(c.id) }} statuses={statuses} />}
    </div>
  )
}

/* ---------- Профиль клиента ---------- */
export function ClientDrawer({ id, onClose, onChanged, canEdit, isManager, statuses, pipelines }: {
  id: string | null; onClose: () => void; onChanged: () => void; canEdit: boolean; isManager: boolean
  statuses: Record<string, string>; pipelines: Record<string, { label: string; stages: { id: string; label: string }[] }>
}) {
  const [client, setClient] = useState<Client | null>(null)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const [newDeal, setNewDeal] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [fields, setFields] = useState<FieldDef[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nav = useNav()

  const load = useCallback(async () => {
    if (!id) return
    const r = await adminApi('GET', `/api/crm/clients/${id}`)
    if (r.ok) setClient(r.json.client); else setErr(r.json?.error ?? 'Клиент не найден')
  }, [id])
  useEffect(() => { setClient(null); setErr(''); setEditing(false); load() }, [load])
  useEffect(() => { adminApi('GET', '/api/crm/fields?resource=client').then((r) => r.ok && setFields(r.json.fields ?? [])) }, [])

  const patch = useCallback(async (item: Record<string, unknown>, silent = false) => {
    if (!client) return
    setSaveState('saving')
    const r = await adminApi('POST', '/api/crm/clients/save', { item: { id: client.id, name: client.name, ...item } })
    if (r.ok) { setClient((c) => (c ? { ...c, ...r.json.client } : c)); setSaveState('saved'); if (!silent) onChanged() }
    else { setErr(r.json?.error ?? 'Не сохранилось'); setSaveState('idle') }
  }, [client, onChanged])

  const onNotes = (blocks: Block[]) => {
    setClient((c) => (c ? { ...c, notes: blocks } : c))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => patch({ notes: blocks }, true), 700)
  }

  async function remove() {
    if (!client || !confirm(`Удалить клиента «${client.name}»? Все его сделки и платежи будут удалены.`)) return
    const r = await adminApi('POST', '/api/crm/clients/delete', { id: client.id })
    if (r.ok) { onChanged(); onClose() } else setErr(r.json?.error ?? 'Ошибка')
  }

  const stageLabel = (d: Deal) => pipelines[d.pipeline]?.stages.find((s) => s.id === d.stage)?.label ?? d.stage

  return (
    <Drawer open={!!id} onClose={onClose} width="lg">
      <DrawerHead onClose={onClose}>
        {client && <>
          <span className={`chip chip--${STATUS_TONE[client.status] ?? 'muted'}`}>{statuses[client.status] ?? client.status}</span>
          <SaveState state={saveState} />
          {canEdit && <button className="admin-btn admin-btn--ghost" style={{ height: 30, fontSize: 12 }} onClick={() => setEditing((e) => !e)}><Icon name="edit" size={13} /> {editing ? 'Готово' : 'Изменить'}</button>}
        </>}
      </DrawerHead>
      {err && <p className="admin-note admin-note--err">{err}</p>}
      {!client && !err && <p className="admin-note">Загрузка…</p>}
      {client && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <Avatar name={client.name} size={48} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <input className="drawer__title-input" style={{ margin: 0 }} value={client.name} readOnly={!canEdit} onChange={(e) => setClient({ ...client, name: e.target.value })}
                onBlur={(e) => e.target.value.trim() && patch({ name: e.target.value.trim() })} />
              <span className="hint">{client.company || (client.kind === 'person' ? 'Физлицо' : 'Компания')} · с {fmtDate(client.createdAt)}</span>
            </div>
          </div>

          {editing ? (
            <ClientFields client={client} statuses={statuses} onSave={(item) => patch(item)} />
          ) : (
            <dl className="props">
              <dt><Icon name="phone" size={13} /> Телефон</dt>
              <dd>{client.phone === null ? <Hidden /> : client.phone ? <a className="prop-link" href={`tel:${client.phone}`}>{client.phone}</a> : '—'}</dd>
              <dt><Icon name="mail" size={13} /> Email</dt>
              <dd>{client.email === null ? <Hidden /> : client.email ? <a className="prop-link" href={`mailto:${client.email}`}>{client.email}</a> : '—'}</dd>
              <dt><Icon name="send" size={13} /> Telegram</dt>
              <dd>{client.telegram === null ? <Hidden /> : client.telegram ? <a className="prop-link" href={`https://t.me/${client.telegram.replace('@', '')}`} target="_blank" rel="noreferrer">{client.telegram}</a> : '—'}</dd>
              <dt><Icon name="users" size={13} /> Ответственный</dt>
              <dd>{client.owner ? <><Avatar name={client.owner.name} size={22} /> {client.owner.name}</> : '—'}</dd>
              <dt><Icon name="flag" size={13} /> Теги</dt>
              <dd>{client.tags.length ? client.tags.map((t) => <span key={t} className="tag">{t}</span>) : '—'}</dd>
              {fields.map((f) => <CustomField key={f.id} def={f} value={client.customFields[f.id]} editable={canEdit} onSave={(v) => patch({ customFields: { ...client.customFields, [f.id]: v } })} />)}
            </dl>
          )}

          {client.pnl && (
            <div className="drawer__section">
              <h3>Финансы по клиенту {client.wonAmount !== null && client.wonAmount !== undefined && <small className="hint">закрыто сделок на <Money value={client.wonAmount} /></small>}</h3>
              <PnlBlock pnl={client.pnl} currency="KGS" />
            </div>
          )}

          <div className="drawer__section">
            <h3>Сделки {canEdit && <button className="admin-btn admin-btn--ghost" onClick={() => setNewDeal(true)}><Icon name="plus" size={13} /> Сделка</button>}</h3>
            {client.deals?.length ? (
              <div className="row-list">
                {client.deals.map((d) => (
                  <button key={d.id} className="row-item" onClick={() => nav('deal', d.id)}>
                    <Icon name="briefcase" size={15} />
                    <span className="row-item__main"><span className="row-item__title">{d.title}</span><span className="row-item__sub">{pipelines[d.pipeline]?.label} · {stageLabel(d)}</span></span>
                    <span className="row-item__right">
                      {d.pnl && <span className="hint">P&L <Money value={d.pnl.net} currency={d.currency} signed /></span>}
                      <Money value={d.amount} currency={d.currency} />
                    </span>
                  </button>
                ))}
              </div>
            ) : <p className="hint">Сделок пока нет.</p>}
          </div>

          <div className="drawer__section">
            <h3>Заметки</h3>
            <BlockEditor value={client.notes ?? []} onChange={onNotes} readOnly={!canEdit} />
          </div>

          {(client.tasks?.length ?? 0) > 0 && (
            <div className="drawer__section">
              <h3>Задачи</h3>
              <div className="row-list">
                {client.tasks!.map((t) => (
                  <button key={t.id} className="row-item" onClick={() => nav('task', t.id)}>
                    <span className={`prio prio--${t.priority || 'normal'}`} /><span className="row-item__main"><span className="row-item__title">{t.title}</span>{t.dueDate && <span className="row-item__sub">до {fmtDate(t.dueDate)}</span>}</span>
                    <span className={`st ${TASK_STATUS_CLASS[t.status] ?? 'st-new'}`}>{TASK_STATUS_LABEL[t.status] ?? t.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {(client.documents?.length ?? 0) > 0 && (
            <div className="drawer__section">
              <h3>Документы</h3>
              <div className="row-list">
                {client.documents!.map((d) => (
                  <button key={d.id} className="row-item" onClick={() => nav('document', d.id)}>
                    <Icon name="book" size={15} /><span className="row-item__main"><span className="row-item__title">{d.title}</span><span className="row-item__sub">{fmtDate(d.updatedAt, true)}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isManager && <button className="drawer__delete" onClick={remove}>Удалить клиента</button>}
          {newDeal && <NewDealForm pipeline="sales" pipelines={pipelines} clientId={client.id} onClose={() => setNewDeal(false)} onSaved={(d) => { setNewDeal(false); load(); onChanged(); nav('deal', d.id) }} />}
        </>
      )}
    </Drawer>
  )
}

const Hidden = () => <span className="prop-hidden"><Icon name="lock" size={12} /> скрыто правами доступа</span>

function ClientFields({ client, statuses, onSave }: { client: Client; statuses: Record<string, string>; onSave: (item: Record<string, unknown>) => void }) {
  const [f, setF] = useState({
    company: client.company, kind: client.kind, status: client.status,
    phone: client.phone ?? '', email: client.email ?? '', telegram: client.telegram ?? '', tags: client.tags.join(', '),
  })
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const item: Record<string, unknown> = { company: f.company, kind: f.kind, status: f.status, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) }
    // скрытые поля не отправляем — иначе сервер вернёт 403
    if (client.phone !== null) item.phone = f.phone
    if (client.email !== null) item.email = f.email
    if (client.telegram !== null) item.telegram = f.telegram
    onSave(item)
  }
  return (
    <form className="drawer__form" onSubmit={submit}>
      <div className="field-grid">
        <label className="cms-field"><span>Компания</span><input className="admin-input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
        <label className="cms-field"><span>Тип</span>
          <select className="admin-input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="company">Компания</option><option value="person">Физлицо</option></select>
        </label>
        <label className="cms-field"><span>Статус</span>
          <select className="admin-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="cms-field"><span>Теги (через запятую)</span><input className="admin-input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></label>
        {client.phone !== null && <label className="cms-field"><span>Телефон</span><input className="admin-input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>}
        {client.email !== null && <label className="cms-field"><span>Email</span><input className="admin-input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>}
        {client.telegram !== null && <label className="cms-field"><span>Telegram</span><input className="admin-input" value={f.telegram} onChange={(e) => setF({ ...f, telegram: e.target.value })} /></label>}
      </div>
      <button className="admin-btn admin-btn--mint" type="submit">Сохранить</button>
    </form>
  )
}

export function ClientForm({ onClose, onSaved, statuses }: { onClose: () => void; onSaved: (c: Client) => void; statuses: Record<string, string> }) {
  const [f, setF] = useState({ name: '', company: '', kind: 'company', status: 'lead', phone: '', email: '', telegram: '', tags: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    const r = await adminApi('POST', '/api/crm/clients/save', { item: { ...f, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) } })
    setBusy(false)
    if (r.ok) onSaved(r.json.client); else setErr(r.json?.error ?? 'Ошибка')
  }
  return (
    <Drawer open onClose={onClose}>
      <form onSubmit={save}>
        <DrawerHead onClose={onClose}><h2 className="drawer__title" style={{ margin: 0 }}>Новый клиент</h2></DrawerHead>
        <div className="drawer__form">
          <input className="admin-input" placeholder="Имя или название *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus required />
          <div className="field-grid">
            <label className="cms-field"><span>Компания</span><input className="admin-input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
            <label className="cms-field"><span>Тип</span>
              <select className="admin-input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="company">Компания</option><option value="person">Физлицо</option></select>
            </label>
            <label className="cms-field"><span>Телефон</span><input className="admin-input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
            <label className="cms-field"><span>Email</span><input className="admin-input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label className="cms-field"><span>Telegram</span><input className="admin-input" value={f.telegram} onChange={(e) => setF({ ...f, telegram: e.target.value })} /></label>
            <label className="cms-field"><span>Статус</span>
              <select className="admin-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="cms-field cms-field--full"><span>Теги (через запятую)</span><input className="admin-input" placeholder="HoReCa, франшиза" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></label>
          </div>
          {err && <p className="err">{err}</p>}
          <button className="admin-btn admin-btn--mint" type="submit" disabled={busy}>{busy ? 'Сохранение…' : 'Создать клиента'}</button>
        </div>
      </form>
    </Drawer>
  )
}
