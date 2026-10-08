import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import Icon from '../components/Icon'
import AdminCatalog from '../components/AdminCatalog'
import CrmTasks from '../components/crm/CrmTasks'
import CrmSubmissions from '../components/crm/CrmSubmissions'
import CrmIdeas from '../components/crm/CrmIdeas'
import CrmUsers from '../components/crm/CrmUsers'
import CrmCalendar from '../components/crm/CrmCalendar'
import CrmSmm from '../components/crm/CrmSmm'
import CrmAccounting from '../components/crm/CrmAccounting'
import CrmMarketing from '../components/crm/CrmMarketing'
import CrmDashboard from '../components/crm/CrmDashboard'
import CrmClients from '../components/crm/CrmClients'
import CrmDeals from '../components/crm/CrmDeals'
import CrmDocs from '../components/crm/CrmDocs'
import CrmSettings from '../components/crm/CrmSettings'
import NotificationCenter from '../components/crm/NotificationCenter'
import CommandPalette from '../components/crm/CommandPalette'
import { NavCtx, SECTION_OF, type EntityType, type Section } from '../components/crm/nav'
import { ThemeProvider, ThemeToggle } from '../components/crm/ui'
import { adminApi, getToken, setToken, clearToken, UNAUTHORIZED_EVENT } from '../data/adminApi'
import '../styles/admin.css'
import '../styles/crm.css'

type User = { id: string; name: string; role: string }
type Me = {
  user: User; roleLabel: string; isManager: boolean; access: string[]
  sections: Record<string, boolean>; fields: Record<string, Record<string, { view: boolean; edit: boolean }>>; unreadNotifications: number
}
type Pipelines = Record<string, { label: string; stages: { id: string; label: string }[] }>

const ROLE_HINTS: Record<string, string> = {
  tasks: 'Задачи', dashboard: 'Обзор', deals: 'Сделки', clients: 'Клиенты', docs: 'База знаний',
}

export default function Admin() {
  return (
    <ThemeProvider>
      <AdminInner />
    </ThemeProvider>
  )
}

