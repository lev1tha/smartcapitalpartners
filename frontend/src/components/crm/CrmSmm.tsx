import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'

type Task = {
  id: string
  title: string
  period: 'daily' | 'weekly' | 'monthly'
  category: string
  priority: 'high' | 'medium' | 'low'
  isCompleted: boolean
  dueDate?: string
}
type Settings = {
  tools: {
    autopost: { url: string; status: string }
    design: { url: string }
    analytics: { url: string }
  }
  kpi: {
    reach: { current: number; target: number }
    followers: { current: number; target: number }
    er: { current: number; target: number }
  }
}

const PERIODS = [
  { id: 'daily', label: 'Сегодня' },
  { id: 'weekly', label: 'Неделя' },
  { id: 'monthly', label: 'Месяц' },
] as const

// Цветовое кодирование категорий (по ТЗ)
const CATEGORIES: Record<string, string> = {
  Контент: '#8b5cf6', // фиолетовый — творчество
  Аналитика: '#0ea5e9', // голубой
  Модерация: '#3b82f6', // мягкий синий — рутина
  Реклама: '#f59e0b', // оранжевый — внимание к бюджетам
}
const PRIORITIES: Record<string, { label: string; color: string }> = {
  high: { label: 'Высокий', color: '#ef4444' },
  medium: { label: 'Средний', color: '#f59e0b' },
  low: { label: 'Низкий', color: '#10b981' },
}

const today = () => new Date().toISOString().slice(0, 10)
const fmtNum = (n: number) => new Intl.NumberFormat('ru-RU').format(n)

export default function CrmSmm() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  // форма быстрого добавления
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Контент')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')

  const load = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/smm/board')
    if (r.ok) {
      setTasks(r.json.tasks ?? [])
      setSettings(r.json.settings ?? null)
    }
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const list = useMemo(() => tasks.filter((t) => t.period === tab), [tasks, tab])
  const doneCount = list.filter((t) => t.isCompleted).length

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const item = {
      title: title.trim(),
      period: tab,
      category,
      priority,
      dueDate: tab === 'daily' ? today() : '',
    }
    setTitle('')
    const r = await adminApi('POST', '/api/crm/smm/tasks/save', { item })
    if (r.ok) setTasks((ts) => [r.json.task, ...ts])
  }

  async function toggle(t: Task) {
    // оптимистично
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, isCompleted: !x.isCompleted } : x)))
    const r = await adminApi('POST', '/api/crm/smm/tasks/toggle', { id: t.id })
    if (!r.ok) load()
  }

  async function remove(t: Task) {
    setTasks((ts) => ts.filter((x) => x.id !== t.id))
    await adminApi('POST', '/api/crm/smm/tasks/delete', { id: t.id })
  }

  const isOverdue = (t: Task) =>
    t.period === 'daily' && !t.isCompleted && !!t.dueDate && t.dueDate < today()

  if (loading || !settings) return <p className="admin-note">Загрузка…</p>

  return (
    <div className="smm">
      <div className="smm-grid">
        {/* ЛЕВО: инструменты */}
        <aside className="smm-tools">
          <span className="smm-block-title">Инструменты</span>
          <a className="tool-card" href={settings.tools.autopost.url} target="_blank" rel="noreferrer">
            <span className="tool-card__top">
              <span className="tool-ico tool-ico--violet"><Icon name="refresh" size={16} /></span>
              Автопостинг <Icon name="external" size={13} className="tool-ext" />
            </span>
            <span className="tool-card__status">{settings.tools.autopost.status}</span>
          </a>
          <a className="tool-card" href={settings.tools.design.url} target="_blank" rel="noreferrer">
            <span className="tool-card__top">
              <span className="tool-ico tool-ico--pink"><Icon name="pen" size={16} /></span>
              Дизайн <Icon name="external" size={13} className="tool-ext" />
            </span>
            <span className="tool-card__status">Canva / Figma</span>
          </a>
          <a className="tool-card" href={settings.tools.analytics.url} target="_blank" rel="noreferrer">
            <span className="tool-card__top">
              <span className="tool-ico tool-ico--blue"><Icon name="trending" size={16} /></span>
              Аналитика <Icon name="external" size={13} className="tool-ext" />
            </span>
            <span className="tool-card__status">Popsters / LiveDune</span>
          </a>
          <button className="smm-settings-btn" onClick={() => setEditing(true)}>
            <Icon name="pen" size={14} /> Настроить
          </button>
        </aside>

        {/* ЦЕНТР: TODO */}
        <section className="smm-center">
          <div className="smm-tabs">
            {PERIODS.map((p) => (
              <button key={p.id} className={`smm-tab ${tab === p.id ? 'is-active' : ''}`} onClick={() => setTab(p.id)}>
                {p.label}
              </button>
            ))}
            <span className="smm-progress-label">{doneCount}/{list.length} выполнено</span>
          </div>

          <form className="smm-add" onSubmit={add}>
            <input className="smm-add__input" placeholder="Добавить задачу…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className="smm-add__sel" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.keys(CATEGORIES).map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="smm-add__sel" value={priority} onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button className="admin-btn admin-btn--mint" type="submit"><Icon name="plus" size={16} /></button>
          </form>

          <div className="smm-list">
            {list.map((t) => (
              <div className={`smm-task ${t.isCompleted ? 'is-done' : ''}`} key={t.id}>
                <button className={`smm-check ${t.isCompleted ? 'is-on' : ''}`} onClick={() => toggle(t)} aria-label="Готово">
                  {t.isCompleted && <Icon name="check" size={13} />}
                </button>
                <span className="smm-task__title">{t.title}</span>
                <span className="smm-cat" style={{ background: (CATEGORIES[t.category] ?? '#999') + '1a', color: CATEGORIES[t.category] ?? '#999' }}>
                  {t.category}
                </span>
                <span className="smm-prio" title={`Приоритет: ${PRIORITIES[t.priority]?.label}`}>
                  <span className="smm-prio__dot" style={{ background: PRIORITIES[t.priority]?.color }} />
                  {PRIORITIES[t.priority]?.label}
                </span>
                {isOverdue(t) && <span className="smm-overdue">Просрочено</span>}
                <button className="smm-del" onClick={() => remove(t)} aria-label="Удалить"><Icon name="trash" size={14} /></button>
              </div>
            ))}
            {list.length === 0 && <p className="admin-note">Нет задач — добавьте первую сверху.</p>}
          </div>
        </section>

        {/* ПРАВО: KPI */}
        <aside className="smm-kpi">
          <span className="smm-block-title"><Icon name="target" size={15} /> KPI месяца</span>
          <KpiBar label="Охваты" current={settings.kpi.reach.current} target={settings.kpi.reach.target} />
          <KpiBar label="Подписчики" current={settings.kpi.followers.current} target={settings.kpi.followers.target} delta />
          <KpiBar label="Вовлечённость (ER)" current={settings.kpi.er.current} target={settings.kpi.er.target} suffix="%" />
        </aside>
      </div>

      {editing && (
        <SettingsDrawer
          settings={settings}
          onClose={() => setEditing(false)}
          onSaved={(s) => { setSettings(s); setEditing(false) }}
        />
      )}
    </div>
  )
}

