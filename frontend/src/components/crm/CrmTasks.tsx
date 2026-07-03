import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'

type User = { id: string; name: string; role: string }
type Attachment = { name: string; url: string; size?: number }
type HistoryItem = { at: string; by: string; byRole: string; action: string; note: string }
type Task = {
  id: string
  title: string
  description?: string
  assignee?: string
  dueDate?: string
  status: string
  result?: { text?: string; link?: string }
  rejectionReason?: string
  attachments?: Attachment[]
  createdByName?: string
  createdAt?: string
  history?: HistoryItem[]
}

const STATUS_ORDER = ['new', 'in_progress', 'review', 'done', 'rejected']
const STATUS_CLASS: Record<string, string> = {
  new: 'st-new',
  in_progress: 'st-prog',
  review: 'st-review',
  done: 'st-done',
  rejected: 'st-rej',
}

const fmtDate = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function CrmTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [me, setMe] = useState<User | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminApi('GET', '/api/crm/tasks')
    if (r.ok) {
      setTasks(r.json.tasks ?? [])
      setStatuses(r.json.statuses ?? {})
      setRoles(r.json.roles ?? {})
      setMe(r.json.me ?? null)
      setIsManager(!!r.json.isManager)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function refreshOpen(updated: Task) {
    setOpen(updated)
    await load()
  }

  function resolveAction(from: string, to: string): string | null {
    if ((from === 'new' || from === 'rejected') && to === 'in_progress') return 'start'
    if (from === 'in_progress' && to === 'review') return 'submit'
    if (from === 'review' && to === 'done') return 'approve'
    if (from === 'review' && to === 'rejected') return 'reject'
    return null
  }

  async function dropTo(targetStatus: string) {
    const id = dragId
    setDragId(null)
    setDragOver(null)
    setErr('')
    if (!id) return
    const task = tasks.find((t) => t.id === id)
    if (!task || task.status === targetStatus) return
    const action = resolveAction(task.status, targetStatus)
    if (!action) {
      setErr('Нельзя переместить из «' + (statuses[task.status] ?? task.status) + '» в «' + (statuses[targetStatus] ?? targetStatus) + '»')
      return
    }
    // submit/reject требуют доп. данные — открываем карточку
    if (action === 'submit' || action === 'reject') {
      setOpen(task)
      return
    }
    const r = await adminApi('POST', '/api/crm/tasks/transition', { id, action })
    if (!r.ok) setErr(r.json?.error ?? 'Не удалось переместить')
    load()
  }

  return (
    <div className="crm-tasks">
      <div className="crm-toolbar">
        <p className="crm-hint">
          Доска задач · перетаскивайте карточки между колонками
        </p>
        {isManager && (
          <button className="admin-btn admin-btn--mint" onClick={() => setCreating(true)}>
            + Поставить задачу
          </button>
        )}
      </div>

      {err && <p className="admin-note admin-note--err">{err}</p>}
      {loading && <p className="admin-note">Загрузка…</p>}

      <div className="kanban">
        {STATUS_ORDER.map((s) => {
          const col = tasks.filter((t) => t.status === s)
          return (
            <div
              key={s}
              className={`kanban-col ${dragOver === s ? 'is-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOver !== s) setDragOver(s)
              }}
              onDragLeave={() => setDragOver((o) => (o === s ? null : o))}
              onDrop={() => dropTo(s)}
            >
              <div className="kanban-col__head">
                <span className={`st ${STATUS_CLASS[s]}`}>{statuses[s] ?? s}</span>
                <span className="kanban-col__count">{col.length}</span>
              </div>
              <div className="kanban-col__body">
                {col.map((t) => (
                  <div
                    key={t.id}
                    className={`kanban-card ${dragId === t.id ? 'is-dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setDragOver(null)
                    }}
                    onClick={() => setOpen(t)}
                  >
                    <span className="kanban-card__title">{t.title}</span>
                    <div className="kanban-card__meta">
                      {t.assignee && (
                        <span className="kanban-card__role">{roles[t.assignee] ?? t.assignee}</span>
                      )}
                      {t.dueDate && <span className="kanban-card__tag"><Icon name="clock" size={13} /> {t.dueDate}</span>}
                    </div>
                    {((t.attachments && t.attachments.length > 0) || t.result?.link) && (
                      <div className="kanban-card__tags">
                        {t.attachments && t.attachments.length > 0 && (
                          <span className="kanban-card__tag"><Icon name="clip" size={13} /> {t.attachments.length}</span>
                        )}
                        {t.result?.link && <span className="kanban-card__tag"><Icon name="link" size={13} /> ссылка</span>}
                      </div>
                    )}
                  </div>
                ))}
                {col.length === 0 && <div className="kanban-empty">пусто</div>}
              </div>
            </div>
          )
        })}
      </div>

      {open && (
        <TaskDetail
          task={open}
          me={me}
          isManager={isManager}
          roles={roles}
          statuses={statuses}
          onClose={() => setOpen(null)}
          onChange={refreshOpen}
          onDeleted={() => { setOpen(null); load() }}
        />
      )}

      {creating && (
        <TaskForm roles={roles} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} setErr={setErr} />
      )}
    </div>
  )
}

