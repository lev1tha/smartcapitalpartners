/**
 * Главный экран: что требует внимания сегодня (дедлайны), состояние воронок,
 * финансы месяца. Поля, скрытые правами, приходят как null и показываются замком.
 */
import { useEffect, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'
import { useNav } from './nav'
import { dueLabel, fmtDate, fmtShort, plural } from './format'
import { Money, Reveal } from './ui'

type MiniTask = { id: string; title: string; status: string; dueDate: string; priority: string; assignee: string; clientName: string }
type Stage = { id: string; label: string; count: number; amount: number | null }
type Pipe = { id: string; label: string; stages: Stage[] }
type Deal = { id: string; title: string; clientName: string; stage: string; pipeline: string; amount: number | null; currency: string; updatedAt: string }
type Dash = {
  today: string
  tasks: { open: number; review: number; overdue: MiniTask[]; soon: MiniTask[] }
  pipeline?: { open: number; wonMonth: number; openAmount: number | null; funnel: Pipe[]; recent: Deal[] }
  clients?: { total: number; active: number }
  finance?: { month: { income: number; expense: number; net: number }; all: { income: number; expense: number; net: number } }
}

const STAGE_COLORS = ['#528aeb', '#6b9cf2', '#8fb4f6', '#a78bfa', '#34d399', '#64748b']

export default function CrmDashboard({ userName, roles }: { userName: string; roles: Record<string, string> }) {
  const [data, setData] = useState<Dash | null>(null)
  const [err, setErr] = useState('')
  const nav = useNav()

  useEffect(() => {
    adminApi('GET', '/api/crm/dashboard').then((r) => (r.ok ? setData(r.json) : setErr(r.json?.error ?? 'Не удалось загрузить')))
  }, [])

  if (err) return <p className="admin-note admin-note--err">{err}</p>
  if (!data) return <p className="admin-note">Загрузка…</p>

  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  const first = userName.split(' ')[0]
  const attention = data.tasks.overdue.length

  return (
    <div className="dash">
      <Reveal>
        <div className="dash__hello">
          <h2>{greeting}, {first}</h2>
          <span>
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            {attention > 0 ? ` · ${attention} ${plural(attention, 'задача просрочена', 'задачи просрочены', 'задач просрочено')}` : ' · просроченных задач нет'}
          </span>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="tiles">
          <Tile label="Открытые задачи" icon="board" value={data.tasks.open} sub={`${data.tasks.review} на проверке`} onClick={() => nav('section', 'tasks')} />
          <Tile label="Просрочено" icon="alert" value={attention} tone={attention ? 'err' : undefined} sub={attention ? 'нужно внимание' : 'всё в срок'} onClick={() => nav('section', 'tasks')} />
          {data.pipeline && (
            <>
              <Tile label="Сделки в работе" icon="briefcase" value={data.pipeline.open} sub={`${data.pipeline.wonMonth} закрыто в этом месяце`} onClick={() => nav('section', 'deals')} />
              <Tile label="Сумма в работе" icon="coins" value={<Money value={data.pipeline.openAmount} compact />} accent onClick={() => nav('section', 'deals')} />
            </>
          )}
          {data.finance && (
            <Tile label="P&L за месяц" icon="trending" value={<Money value={data.finance.month.net} signed compact />} tone={data.finance.month.net < 0 ? 'err' : undefined}
              sub={`+${fmtShort(data.finance.month.income)} / −${fmtShort(data.finance.month.expense)}`} />
          )}
          {data.clients && <Tile label="Клиенты" icon="users" value={data.clients.total} sub={`${data.clients.active} активных`} onClick={() => nav('section', 'clients')} />}
        </div>
      </Reveal>

      <div className="dash__grid">
        <Reveal delay={0.1}>
          <div className="panel">
            <h3>Дедлайны <small>ближайшие 7 дней</small></h3>
            {data.tasks.overdue.length === 0 && data.tasks.soon.length === 0 ? (
              <p className="hint">Ничего не горит. Можно заняться стратегией.</p>
            ) : (
              <div className="row-list">
                {[...data.tasks.overdue, ...data.tasks.soon].map((t) => {
                  const due = dueLabel(t.dueDate)
                  return (
                    <button key={t.id} className="row-item" onClick={() => nav('task', t.id)}>
                      <span className={`prio prio--${t.priority || 'normal'}`} />
                      <span className="row-item__main">
                        <span className="row-item__title">{t.title}</span>
                        <span className="row-item__sub">{roles[t.assignee] ?? t.assignee}{t.clientName ? ` · ${t.clientName}` : ''}</span>
                      </span>
                      {due && <span className={`chip chip--${due.tone} chip--sm`}>{due.text}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Reveal>

        {data.pipeline && (
          <Reveal delay={0.15}>
            <div className="panel">
              <h3>Воронки <small>сделок по этапам</small></h3>
              <div className="funnel">
                {data.pipeline.funnel.map((p) => {
                  const total = p.stages.reduce((s, x) => s + x.count, 0)
                  return (
                    <div className="funnel__pipe" key={p.id}>
                      <header><b>{p.label}</b><span>{total} {plural(total, 'сделка', 'сделки', 'сделок')}</span></header>
                      <div className="funnel__bar">
                        {total === 0 ? <div className="funnel__seg" style={{ flex: 1, color: 'var(--color-muted-soft)', fontWeight: 500 }}>пусто</div>
                          : p.stages.map((s, i) => s.count > 0 && (
                            <div key={s.id} className="funnel__seg" style={{ flex: s.count, background: STAGE_COLORS[i % STAGE_COLORS.length] }} title={`${s.label}: ${s.count}`}>{s.count}</div>
                          ))}
                      </div>
                      <div className="funnel__legend">
                        {p.stages.map((s, i) => (
                          <span key={s.id}><i style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }} />{s.label}{s.amount !== null && s.amount > 0 ? ` · ${fmtShort(s.amount)}` : ''}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {data.pipeline && data.pipeline.recent.length > 0 && (
        <Reveal delay={0.2}>
          <div className="panel">
            <h3>Недавние сделки <small>по дате изменения</small></h3>
            <div className="row-list">
              {data.pipeline.recent.map((d) => (
                <button key={d.id} className="row-item" onClick={() => nav('deal', d.id)}>
                  <Icon name="briefcase" size={16} />
                  <span className="row-item__main">
                    <span className="row-item__title">{d.title}</span>
                    <span className="row-item__sub">{d.clientName} · {fmtDate(d.updatedAt)}</span>
                  </span>
                  <span className="row-item__right"><Money value={d.amount} currency={d.currency} /></span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  )
}

function Tile({ label, icon, value, sub, tone, accent, onClick }: {
  label: string; icon: string; value: React.ReactNode; sub?: string; tone?: 'warn' | 'err'; accent?: boolean; onClick?: () => void
}) {
  return (
    <div className={`tile ${tone ? `tile--${tone}` : ''} ${accent ? 'tile--accent' : ''} ${onClick ? 'is-link' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && onClick()}>
      <span className="tile__label"><Icon name={icon} size={14} /> {label}</span>
      <span className="tile__value">{value}</span>
      {sub && <span className="tile__sub">{sub}</span>}
    </div>
  )
}
