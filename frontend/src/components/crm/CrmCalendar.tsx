import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'

type Account = { id: string; name: string; platform?: string }
type Post = {
  id?: string
  accountId: string
  date: string
  type: string
  title: string
  note?: string
  status: string
  link?: string
  createdBy?: string
}

const TYPES = [
  { id: 'reels', label: 'Reels' },
  { id: 'post', label: 'Пост' },
  { id: 'story', label: 'Сторис' },
  { id: 'carousel', label: 'Карусель' },
  { id: 'live', label: 'Эфир' },
]
const STATUSES = [
  { id: 'idea', label: 'Идея' },
  { id: 'scheduled', label: 'Запланировано' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'published', label: 'Опубликовано' },
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const pad = (n: number) => String(n).padStart(2, '0')

export default function CrmCalendar() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [active, setActive] = useState<string>('')
  const [posts, setPosts] = useState<Post[]>([])
  const [role, setRole] = useState('')
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [editing, setEditing] = useState<Post | null>(null)
  const [addingAccount, setAddingAccount] = useState(false)
  const [dragPost, setDragPost] = useState<string | null>(null)
  const [overDate, setOverDate] = useState<string | null>(null)

  const canManageAccounts = ['director', 'manager', 'marketer'].includes(role)

  const loadAccounts = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/accounts')
    if (r.ok) {
      const list: Account[] = r.json.accounts ?? []
      setAccounts(list)
      setActive((a) => a || (list[0]?.id ?? ''))
    }
  }, [])

  const loadPosts = useCallback(async (accountId: string) => {
    if (!accountId) {
      setPosts([])
      return
    }
    const r = await adminApi('GET', `/api/crm/calendar?accountId=${accountId}`)
    if (r.ok) setPosts(r.json.posts ?? [])
  }, [])

  useEffect(() => {
    adminApi('GET', '/api/crm/me').then((r) => r.ok && setRole(r.json.user.role))
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    loadPosts(active)
  }, [active, loadPosts])

  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {}
    for (const p of posts) (map[p.date] ??= []).push(p)
    return map
  }, [posts])

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startWeekday = (first.getDay() + 6) % 7
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const arr: (number | null)[] = []
    for (let i = 0; i < startWeekday; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    return arr
  }, [cursor])

  const dateStr = (d: number) => `${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`
  const shiftMonth = (delta: number) =>
    setCursor((c) => {
      const m = c.m + delta
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })

  async function savePost(p: Post) {
    const r = await adminApi('POST', '/api/crm/calendar/save', { item: { ...p, accountId: active } })
    if (r.ok) {
      setEditing(null)
      loadPosts(active)
    }
  }

  // Перенос поста на другую дату (drag-and-drop)
  async function movePost(postId: string, newDate: string) {
    const post = posts.find((p) => p.id === postId)
    if (!post || post.date === newDate) return
    // оптимистично переставляем сразу
    setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, date: newDate } : p)))
    const r = await adminApi('POST', '/api/crm/calendar/save', { item: { ...post, date: newDate, accountId: active } })
    if (!r.ok) loadPosts(active) // откат при ошибке
  }
  async function deletePost(id?: string) {
    if (!id || !confirm('Удалить пост?')) return
    const r = await adminApi('POST', '/api/crm/calendar/delete', { id })
    if (r.ok) {
      setEditing(null)
      loadPosts(active)
    }
  }
  async function saveAccount(name: string, platform: string) {
    const r = await adminApi('POST', '/api/crm/accounts/save', { item: { name, platform } })
    if (r.ok) {
      setAddingAccount(false)
      await loadAccounts()
      setActive(r.json.account.id)
    }
  }

  return (
    <div className="cal">
      {/* Аккаунты */}
      <div className="cal-accounts">
        {accounts.map((a) => (
          <button key={a.id} className={`crm-chip ${active === a.id ? 'is-active' : ''}`} onClick={() => setActive(a.id)}>
            {a.name}
          </button>
        ))}
        {canManageAccounts && (
          <button className="cal-add-acc" onClick={() => setAddingAccount(true)}>
            <Icon name="plus" size={15} /> Аккаунт
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="admin-note">Добавьте первый аккаунт, чтобы планировать контент.</p>
      ) : (
        <>
          {/* Навигация по месяцам */}
          <div className="cal-nav">
            <button className="cal-navbtn" onClick={() => shiftMonth(-1)}>‹</button>
            <span className="cal-month">{MONTHS[cursor.m]} {cursor.y}</span>
            <button className="cal-navbtn" onClick={() => shiftMonth(1)}>›</button>
            <span className="cal-hint">Кликните по дню, чтобы добавить пост</span>
          </div>

          {/* Сетка */}
          <div className="cal-grid">
            {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
            {cells.map((d, i) =>
              d === null ? (
                <div key={`e${i}`} className="cal-cell cal-cell--empty" />
              ) : (
                <div
                  key={d}
                  className={`cal-cell ${overDate === dateStr(d) ? 'is-over' : ''}`}
                  onClick={() => setEditing({ accountId: active, date: dateStr(d), type: 'post', title: '', status: 'idea' })}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (overDate !== dateStr(d)) setOverDate(dateStr(d))
                  }}
                  onDragLeave={() => setOverDate((o) => (o === dateStr(d) ? null : o))}
                  onDrop={() => {
                    const id = dragPost
                    const target = dateStr(d)
                    setDragPost(null)
                    setOverDate(null)
                    if (id) movePost(id, target)
                  }}
                >
                  <span className="cal-day">{d}</span>
                  <div className="cal-posts">
                    {(postsByDate[dateStr(d)] ?? []).map((p) => (
                      <button
                        key={p.id}
                        className={`cal-post cal-post--${p.type} st-dot-${p.status} ${dragPost === p.id ? 'is-dragging' : ''}`}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          setDragPost(p.id ?? null)
                        }}
                        onDragEnd={() => {
                          setDragPost(null)
                          setOverDate(null)
                        }}
                        onClick={(e) => { e.stopPropagation(); setEditing(p) }}
                        title="Перетащите на другой день, чтобы перенести"
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Легенда */}
          <div className="cal-legend">
            {TYPES.map((t) => (
              <span key={t.id} className="cal-leg"><span className={`cal-dot cal-post--${t.id}`} />{t.label}</span>
            ))}
          </div>
        </>
      )}

      {editing && (
        <PostEditor post={editing} onClose={() => setEditing(null)} onSave={savePost} onDelete={deletePost} />
      )}
      {addingAccount && (
        <AccountForm onClose={() => setAddingAccount(false)} onSave={saveAccount} />
      )}
    </div>
  )
}

/* ---------- Редактор поста ---------- */
function PostEditor({
  post, onClose, onSave, onDelete,
}: {
  post: Post
  onClose: () => void
  onSave: (p: Post) => void
  onDelete: (id?: string) => void
}) {
  const [form, setForm] = useState<Post>(post)
  const set = (k: keyof Post, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h2 className="drawer__title">{post.id ? 'Пост' : 'Новый пост'} · {form.date}</h2>
          <button className="drawer__close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer__form">
          <input className="admin-input" placeholder="Тема поста *" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
          <label className="cms-field">
            <span>Формат</span>
            <select className="admin-input" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="cms-field">
            <span>Статус</span>
            <select className="admin-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="cms-field">
            <span>Дата</span>
            <input className="admin-input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          <textarea className="admin-input cms-textarea" rows={3} placeholder="Заметка / сценарий" value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} />
          <input className="admin-input" placeholder="Ссылка на материал / готовый пост" value={form.link ?? ''} onChange={(e) => set('link', e.target.value)} />
          <div className="cal-editor-actions">
            <button className="admin-btn admin-btn--mint" disabled={!form.title.trim()} onClick={() => onSave(form)}>Сохранить</button>
            {post.id && (
              <button className="admin-btn admin-btn--danger" onClick={() => onDelete(post.id)}>Удалить</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Форма аккаунта ---------- */
function AccountForm({ onClose, onSave }: { onClose: () => void; onSave: (name: string, platform: string) => void }) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('Instagram')
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h2 className="drawer__title">Новый аккаунт</h2>
          <button className="drawer__close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer__form">
          <input className="admin-input" placeholder="Название (например: MF PRO — Instagram)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <label className="cms-field">
            <span>Платформа</span>
            <select className="admin-input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {['Instagram', 'TikTok', 'YouTube', 'Telegram', 'Facebook', 'Другое'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <button className="admin-btn admin-btn--mint" disabled={!name.trim()} onClick={() => onSave(name, platform)}>Создать аккаунт</button>
        </div>
      </div>
    </div>
  )
}
