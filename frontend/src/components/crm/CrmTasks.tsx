/**
 * Задачи: kanban (drag-and-drop по статусам) + карточка задачи в стиле Notion
 * (свойства, блочный документ, результат, история). Воркфлоу прежний:
 * Новая → В работе → На проверке → Выполнена / Отклонена.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi, fileUrl } from '../../data/adminApi'
import Icon from '../Icon'
import BlockEditor from './BlockEditor'
import { blocksPreview, type Block } from './blocks'
import { CustomField, SaveState } from './CrmDeals'
import { useNav } from './nav'
import { PRIORITY_LABEL, dueLabel, fmtDate } from './format'
import { Avatar, Drawer, DrawerHead } from './ui'

type User = { id: string; name: string; role: string }
type Attachment = { name: string; url: string; size?: number }
type HistoryItem = { at: string; by: string; byRole: string; action: string; note: string }
export type Task = {
  id: string; title: string; description?: string; assignee?: string; startDate?: string; dueDate?: string; priority?: string
  status: string; result?: { text?: string; link?: string }; rejectionReason?: string; attachments?: Attachment[]
  content?: Block[]; customFields?: Record<string, unknown>
  clientId?: string; clientName?: string; dealId?: string; dealTitle?: string
  createdByName?: string; createdAt?: string; history?: HistoryItem[]
}
type FieldDef = { id: string; label: string; type: string; options: string[] }
type Option = { id: string; name: string }

const STATUS_ORDER = ['new', 'in_progress', 'review', 'done', 'rejected']
const STATUS_CLASS: Record<string, string> = { new: 'st-new', in_progress: 'st-prog', review: 'st-review', done: 'st-done', rejected: 'st-rej' }

export default function CrmTasks({ openId, canCrm }: { openId?: string | null; canCrm: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [me, setMe] = useState<User | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'all' | 'mine'>('all')

  const load = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/tasks')
    if (r.ok) {
      setTasks(r.json.tasks ?? []); setStatuses(r.json.statuses ?? {}); setRoles(r.json.roles ?? {})
      setMe(r.json.me ?? null); setIsManager(!!r.json.isManager)
    } else setErr(r.json?.error ?? 'Не удалось загрузить')
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (openId) setOpenTask(openId) }, [openId])

  function resolveAction(from: string, to: string): string | null {
    if ((from === 'new' || from === 'rejected') && to === 'in_progress') return 'start'
    if (from === 'in_progress' && to === 'review') return 'submit'
    if (from === 'review' && to === 'done') return 'approve'
    if (from === 'review' && to === 'rejected') return 'reject'
    return null
  }

  async function dropTo(target: string) {
    const id = dragId
    setDragId(null); setDragOver(null); setErr('')
    if (!id) return
    const task = tasks.find((t) => t.id === id)
    if (!task || task.status === target) return
    const action = resolveAction(task.status, target)
    if (!action) { setErr(`Нельзя переместить из «${statuses[task.status] ?? task.status}» в «${statuses[target] ?? target}»`); return }
    if (action === 'submit' || action === 'reject') { setOpenTask(task.id); return }
    const prev = tasks
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status: target } : t)))
    const r = await adminApi('POST', '/api/crm/tasks/transition', { id, action })
    if (!r.ok) { setTasks(prev); setErr(r.json?.error ?? 'Не удалось переместить') } else load()
  }

  const shown = filter === 'mine' && me ? tasks.filter((t) => t.assignee === me.role) : tasks
  const current = tasks.find((t) => t.id === openTask) ?? null

  return (
    <div className="crm-tasks">
      <div className="crm-toolbar">
        <div className="crm-toolbar__group">
          <p className="crm-hint">Перетаскивайте карточки между колонками</p>
          {isManager && (
            <div className="seg">
              <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Все</button>
              <button className={filter === 'mine' ? 'is-active' : ''} onClick={() => setFilter('mine')}>Мои</button>
            </div>
          )}
        </div>
        {isManager && <button className="admin-btn admin-btn--mint" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Поставить задачу</button>}
      </div>
      {err && <p className="admin-note admin-note--err">{err}</p>}
      {loading && <p className="admin-note">Загрузка…</p>}

      <div className="kanban">
        {STATUS_ORDER.map((s) => {
          const col = shown.filter((t) => t.status === s)
          return (
            <div key={s} className={`kanban-col ${dragOver === s ? 'is-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (dragOver !== s) setDragOver(s) }}
              onDragLeave={() => setDragOver((o) => (o === s ? null : o))} onDrop={() => dropTo(s)}>
              <div className="kanban-col__head">
                <span className={`st ${STATUS_CLASS[s]}`}>{statuses[s] ?? s}</span>
                <span className="kanban-col__count">{col.length}</span>
              </div>
              <div className="kanban-col__body">
                {col.map((t) => {
                  const due = dueLabel(t.dueDate)
                  const preview = blocksPreview(t.content, 70) || t.description
                  return (
                    <div key={t.id} className={`kanban-card ${dragId === t.id ? 'is-dragging' : ''}`} draggable
                      onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setDragOver(null) }} onClick={() => setOpenTask(t.id)}>
                      <span className="kanban-card__title"><span className={`prio prio--${t.priority || 'normal'}`} style={{ marginRight: 7 }} />{t.title}</span>
                      {preview && <span className="row-item__sub" style={{ whiteSpace: 'normal' }}>{preview}</span>}
                      <div className="kanban-card__meta">
                        {t.assignee && <span className="kanban-card__role">{roles[t.assignee] ?? t.assignee}</span>}
                        {due && s !== 'done' && s !== 'rejected' && <span className={`chip chip--sm chip--${due.tone}`}><Icon name="clock" size={11} /> {due.text}</span>}
                        {t.clientName && <span className="kanban-card__tag"><Icon name="user" size={12} /> {t.clientName}</span>}
                      </div>
                      {((t.attachments?.length ?? 0) > 0 || t.result?.link) && (
                        <div className="kanban-card__tags">
                          {(t.attachments?.length ?? 0) > 0 && <span className="kanban-card__tag"><Icon name="clip" size={13} /> {t.attachments!.length}</span>}
                          {t.result?.link && <span className="kanban-card__tag"><Icon name="link" size={13} /> ссылка</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
                {col.length === 0 && <div className="kanban-empty">пусто</div>}
              </div>
            </div>
          )
        })}
      </div>

      <TaskDrawer task={current} me={me} isManager={isManager} roles={roles} statuses={statuses} canCrm={canCrm}
        onClose={() => setOpenTask(null)} onChange={(t) => { setTasks((list) => list.map((x) => (x.id === t.id ? t : x))) }} onReload={load} onDeleted={() => { setOpenTask(null); load() }} />
      {creating && <TaskForm roles={roles} canCrm={canCrm} onClose={() => setCreating(false)} onSaved={(t) => { setCreating(false); load(); setOpenTask(t.id) }} />}
    </div>
  )
}

/* ---------- Карточка задачи ---------- */
function TaskDrawer({ task, me, isManager, roles, statuses, canCrm, onClose, onChange, onReload, onDeleted }: {
  task: Task | null; me: User | null; isManager: boolean; roles: Record<string, string>; statuses: Record<string, string>; canCrm: boolean
  onClose: () => void; onChange: (t: Task) => void; onReload: () => void; onDeleted: () => void
}) {
  const [resultText, setResultText] = useState('')
  const [resultLink, setResultLink] = useState('')
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [fields, setFields] = useState<FieldDef[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nav = useNav()

  useEffect(() => { setError(''); setFiles([]); setResultText(''); setResultLink(''); setReason(''); setSaveState('idle') }, [task?.id])
  useEffect(() => { adminApi('GET', '/api/crm/fields?resource=task').then((r) => r.ok && setFields(r.json.fields ?? [])) }, [])

  const isAssignee = !!task && me?.role === task.assignee
  const canWork = isAssignee || isManager

  async function transition(action: string, payload?: object) {
    if (!task) return
    setBusy(true); setError('')
    const r = await adminApi('POST', '/api/crm/tasks/transition', { id: task.id, action, payload })
    setBusy(false)
    if (!r.ok) { setError(r.json?.error ?? 'Ошибка'); return }
    onChange(r.json.task); onReload()
  }

  const saveContent = useCallback(async (data: Record<string, unknown>) => {
    if (!task) return
    setSaveState('saving')
    const r = await adminApi('POST', '/api/crm/tasks/content', { id: task.id, ...data })
    if (r.ok) { onChange(r.json.task); setSaveState('saved') } else { setError(r.json?.error ?? 'Не сохранилось'); setSaveState('idle') }
  }, [task, onChange])

  const onBlocks = (blocks: Block[]) => {
    if (!task) return
    onChange({ ...task, content: blocks })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveContent({ content: blocks }), 700)
  }

  async function saveMeta(item: Record<string, unknown>) {
    if (!task) return
    setSaveState('saving')
    const r = await adminApi('POST', '/api/crm/tasks/save', { item: { id: task.id, title: task.title, description: task.description, ...item } })
    if (r.ok) { onChange(r.json.task); setSaveState('saved'); onReload() } else { setError(r.json?.error ?? 'Не сохранилось'); setSaveState('idle') }
  }

  async function remove() {
    if (!task || !confirm(`Удалить задачу «${task.title}»?`)) return
    setBusy(true)
    const r = await adminApi('POST', '/api/crm/tasks/delete', { id: task.id })
    setBusy(false)
    if (r.ok) onDeleted(); else setError(r.json?.error ?? 'Ошибка')
  }

  async function upload(fileList: FileList | null) {
    if (!fileList) return
    setBusy(true)
    for (const file of Array.from(fileList)) {
      const fd = new FormData(); fd.append('file', file)
      const r = await adminApi('POST', '/api/crm/upload', fd, true)
      if (r.ok) setFiles((f) => [...f, r.json.attachment]); else setError(r.json?.error ?? 'Файл не загружен')
    }
    setBusy(false)
  }

  const due = task ? dueLabel(task.dueDate) : null
  return (
    <Drawer open={!!task} onClose={onClose} width="lg">
      {task && (
        <>
          <DrawerHead onClose={onClose}>
            <span className={`st ${STATUS_CLASS[task.status]}`}>{statuses[task.status] ?? task.status}</span>
            <span className={`chip chip--sm chip--${task.priority === 'urgent' ? 'err' : task.priority === 'high' ? 'warn' : 'muted'}`}><span className={`prio prio--${task.priority || 'normal'}`} /> {PRIORITY_LABEL[task.priority ?? 'normal']}</span>
            <SaveState state={saveState} />
          </DrawerHead>
          <input className="drawer__title-input" value={task.title} readOnly={!isManager} onChange={(e) => onChange({ ...task, title: e.target.value })}
            onBlur={(e) => isManager && e.target.value.trim() && saveMeta({ title: e.target.value.trim() })} />

          <dl className="props">
            <dt><Icon name="user" size={13} /> Исполнитель</dt>
            <dd>{isManager ? (
              <select className="admin-input admin-input--inline" value={task.assignee ?? ''} onChange={(e) => saveMeta({ assignee: e.target.value })}>
                <option value="">—</option>{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>) : roles[task.assignee ?? ''] ?? '—'}</dd>
            <dt><Icon name="flag" size={13} /> Приоритет</dt>
            <dd>{isManager ? (
              <select className="admin-input admin-input--inline" value={task.priority ?? 'normal'} onChange={(e) => saveMeta({ priority: e.target.value })}>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>) : PRIORITY_LABEL[task.priority ?? 'normal']}</dd>
            <dt><Icon name="calendar" size={13} /> Срок</dt>
            <dd>
              {isManager ? <input className="admin-input admin-input--inline" type="date" style={{ width: 170 }} value={task.dueDate ?? ''} onChange={(e) => saveMeta({ dueDate: e.target.value })} /> : task.dueDate ? fmtDate(task.dueDate) : '—'}
              {due && task.status !== 'done' && task.status !== 'rejected' && <span className={`chip chip--sm chip--${due.tone}`}>{due.text}</span>}
            </dd>
            <dt><Icon name="clock" size={13} /> Начало</dt>
            <dd>{isManager ? <input className="admin-input admin-input--inline" type="date" style={{ width: 170 }} value={task.startDate ?? ''} onChange={(e) => saveMeta({ startDate: e.target.value })} /> : task.startDate ? fmtDate(task.startDate) : '—'}</dd>
            {canCrm && <>
              <dt><Icon name="users" size={13} /> Клиент</dt>
              <dd>{task.clientId ? <button className="prop-link" onClick={() => nav('client', task.clientId!)}>{task.clientName} <Icon name="arrow-right" size={12} /></button> : isManager ? <LinkPicker kind="client" onPick={(id) => saveMeta({ clientId: id })} /> : '—'}</dd>
              <dt><Icon name="briefcase" size={13} /> Сделка</dt>
              <dd>{task.dealId ? <button className="prop-link" onClick={() => nav('deal', task.dealId!)}>{task.dealTitle} <Icon name="arrow-right" size={12} /></button> : isManager ? <LinkPicker kind="deal" onPick={(id) => saveMeta({ dealId: id })} /> : '—'}</dd>
            </>}
            <dt><Icon name="pen" size={13} /> Поставил</dt>
            <dd>{task.createdByName && <><Avatar name={task.createdByName} size={22} /> {task.createdByName}</>} <span className="hint">{fmtDate(task.createdAt, true)}</span></dd>
            {fields.map((f) => <CustomField key={f.id} def={f} value={task.customFields?.[f.id]} editable={canWork} onSave={(v) => saveContent({ customFields: { ...(task.customFields ?? {}), [f.id]: v } })} />)}
          </dl>

          {task.description && <p className="drawer__desc" style={{ marginTop: 16 }}>{task.description}</p>}

          <div className="drawer__section">
            <h3>Документ задачи</h3>
            <BlockEditor key={task.id} value={task.content ?? []} onChange={onBlocks} readOnly={!canWork} />
          </div>

          {task.result?.text && (
            <div className="drawer__block drawer__block--ok" style={{ marginTop: 16 }}>
              <strong>Результат:</strong> {task.result.text}
              {task.result.link && <div><a href={task.result.link} target="_blank" rel="noreferrer">{task.result.link}</a></div>}
            </div>
          )}
          {(task.attachments?.length ?? 0) > 0 && (
            <div className="drawer__block"><strong>Файлы:</strong>
              <ul className="drawer__files">{task.attachments!.map((a, i) => <li key={i}><a href={fileUrl(a.url)} target="_blank" rel="noreferrer"><Icon name="clip" size={13} /> {a.name}</a></li>)}</ul>
            </div>
          )}
          {task.rejectionReason && task.status === 'rejected' && <div className="drawer__block drawer__block--rej"><strong>Причина отклонения:</strong> {task.rejectionReason}</div>}

          <div className="drawer__actions">
            {canWork && (task.status === 'new' || task.status === 'rejected') && <button className="admin-btn admin-btn--mint" disabled={busy} onClick={() => transition('start')}>Взять в работу</button>}
            {canWork && task.status === 'in_progress' && (
              <div className="drawer__form">
                <span className="drawer__form-title">Сдать на проверку</span>
                <input className="admin-input" placeholder="Что сделано" value={resultText} onChange={(e) => setResultText(e.target.value)} />
                <input className="admin-input" placeholder="Ссылка (reels / документ)" value={resultLink} onChange={(e) => setResultLink(e.target.value)} />
                <label className="drawer__file"><Icon name="clip" size={14} /> Прикрепить файлы<input type="file" multiple hidden onChange={(e) => upload(e.target.files)} /></label>
                {files.length > 0 && <ul className="drawer__files">{files.map((f, i) => <li key={i}><Icon name="clip" size={13} /> {f.name}</li>)}</ul>}
                <button className="admin-btn admin-btn--mint" disabled={busy} onClick={() => transition('submit', { resultText, resultLink, attachments: files })}>Сдать на проверку →</button>
              </div>
            )}
            {isManager && task.status === 'review' && (
              <div className="drawer__form">
                <button className="admin-btn admin-btn--mint" disabled={busy} onClick={() => transition('approve')}><Icon name="check" size={14} /> Принять задачу</button>
                <div className="drawer__reject">
                  <input className="admin-input" placeholder="Причина отклонения" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="admin-btn admin-btn--danger" disabled={busy || !reason.trim()} onClick={() => transition('reject', { reason })}>Отклонить</button>
                </div>
              </div>
            )}
          </div>
          {error && <p className="admin-note admin-note--err">{error}</p>}

          {(task.history?.length ?? 0) > 0 && (
            <div className="drawer__history"><strong>История</strong>
              <ul>{task.history!.map((h, i) => <li key={i}><span className="hist-time">{fmtDate(h.at, true)}</span><span><b>{h.by}</b> — {h.note}</span></li>)}</ul>
            </div>
          )}
          {isManager && <button className="drawer__delete" onClick={remove} disabled={busy}>Удалить задачу</button>}
        </>
      )}
    </Drawer>
  )
}

/** Выбор клиента/сделки для привязки. */
function LinkPicker({ kind, onPick }: { kind: 'client' | 'deal'; onPick: (id: string) => void }) {
  const [opts, setOpts] = useState<Option[] | null>(null)
  async function open() {
    const r = await adminApi('GET', kind === 'client' ? '/api/crm/clients' : '/api/crm/deals')
    if (r.ok) setOpts(kind === 'client' ? r.json.clients.map((c: Option) => ({ id: c.id, name: c.name })) : r.json.deals.map((d: { id: string; title: string; clientName: string }) => ({ id: d.id, name: `${d.title} — ${d.clientName}` })))
  }
  if (!opts) return <button className="prop-link" onClick={open}><Icon name="plus" size={12} /> привязать</button>
  return (
    <select className="admin-input admin-input--inline" autoFocus defaultValue="" onChange={(e) => e.target.value && onPick(e.target.value)} onBlur={() => setOpts(null)}>
      <option value="">Выберите…</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  )
}

/* ---------- Новая задача ---------- */
function TaskForm({ roles, canCrm, onClose, onSaved }: { roles: Record<string, string>; canCrm: boolean; onClose: () => void; onSaved: (t: Task) => void }) {
  const [f, setF] = useState({ title: '', description: '', assignee: 'smm', dueDate: '', startDate: '', priority: 'normal', clientId: '', dealId: '' })
  const [clients, setClients] = useState<Option[]>([])
  const [deals, setDeals] = useState<{ id: string; title: string; clientId: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!canCrm) return
    adminApi('GET', '/api/crm/clients').then((r) => r.ok && setClients(r.json.clients.map((c: Option) => ({ id: c.id, name: c.name }))))
    adminApi('GET', '/api/crm/deals').then((r) => r.ok && setDeals(r.json.deals))
  }, [canCrm])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    const r = await adminApi('POST', '/api/crm/tasks/save', { item: f })
    setBusy(false)
    if (r.ok) onSaved(r.json.task); else setErr(r.json?.error ?? 'Ошибка')
  }

  const dealOpts = f.clientId ? deals.filter((d) => d.clientId === f.clientId) : deals
  return (
    <Drawer open onClose={onClose}>
      <form onSubmit={save}>
        <DrawerHead onClose={onClose}><h2 className="drawer__title" style={{ margin: 0 }}>Новая задача</h2></DrawerHead>
        <div className="drawer__form">
          <input className="admin-input" placeholder="Название задачи *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus required />
          <textarea className="admin-input cms-textarea" placeholder="Кратко: что и зачем (подробности — в документе задачи)" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div className="field-grid">
            <label className="cms-field"><span>Исполнитель</span>
              <select className="admin-input" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="cms-field"><span>Приоритет</span>
              <select className="admin-input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="cms-field"><span>Начало</span><input className="admin-input" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
            <label className="cms-field"><span>Срок</span><input className="admin-input" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></label>
            {canCrm && <>
              <label className="cms-field"><span>Клиент</span>
                <select className="admin-input" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value, dealId: '' })}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </label>
              <label className="cms-field"><span>Сделка</span>
                <select className="admin-input" value={f.dealId} onChange={(e) => setF({ ...f, dealId: e.target.value })}><option value="">—</option>{dealOpts.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
              </label>
            </>}
          </div>
          {err && <p className="err">{err}</p>}
          <button className="admin-btn admin-btn--mint" type="submit" disabled={busy}>{busy ? 'Сохранение…' : 'Поставить задачу'}</button>
        </div>
      </form>
    </Drawer>
  )
}