/* ---------- Детальная карточка задачи ---------- */
function TaskDetail({
  task, me, isManager, roles, statuses, onClose, onChange, onDeleted,
}: {
  task: Task
  me: User | null
  isManager: boolean
  roles: Record<string, string>
  statuses: Record<string, string>
  onClose: () => void
  onChange: (t: Task) => void
  onDeleted: () => void
}) {
  const [resultText, setResultText] = useState('')
  const [resultLink, setResultLink] = useState('')
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isAssignee = me?.role === task.assignee
  const canWork = isAssignee || isManager

  async function transition(action: string, payload?: object) {
    setBusy(true)
    setError('')
    const r = await adminApi('POST', '/api/crm/tasks/transition', { id: task.id, action, payload })
    setBusy(false)
    if (!r.ok) {
      setError(r.json?.error ?? 'Ошибка')
      return
    }
    onChange(r.json.task)
  }

  async function remove() {
    if (!confirm(`Удалить задачу «${task.title}»?`)) return
    setBusy(true)
    const r = await adminApi('POST', '/api/crm/tasks/delete', { id: task.id })
    setBusy(false)
    if (r.ok) onDeleted()
    else setError(r.json?.error ?? 'Ошибка')
  }

  async function upload(fileList: FileList | null) {
    if (!fileList) return
    setBusy(true)
    for (const file of Array.from(fileList)) {
      const fd = new FormData()
      fd.append('file', file)
      const r = await adminApi('POST', '/api/crm/upload', fd, true)
      if (r.ok) setFiles((f) => [...f, r.json.attachment])
      else setError(r.json?.error ?? 'Файл не загружен')
    }
    setBusy(false)
  }

  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <span className={`st ${STATUS_CLASS[task.status]}`}>{statuses[task.status] ?? task.status}</span>
          <button className="drawer__close" onClick={onClose}>✕</button>
        </div>

        <h2 className="drawer__title">{task.title}</h2>
        <div className="drawer__meta">
          {task.assignee && <span>Исполнитель: <b>{roles[task.assignee] ?? task.assignee}</b></span>}
          {task.createdByName && <span>Поставил: {task.createdByName}</span>}
          {task.dueDate && <span>Срок: {task.dueDate}</span>}
        </div>
        {task.description && <p className="drawer__desc">{task.description}</p>}

        {task.result?.text && (
          <div className="drawer__block drawer__block--ok">
            <strong>Результат:</strong> {task.result.text}
            {task.result.link && (
              <div>
                <a href={task.result.link} target="_blank" rel="noreferrer">{task.result.link}</a>
              </div>
            )}
          </div>
        )}
        {task.attachments && task.attachments.length > 0 && (
          <div className="drawer__block">
            <strong>Файлы:</strong>
            <ul className="drawer__files">
              {task.attachments.map((a, i) => (
                <li key={i}><a href={a.url} target="_blank" rel="noreferrer"><Icon name="clip" size={13} /> {a.name}</a></li>
              ))}
            </ul>
          </div>
        )}
        {task.rejectionReason && task.status === 'rejected' && (
          <div className="drawer__block drawer__block--rej">
            <strong>Причина отклонения:</strong> {task.rejectionReason}
          </div>
        )}

        {/* Действия */}
        <div className="drawer__actions">
          {canWork && (task.status === 'new' || task.status === 'rejected') && (
            <button className="admin-btn admin-btn--mint" disabled={busy} onClick={() => transition('start')}>
              Взять в работу
            </button>
          )}

          {canWork && task.status === 'in_progress' && (
            <div className="drawer__form">
              <span className="drawer__form-title">Сдать на проверку</span>
              <input className="admin-input" placeholder="Что сделано (например: reels опубликован)" value={resultText} onChange={(e) => setResultText(e.target.value)} />
              <input className="admin-input" placeholder="Ссылка (reels / документ)" value={resultLink} onChange={(e) => setResultLink(e.target.value)} />
              <label className="drawer__file">
                <Icon name="clip" size={14} /> Прикрепить файлы (Excel, Word, PDF…)
                <input type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
              </label>
              {files.length > 0 && (
                <ul className="drawer__files">
                  {files.map((f, i) => <li key={i}><Icon name="clip" size={13} /> {f.name}</li>)}
                </ul>
              )}
              <button className="admin-btn admin-btn--mint" disabled={busy}
                onClick={() => transition('submit', { resultText, resultLink, attachments: files })}>
                Сдать на проверку →
              </button>
            </div>
          )}

          {isManager && task.status === 'review' && (
            <div className="drawer__form">
              <button className="admin-btn admin-btn--mint" disabled={busy} onClick={() => transition('approve')}>
                ✓ Принять задачу
              </button>
              <div className="drawer__reject">
                <input className="admin-input" placeholder="Причина отклонения" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className="admin-btn admin-btn--danger" disabled={busy || !reason.trim()}
                  onClick={() => transition('reject', { reason })}>
                  Отклонить
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="admin-note admin-note--err">{error}</p>}

        {/* История */}
        {task.history && task.history.length > 0 && (
          <div className="drawer__history">
            <strong>История</strong>
            <ul>
              {task.history.map((h, i) => (
                <li key={i}>
                  <span className="hist-time">{fmtDate(h.at)}</span>
                  <span><b>{h.by}</b> — {h.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isManager && (
          <button className="drawer__delete" onClick={remove} disabled={busy}>
            Удалить задачу
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- Форма постановки задачи ---------- */
function TaskForm({
  roles, onClose, onSaved, setErr,
}: {
  roles: Record<string, string>
  onClose: () => void
  onSaved: () => void
  setErr: (s: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('smm')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    const r = await adminApi('POST', '/api/crm/tasks/save', {
      item: { title, description, assignee, dueDate },
    })
    setBusy(false)
    if (r.ok) onSaved()
    else setErr(r.json?.error ?? 'Ошибка')
  }

  return (
    <div className="drawer" onClick={onClose}>
      <form className="drawer__panel" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="drawer__head">
          <h2 className="drawer__title">Новая задача</h2>
          <button type="button" className="drawer__close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer__form">
          <input className="admin-input" placeholder="Название задачи *" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea className="admin-input cms-textarea" placeholder="Описание" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="cms-field">
            <span>Исполнитель</span>
            <select className="admin-input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="cms-field">
            <span>Срок (необязательно)</span>
            <input className="admin-input" placeholder="например: 20.06" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <button className="admin-btn admin-btn--mint" type="submit" disabled={busy}>
            {busy ? 'Сохранение…' : 'Поставить задачу'}
          </button>
        </div>
      </form>
    </div>
  )
}
