import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'

type Task = {
  id: string
  title: string
  period: 'daily' | 'monthly' | 'quarterly' | 'yearly'
  reportingPeriod?: string
  deadline?: string
  status: 'not_started' | 'in_progress' | 'formed' | 'submitted'
  receiptFile?: string
}
type Doc = { id: string; counterparty: string; type: string; status: 'requested' | 'signed' | 'missing' }
type LinkItem = { name: string; url: string }
type Settings = {
  ecpValidUntil: string
  links: { sti: LinkItem; esf: LinkItem; ettn: LinkItem; bank: LinkItem }
}

const PERIODS = [
  { id: 'daily', label: 'День' },
  { id: 'monthly', label: 'Месяц' },
  { id: 'quarterly', label: 'Квартал' },
  { id: 'yearly', label: 'Год' },
] as const

const STATUSES: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Не начато', color: '#94a3b8' },
  in_progress: { label: 'В процессе', color: '#f59e0b' },
  formed: { label: 'На подписи', color: '#3b82f6' },
  submitted: { label: 'Сдано', color: '#10b981' },
}
const DOC_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Запрошено', cls: 'doc-st--req' },
  signed: { label: 'Подписано', cls: 'doc-st--ok' },
  missing: { label: 'Отсутствует', cls: 'doc-st--miss' },
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const daysLeft = (deadline?: string) => {
  if (!deadline) return null
  const d = new Date(deadline + 'T00:00:00')
  const t = new Date(todayStr() + 'T00:00:00')
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}
const deadlineClass = (d?: string) => {
  const n = daysLeft(d)
  if (n === null) return ''
  if (n < 3) return 'dl--crit'
  if (n <= 7) return 'dl--warn'
  return 'dl--ok'
}
const fmtDate = (s?: string) => {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CrmAccounting() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<'daily' | 'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [genMsg, setGenMsg] = useState('')

  const load = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/acc/board')
    if (r.ok) {
      setTasks(r.json.tasks ?? [])
      setDocs(r.json.docs ?? [])
      setSettings(r.json.settings ?? null)
    }
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const ofType = useMemo(() => tasks.filter((t) => t.period === tab), [tasks, tab])
  const periodsAvail = useMemo(
    () => Array.from(new Set(ofType.map((t) => t.reportingPeriod).filter(Boolean))).sort().reverse() as string[],
    [ofType],
  )
  const list = useMemo(
    () => (periodFilter === 'all' ? ofType : ofType.filter((t) => t.reportingPeriod === periodFilter)),
    [ofType, periodFilter],
  )
  const submittedCount = list.filter((t) => t.status === 'submitted').length

  // Налоговый радар — ближайший несданный дедлайн
  const radar = useMemo(() => {
    const upcoming = tasks
      .filter((t) => t.status !== 'submitted' && t.deadline)
      .map((t) => ({ t, n: daysLeft(t.deadline)! }))
      .sort((a, b) => a.n - b.n)[0]
    return upcoming ?? null
  }, [tasks])

  const ecpDays = settings?.ecpValidUntil ? daysLeft(settings.ecpValidUntil) : null

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const item = {
      title: title.trim(),
      period: tab,
      deadline,
      reportingPeriod: deadline ? deadline.slice(0, 7) : new Date().toISOString().slice(0, 7),
      status: 'not_started',
    }
    setTitle('')
    setDeadline('')
    const r = await adminApi('POST', '/api/crm/acc/tasks/save', { item })
    if (r.ok) setTasks((ts) => [r.json.task, ...ts])
  }

  async function generate() {
    setGenMsg('')
    const month = new Date().toISOString().slice(0, 7)
    const r = await adminApi('POST', '/api/crm/acc/generate', { month })
    if (r.ok) {
      setGenMsg(r.json.created > 0 ? `Создано задач: ${r.json.created}` : 'Задачи на месяц уже созданы')
      load()
      setTimeout(() => setGenMsg(''), 4000)
    }
  }

  async function setStatus(t: Task, status: string) {
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: status as Task['status'] } : x)))
    const r = await adminApi('POST', '/api/crm/acc/tasks/status', { id: t.id, status })
    if (!r.ok) load()
  }
  async function removeTask(t: Task) {
    setTasks((ts) => ts.filter((x) => x.id !== t.id))
    await adminApi('POST', '/api/crm/acc/tasks/delete', { id: t.id })
  }
  async function uploadReceipt(t: Task, file: File) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('id', t.id)
    const r = await adminApi('POST', '/api/crm/acc/tasks/receipt', fd, true)
    if (r.ok && r.json.task) setTasks((ts) => ts.map((x) => (x.id === t.id ? r.json.task : x)))
  }

  if (loading || !settings) return <p className="admin-note">Загрузка…</p>

  return (
    <div className="acc">
      {/* Налоговый радар */}
      <div className={`acc-radar ${radar ? deadlineClass(radar.t.deadline) : ''}`}>
        <span className="acc-radar__ico"><Icon name="alert" size={20} /></span>
        {radar ? (
          <span className="acc-radar__text">
            {radar.n < 0
              ? <>Просрочено на <b>{Math.abs(radar.n)} дн.</b>: «{radar.t.title}»</>
              : <>До дедлайна «{radar.t.title}» осталось <b>{radar.n === 0 ? 'меньше дня' : `${radar.n} дн.`}</b> ({fmtDate(radar.t.deadline)})</>}
          </span>
        ) : (
          <span className="acc-radar__text">Нет ближайших дедлайнов</span>
        )}
      </div>

      <div className="acc-grid">
        {/* ЛЕВО: доступы */}
        <aside className="acc-side">
          <span className="smm-block-title">Доступы</span>
          <div className={`ecp ${ecpDays !== null && ecpDays < 30 ? 'ecp--warn' : ''}`}>
            <span className="ecp__label">ЭЦП (Рутокен / Облако)</span>
            <span className="ecp__val">
              {settings.ecpValidUntil
                ? <>Действует до {fmtDate(settings.ecpValidUntil)}{ecpDays !== null && ecpDays < 30 && <> · осталось {ecpDays} дн.</>}</>
                : 'Срок не указан'}
            </span>
          </div>
          {(['sti', 'esf', 'ettn', 'bank'] as const).map((k) => {
            const l = settings.links[k]
            return l.url ? (
              <a key={k} className="acc-link" href={l.url} target="_blank" rel="noreferrer">
                {l.name} <Icon name="external" size={13} className="tool-ext" />
              </a>
            ) : (
              <span key={k} className="acc-link acc-link--empty">{l.name} <span>—</span></span>
            )
          })}
          <button className="smm-settings-btn" onClick={() => setEditing(true)}>
            <Icon name="pen" size={14} /> Настроить
          </button>
        </aside>

        {/* ЦЕНТР: чек-лист */}
        <section className="smm-center">
          <div className="smm-tabs">
            {PERIODS.map((p) => (
              <button key={p.id} className={`smm-tab ${tab === p.id ? 'is-active' : ''}`} onClick={() => { setTab(p.id); setPeriodFilter('all') }}>
                {p.label}
              </button>
            ))}
            {periodsAvail.length > 0 && (
              <select className="acc-period-sel" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
                <option value="all">Все периоды</option>
                {periodsAvail.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <button className="acc-gen-btn" onClick={generate} title="Создать стандартные отчёты КР на текущий месяц">
              <Icon name="refresh" size={14} /> Сгенерировать отчёты
            </button>
            <span className="smm-progress-label">Сдано: {submittedCount} из {list.length}</span>
          </div>
          {genMsg && <p className="acc-gen-msg">{genMsg}</p>}

          <form className="smm-add" onSubmit={addTask}>
            <input className="smm-add__input" placeholder="Новый отчёт / задача…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="smm-add__sel acc-date" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} title="Дедлайн" />
            <button className="admin-btn admin-btn--mint" type="submit"><Icon name="plus" size={16} /></button>
          </form>

          <div className="smm-list">
            {list.map((t) => {
              const dn = daysLeft(t.deadline)
              return (
                <div className={`acc-task ${t.status === 'submitted' ? 'is-done' : ''}`} key={t.id}>
                  <div className="acc-task__main">
                    <span className="acc-task__title">{t.title}</span>
                    <div className="acc-task__meta">
                      {t.deadline && (
                        <span className={`acc-dl ${deadlineClass(t.deadline)}`}>
                          <Icon name="clock" size={12} /> {fmtDate(t.deadline)}
                          {t.status !== 'submitted' && dn !== null && <> · {dn < 0 ? `просрочка ${Math.abs(dn)} дн.` : `${dn} дн.`}</>}
                        </span>
                      )}
                      {t.receiptFile && (
                        <a className="acc-receipt-link" href={t.receiptFile} target="_blank" rel="noreferrer">
                          <Icon name="file" size={12} /> квиток
                        </a>
                      )}
                    </div>
                  </div>
                  <select
                    className="acc-status-sel"
                    value={t.status}
                    style={{ color: STATUSES[t.status].color, borderColor: STATUSES[t.status].color + '55' }}
                    onChange={(e) => setStatus(t, e.target.value)}
                  >
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <label className="acc-upload" title="Прикрепить квиток (PDF)">
                    <Icon name="upload" size={16} />
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={(e) => e.target.files?.[0] && uploadReceipt(t, e.target.files[0])} />
                  </label>
                  <button className="smm-del" onClick={() => removeTask(t)} aria-label="Удалить"><Icon name="trash" size={14} /></button>
                </div>
              )
            })}
            {list.length === 0 && <p className="admin-note">Нет задач в этом периоде — добавьте сверху.</p>}
          </div>

          {/* Контроль первичной документации */}
          <DocsBlock docs={docs} onChange={setDocs} />
        </section>
      </div>

      {editing && (
        <AccSettings settings={settings} onClose={() => setEditing(false)} onSaved={(s) => { setSettings(s); setEditing(false) }} />
      )}
    </div>
  )
}

/* ---------- Первичная документация ---------- */
function DocsBlock({ docs, onChange }: { docs: Doc[]; onChange: (d: Doc[]) => void }) {
  const [counterparty, setCounterparty] = useState('')
  const [type, setType] = useState('Акт сверки')
  const [status, setStatus] = useState('requested')
  const signed = docs.filter((d) => d.status === 'signed').length

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!counterparty.trim()) return
    const r = await adminApi('POST', '/api/crm/acc/docs/save', { item: { counterparty, type, status } })
    if (r.ok) {
      onChange([...docs, r.json.doc])
      setCounterparty('')
    }
  }
  async function remove(d: Doc) {
    onChange(docs.filter((x) => x.id !== d.id))
    await adminApi('POST', '/api/crm/acc/docs/delete', { id: d.id })
  }

  return (
    <div className="acc-docs">
      <div className="acc-docs__head">
        <span className="smm-block-title" style={{ margin: 0 }}>Контроль первичной документации</span>
        <span className="acc-docs__progress">Подписано: {signed}/{docs.length}</span>
      </div>
      <form className="acc-docs__add" onSubmit={add}>
        <input className="smm-add__input" placeholder="Контрагент" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        <select className="smm-add__sel" value={type} onChange={(e) => setType(e.target.value)}>
          {['Акт сверки', 'Счёт-фактура', 'Накладная', 'Договор'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="smm-add__sel" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="admin-btn admin-btn--mint" type="submit"><Icon name="plus" size={16} /></button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Контрагент</th><th>Документ</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.counterparty}</td>
                <td>{d.type}</td>
                <td><span className={`doc-st ${DOC_STATUS[d.status]?.cls}`}>{DOC_STATUS[d.status]?.label}</span></td>
                <td><button className="smm-del" onClick={() => remove(d)}><Icon name="trash" size={14} /></button></td>
              </tr>
            ))}
            {docs.length === 0 && <tr><td colSpan={4} className="admin-empty">Документы не отслеживаются</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- Настройки ---------- */
function AccSettings({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: (s: Settings) => void }) {
  const [s, setS] = useState<Settings>(JSON.parse(JSON.stringify(settings)))
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    const r = await adminApi('POST', '/api/crm/acc/settings', { settings: s })
    setBusy(false)
    if (r.ok) onSaved(r.json.settings)
  }
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h2 className="drawer__title">Настройки бухгалтерии</h2>
          <button className="drawer__close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer__form">
          <label className="cms-field"><span>Срок действия ЭЦП</span>
            <input className="admin-input" type="date" value={s.ecpValidUntil} onChange={(e) => setS({ ...s, ecpValidUntil: e.target.value })} /></label>
          <span className="drawer__form-title">Ссылки на гос. порталы</span>
          {(['sti', 'esf', 'ettn', 'bank'] as const).map((k) => (
            <label className="cms-field" key={k}><span>{s.links[k].name}</span>
              <input className="admin-input" placeholder="URL" value={s.links[k].url} onChange={(e) => setS({ ...s, links: { ...s.links, [k]: { ...s.links[k], url: e.target.value } } })} /></label>
          ))}
          <button className="admin-btn admin-btn--mint" disabled={busy} onClick={save}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  )
}