function AdminInner() {
  const [authed, setAuthed] = useState<boolean>(() => !!getToken())
  const [me, setMe] = useState<Me | null>(null)
  const [section, setSection] = useState<Section>('dashboard')
  const [focus, setFocus] = useState<{ type: EntityType; id: string; n: number } | null>(null)
  const [palette, setPalette] = useState(false)
  const [pipelines, setPipelines] = useState<Pipelines>({})

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [busy, setBusy] = useState(false)

  const logout = useCallback(async (remote = true) => {
    if (remote) await adminApi('POST', '/api/admin/logout')
    clearToken(); setAuthed(false); setMe(null)
  }, [])

  const loadMe = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/me')
    if (r.ok) setMe(r.json); else if (r.status === 401) logout(false)
  }, [logout])

  useEffect(() => { if (authed) loadMe() }, [authed, loadMe])
  useEffect(() => {
    const onUnauthorized = () => logout(false)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [logout])
  useEffect(() => {
    if (me?.sections.deals) adminApi('GET', '/api/crm/deals?pipeline=sales').then((r) => r.ok && setPipelines(r.json.pipelines ?? {}))
  }, [me?.sections.deals])

  // Cmd+K / Ctrl+K — быстрый поиск
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** Переход к сущности из уведомления, поиска или связанной карточки. */
  const navigate = useCallback((type: EntityType, id: string) => {
    if (type === 'section') { setSection(id as Section); setFocus(null); return }
    setSection(SECTION_OF[type])
    setFocus((f) => ({ type, id, n: (f?.n ?? 0) + 1 }))
  }, [])

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setLoginErr('')
    const r = await adminApi('POST', '/api/admin/login', { login, password })
    setBusy(false)
    if (r.ok && r.json?.token) { setToken(r.json.token); setPassword(''); setAuthed(true) }
    else setLoginErr(r.json?.error ?? 'Ошибка входа. Запущен ли бэкенд?')
  }

  /* ---------- LOGIN ---------- */
  if (!authed) {
    return (
      <div className="admin-login">
        <Seo title="CRM — вход" description="Панель сотрудников Smart Capital Partners" path="/admin" noindex />
        <form className="admin-login__card" onSubmit={doLogin}>
          <div className="admin-login__brand">
            <img src="/logo-emblem.svg" alt="" className="admin-login__emblem" />
            Smart Capital Partners
          </div>
          <h1>Вход для сотрудников</h1>
          <input className="admin-input" placeholder="Логин" value={login} onChange={(e) => setLogin(e.target.value)} autoFocus autoCapitalize="none" autoComplete="username" />
          <input className="admin-input" type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 10 }} autoComplete="current-password" />
          {loginErr && <p className="admin-login__error">{loginErr}</p>}
          <button className="admin-btn" type="submit" disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button>
          <Link to="/" className="admin-login__back">← На сайт</Link>
        </form>
      </div>
    )
  }

  if (!me) return <div className="admin-login"><p className="admin-note">Загрузка…</p></div>

  const role = me.user.role
  const s = me.sections
  const nav: { id: Section; label: string; icon: string; show: boolean }[] = [
    { id: 'dashboard', label: 'Обзор', icon: 'home', show: true },
    { id: 'tasks', label: 'Задачи', icon: 'board', show: true },
    { id: 'deals', label: 'Сделки', icon: 'briefcase', show: !!s.deals },
    { id: 'clients', label: 'Клиенты', icon: 'users', show: !!s.clients },
    { id: 'docs', label: 'База знаний', icon: 'book', show: true },
    { id: 'marketing', label: 'Маркетинг', icon: 'target', show: !!s.marketing },
    { id: 'smm', label: 'SMM-дашборд', icon: 'trending', show: !!s.smm },
    { id: 'accounting', label: 'Бухгалтерия', icon: 'file', show: !!s.accounting },
    { id: 'calendar', label: 'Контент-календарь', icon: 'calendar', show: !!s.calendar },
    { id: 'submissions', label: 'Заявки', icon: 'inbox', show: !!s.submissions },
    { id: 'catalog', label: 'Каталог', icon: 'grid', show: !!s.catalog },
    { id: 'ideas', label: 'Идеи', icon: 'bulb', show: true },
    { id: 'users', label: 'Сотрудники', icon: 'user', show: !!s.users },
    { id: 'settings', label: 'Настройки', icon: 'settings', show: true },
  ]
  const visible = nav.filter((n) => n.show)
  const active = visible.some((n) => n.id === section) ? section : 'dashboard'
  const focusId = (type: EntityType) => (focus?.type === type ? `${focus.id}#${focus.n}` : null)
  const stripN = (v: string | null) => (v ? v.split('#')[0] : null)
  const canEditCrm = ['director', 'manager', 'marketer', 'finance'].includes(role)

  return (
    <NavCtx.Provider value={navigate}>
      <div className="admin-shell">
        <Seo title="CRM Smart Capital Partners" description="Панель сотрудников Smart Capital Partners" path="/admin" noindex />

        <aside className="admin-side">
          <div className="admin-side__brand">
            <img src="/logo-emblem.svg" alt="" className="admin-side__emblem" />
            Smart Capital Partners
          </div>
          <nav className="admin-side__nav">
            {visible.map((n) => (
              <button key={n.id} className={`admin-side__link ${active === n.id ? 'is-active' : ''}`} onClick={() => { setSection(n.id); setFocus(null) }}>
                <Icon name={n.icon} size={18} /> {n.label}
              </button>
            ))}
          </nav>
          <div className="admin-side__foot">
            <div className="admin-side__user">
              <span className="admin-side__name">{me.user.name}</span>
              <span className="role-badge">{me.roleLabel}</span>
            </div>
            <div className="admin-side__actions">
              <Link to="/" className="admin-side__small">На сайт</Link>
              <button className="admin-side__small" onClick={() => logout()}>Выйти</button>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-main__top">
            <h1 className="admin-main__title">{visible.find((n) => n.id === active)?.label ?? ROLE_HINTS[active]}</h1>
            <div className="admin-topbar">
              <button className="search-btn" onClick={() => setPalette(true)}><Icon name="search" size={15} /><span>Поиск</span><kbd>⌘K</kbd></button>
              <NotificationCenter initialUnread={me.unreadNotifications} />
            </div>
          </div>

          {active === 'dashboard' && <CrmDashboard userName={me.user.name} roles={ROLES} />}
          {active === 'tasks' && <CrmTasks key={focusId('task') ?? 'tasks'} openId={stripN(focusId('task'))} canCrm={!!s.clients} />}
          {active === 'deals' && <CrmDeals openId={stripN(focusId('deal'))} canEdit={canEditCrm} isManager={me.isManager} />}
          {active === 'clients' && <CrmClients openId={stripN(focusId('client'))} canEdit={canEditCrm} isManager={me.isManager} pipelines={pipelines} />}
          {active === 'docs' && <CrmDocs openId={stripN(focusId('document'))} />}
          {active === 'smm' && <CrmSmm />}
          {active === 'accounting' && <CrmAccounting />}
          {active === 'marketing' && <CrmMarketing />}
          {active === 'calendar' && <CrmCalendar />}
          {active === 'submissions' && <CrmSubmissions />}
          {active === 'catalog' && <AdminCatalog token={getToken() ?? ''} />}
          {active === 'ideas' && <CrmIdeas />}
          {active === 'users' && <CrmUsers />}
          {active === 'settings' && <CrmSettings isManager={me.isManager} isDirector={role === 'director'} />}
        </main>

        <CommandPalette open={palette} onClose={() => setPalette(false)} sections={visible.map((n) => ({ id: n.id, label: n.label }))} />
      </div>
    </NavCtx.Provider>
  )
}

const ROLES: Record<string, string> = {
  director: 'Директор', manager: 'Управляющий', marketer: 'Маркетолог', smm: 'СММ-специалист', accountant: 'Бухгалтер', finance: 'Финансист',
}
