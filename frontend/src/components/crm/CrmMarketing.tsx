import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'

type Campaign = {
  id?: string
  name: string
  channel: string
  status: 'active' | 'paused' | 'done'
  budget: number
  spent: number
  leads: number
}
type Funnel = { qualified: number; consultation: number; contract: number; client: number }
type LinkItem = { name: string; url: string }
type Settings = {
  links: { ads: LinkItem; meta: LinkItem; analytics: LinkItem; twogis: LinkItem }
  funnel: Funnel
  budgetPlan: number
}
type Board = {
  submissionsMonth: number
  submissionsTotal: number
  byType: { leads: number; quiz: number; turnkey: number }
  campaigns: Campaign[]
  settings: Settings
}

const CHANNELS = ['Instagram', 'Google Ads', 'Meta Ads', '2GIS', 'TikTok', 'Telegram', 'Другое']
const CAMP_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Активна', cls: 'cmp-st--active' },
  paused: { label: 'Пауза', cls: 'cmp-st--paused' },
  done: { label: 'Завершена', cls: 'cmp-st--done' },
}
const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function CrmMarketing() {
  const [b, setB] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [campEdit, setCampEdit] = useState<Campaign | 'new' | null>(null)

  const load = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/mkt/board')
    if (r.ok) setB(r.json)
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function deleteCampaign(c: Campaign) {
    if (!confirm(`Удалить кампанию «${c.name}»?`)) return
    await adminApi('POST', '/api/crm/mkt/campaigns/delete', { id: c.id })
    load()
  }

  if (loading || !b) return <p className="admin-note">Загрузка…</p>

  const s = b.settings
  const totalSpent = b.campaigns.reduce((a, c) => a + (c.spent || 0), 0)
  const totalLeads = b.campaigns.reduce((a, c) => a + (c.leads || 0), 0)
  const activeCount = b.campaigns.filter((c) => c.status === 'active').length
  const avgCpl = totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0
  const budgetPct = s.budgetPlan > 0 ? Math.min(100, Math.round((totalSpent / s.budgetPlan) * 100)) : 0

  const funnel = [
    { label: 'Заявки', value: b.submissionsMonth },
    { label: 'Квалификация', value: s.funnel.qualified },
    { label: 'Консультация', value: s.funnel.consultation },
    { label: 'Договор', value: s.funnel.contract },
    { label: 'Клиент', value: s.funnel.client },
  ]
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value))

  const sources = [
    { label: 'Лид-форма', value: b.byType.leads },
    { label: 'Экспресс-тест', value: b.byType.quiz },
    { label: 'Бизнес под ключ', value: b.byType.turnkey },
  ]
  const srcMax = Math.max(1, b.submissionsMonth)

  return (
    <div className="mkt">
      {/* Метрики месяца */}
      <div className="mkt-metrics">
        <div className="mkt-metric">
          <span className="mkt-metric__label">Заявок за месяц</span>
          <span className="mkt-metric__val">{b.submissionsMonth}</span>
          <span className="mkt-metric__sub">всего: {b.submissionsTotal}</span>
        </div>
        <div className="mkt-metric">
          <span className="mkt-metric__label">Активных кампаний</span>
          <span className="mkt-metric__val">{activeCount}</span>
          <span className="mkt-metric__sub">всего: {b.campaigns.length}</span>
        </div>
        <div className="mkt-metric">
          <span className="mkt-metric__label">Бюджет</span>
          <span className="mkt-metric__val">{money(totalSpent)} сом</span>
          <span className="mkt-metric__sub">план: {money(s.budgetPlan)} сом</span>
          <div className="mkt-metric__bar"><div style={{ width: `${budgetPct}%` }} /></div>
        </div>
        <div className="mkt-metric">
          <span className="mkt-metric__label">Средний CPL</span>
          <span className="mkt-metric__val">{money(avgCpl)} сом</span>
          <span className="mkt-metric__sub">за лид</span>
        </div>
      </div>

      <div className="mkt-grid">
        {/* ЛЕВО: каналы + источники */}
        <aside className="mkt-side">
          <span className="smm-block-title">Рекламные кабинеты</span>
          {(['ads', 'meta', 'analytics', 'twogis'] as const).map((k) => {
            const l = s.links[k]
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

          <span className="smm-block-title" style={{ marginTop: 18 }}>Источники заявок (мес.)</span>
          <div className="mkt-sources">
            {sources.map((src) => (
              <div className="mkt-src" key={src.label}>
                <div className="mkt-src__head"><span>{src.label}</span><b>{src.value}</b></div>
                <div className="mkt-src__bar"><div style={{ width: `${Math.round((src.value / srcMax) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </aside>

        {/* ЦЕНТР: воронка + кампании */}
        <section className="mkt-center">
          <div className="mkt-card">
            <span className="smm-block-title" style={{ margin: '0 0 14px' }}>Воронка продаж</span>
            <div className="funnel">
              {funnel.map((f, i) => {
                const prev = i > 0 ? funnel[i - 1].value : null
                const conv = prev && prev > 0 ? Math.round((f.value / prev) * 100) : null
                return (
                  <div className="funnel-row" key={f.label}>
                    <span className="funnel-row__label">{f.label}</span>
                    <div className="funnel-bar">
                      <div className="funnel-bar__fill" style={{ width: `${Math.max(6, Math.round((f.value / funnelMax) * 100))}%` }}>
                        {f.value}
                      </div>
                    </div>
                    <span className="funnel-row__conv">{conv !== null ? `${conv}%` : ''}</span>
                  </div>
                )
              })}
            </div>
            <p className="funnel-hint">Этапы после «Заявок» редактируются в «Настроить». «Заявки» — авто из реальных обращений за месяц.</p>
          </div>

          <div className="mkt-camp-head">
            <span className="smm-block-title" style={{ margin: 0 }}>Рекламные кампании</span>
            <button className="admin-btn admin-btn--mint" onClick={() => setCampEdit('new')}>
              <Icon name="plus" size={15} /> Кампания
            </button>
          </div>
          <div className="mkt-camp-list">
            {b.campaigns.map((c) => {
              const cpl = c.leads > 0 ? Math.round(c.spent / c.leads) : 0
              const roi = c.spent > 0 ? Math.round(((c.leads * 0) - 0)) : 0 // ROI требует выручку — показываем CPL
              void roi
              const pct = c.budget > 0 ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0
              return (
                <div className="mkt-camp" key={c.id}>
                  <div className="mkt-camp__top">
                    <span className="mkt-camp__name">{c.name}</span>
                    <span className={`cmp-st ${CAMP_STATUS[c.status]?.cls}`}>{CAMP_STATUS[c.status]?.label}</span>
                  </div>
                  <span className="mkt-camp__channel">{c.channel}</span>
                  <div className="mkt-camp__stats">
                    <div><span>Бюджет</span><b>{money(c.budget)} сом</b></div>
                    <div><span>Потрачено</span><b>{money(c.spent)} сом</b></div>
                    <div><span>Лиды</span><b>{c.leads}</b></div>
                    <div><span>CPL</span><b>{money(cpl)} сом</b></div>
                  </div>
                  <div className="mkt-camp__bar"><div style={{ width: `${pct}%` }} /></div>
                  <div className="mkt-camp__actions">
                    <button className="admin-btn admin-btn--ghost" onClick={() => setCampEdit(c)}>Изменить</button>
                    <button className="admin-btn admin-btn--danger" onClick={() => deleteCampaign(c)}>Удалить</button>
                  </div>
                </div>
              )
            })}
            {b.campaigns.length === 0 && <p className="admin-note">Кампаний нет — добавьте первую.</p>}
          </div>
        </section>
      </div>

      {campEdit && (
        <CampaignForm
          campaign={campEdit === 'new' ? null : campEdit}
          onClose={() => setCampEdit(null)}
          onSaved={() => { setCampEdit(null); load() }}
        />
      )}
      {editing && <MktSettings settings={s} onClose={() => setEditing(false)} onSaved={(ns) => { setB({ ...b, settings: ns }); setEditing(false) }} />}
    </div>
  )
}

function CampaignForm({ campaign, onClose, onSaved }: { campaign: Campaign | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Campaign>(
    campaign ?? { name: '', channel: 'Instagram', status: 'active', budget: 0, spent: 0, leads: 0 },
  )
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Campaign, v: string | number) => setF((x) => ({ ...x, [k]: v }))
  async function save() {
    if (!f.name.trim()) return
    setBusy(true)
    const r = await adminApi('POST', '/api/crm/mkt/campaigns/save', { item: f })
    setBusy(false)
    if (r.ok) onSaved()
  }
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h2 className="drawer__title">{campaign ? 'Кампания' : 'Новая кампания'}</h2>
          <button className="drawer__close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer__form">
          <label className="cms-field"><span>Название *</span>
            <input className="admin-input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></label>
          <label className="cms-field"><span>Канал</span>
            <select className="admin-input" value={f.channel} onChange={(e) => set('channel', e.target.value)}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="cms-field"><span>Статус</span>
            <select className="admin-input" value={f.status} onChange={(e) => set('status', e.target.value as Campaign['status'])}>
              {Object.entries(CAMP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></label>
          <div className="kpi-edit-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label className="cms-field"><span>Бюджет, сом</span>
              <input className="admin-input" type="number" value={f.budget} onChange={(e) => set('budget', Number(e.target.value) || 0)} /></label>
            <label className="cms-field"><span>Потрачено, сом</span>
              <input className="admin-input" type="number" value={f.spent} onChange={(e) => set('spent', Number(e.target.value) || 0)} /></label>
          </div>
          <label className="cms-field"><span>Лидов получено</span>
            <input className="admin-input" type="number" value={f.leads} onChange={(e) => set('leads', Number(e.target.value) || 0)} /></label>
          <button className="admin-btn admin-btn--mint" disabled={busy} onClick={save}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  )
}

function MktSettings({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: (s: Settings) => void }) {
  const [s, setS] = useState<Settings>(JSON.parse(JSON.stringify(settings)))
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    const r = await adminApi('POST', '/api/crm/mkt/settings', { settings: s })
    setBusy(false)
    if (r.ok) onSaved(r.json.settings)
  }
  const fkey = (k: keyof Funnel, v: number) => setS({ ...s, funnel: { ...s.funnel, [k]: v } })
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h2 className="drawer__title">Настройки маркетинга</h2>
          <button className="drawer__close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer__form">
          <label className="cms-field"><span>План бюджета на месяц, сом</span>
            <input className="admin-input" type="number" value={s.budgetPlan} onChange={(e) => setS({ ...s, budgetPlan: Number(e.target.value) || 0 })} /></label>
          <span className="drawer__form-title">Воронка (кол-во на этапах)</span>
          {([['qualified', 'Квалификация'], ['consultation', 'Консультация'], ['contract', 'Договор'], ['client', 'Клиент']] as const).map(([k, lbl]) => (
            <label className="cms-field" key={k}><span>{lbl}</span>
              <input className="admin-input" type="number" value={s.funnel[k]} onChange={(e) => fkey(k, Number(e.target.value) || 0)} /></label>
          ))}
          <span className="drawer__form-title">Рекламные кабинеты (ссылки)</span>
          {(['ads', 'meta', 'analytics', 'twogis'] as const).map((k) => (
            <label className="cms-field" key={k}><span>{s.links[k].name}</span>
              <input className="admin-input" placeholder="URL" value={s.links[k].url} onChange={(e) => setS({ ...s, links: { ...s.links, [k]: { ...s.links[k], url: e.target.value } } })} /></label>
          ))}
          <button className="admin-btn admin-btn--mint" disabled={busy} onClick={save}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  )
}