function KpiBar({ label, current, target, suffix = '', delta = false }: { label: string; current: number; target: number; suffix?: string; delta?: boolean }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return (
    <div className="kpi-item">
      <div className="kpi-item__head">
        <span>{label}</span>
        <span className="kpi-item__val">
          {delta && current > 0 ? '+' : ''}{fmtNum(current)}{suffix} <span className="kpi-item__target">/ {fmtNum(target)}{suffix}</span>
        </span>
      </div>
      <div className="kpi-bar"><div className="kpi-bar__fill" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function SettingsDrawer({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: (s: Settings) => void }) {
  const [s, setS] = useState<Settings>(JSON.parse(JSON.stringify(settings)))
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const r = await adminApi('POST', '/api/crm/smm/settings', { settings: s })
    setBusy(false)
    if (r.ok) onSaved(r.json.settings)
  }

  const num = (v: string) => Number(v) || 0

  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h2 className="drawer__title">Настройки SMM</h2>
          <button className="drawer__close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer__form">
          <span className="drawer__form-title">Инструменты</span>
          <label className="cms-field"><span>Автопостинг — ссылка</span>
            <input className="admin-input" value={s.tools.autopost.url} onChange={(e) => setS({ ...s, tools: { ...s.tools, autopost: { ...s.tools.autopost, url: e.target.value } } })} /></label>
          <label className="cms-field"><span>Статус (ближайший пост)</span>
            <input className="admin-input" value={s.tools.autopost.status} onChange={(e) => setS({ ...s, tools: { ...s.tools, autopost: { ...s.tools.autopost, status: e.target.value } } })} /></label>
          <label className="cms-field"><span>Дизайн — ссылка</span>
            <input className="admin-input" value={s.tools.design.url} onChange={(e) => setS({ ...s, tools: { ...s.tools, design: { url: e.target.value } } })} /></label>
          <label className="cms-field"><span>Аналитика — ссылка</span>
            <input className="admin-input" value={s.tools.analytics.url} onChange={(e) => setS({ ...s, tools: { ...s.tools, analytics: { url: e.target.value } } })} /></label>

          <span className="drawer__form-title">KPI (текущее / цель)</span>
          {([['reach', 'Охваты'], ['followers', 'Подписчики'], ['er', 'ER, %']] as const).map(([k, lbl]) => (
            <div className="kpi-edit-row" key={k}>
              <span>{lbl}</span>
              <input className="admin-input" type="number" value={s.kpi[k].current} onChange={(e) => setS({ ...s, kpi: { ...s.kpi, [k]: { ...s.kpi[k], current: num(e.target.value) } } })} />
              <input className="admin-input" type="number" value={s.kpi[k].target} onChange={(e) => setS({ ...s, kpi: { ...s.kpi, [k]: { ...s.kpi[k], target: num(e.target.value) } } })} />
            </div>
          ))}
          <button className="admin-btn admin-btn--mint" disabled={busy} onClick={save}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  )
}
