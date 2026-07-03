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
import { adminApi, getToken, setToken, clearToken } from '../data/adminApi'
import '../styles/admin.css'

type User = { id: string; name: string; role: string }
type Me = { user: User; roleLabel: string; isManager: boolean; access: string[] }
type Section = 'tasks' | 'smm' | 'accounting' | 'marketing' | 'calendar' | 'submissions' | 'catalog' | 'ideas' | 'users'

export default function Admin() {
  const [authed, setAuthed] = useState<boolean>(() => !!getToken())
  const [me, setMe] = useState<Me | null>(null)
  const [section, setSection] = useState<Section>('tasks')

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [busy, setBusy] = useState(false)

  const logout = useCallback(() => {
    clearToken()
    setAuthed(false)
    setMe(null)
  }, [])

  const loadMe = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/me')
    if (r.ok) setMe(r.json)
    else logout()
  }, [logout])

  useEffect(() => {
    if (authed) loadMe()
  }, [authed, loadMe])

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setLoginErr('')
    const r = await adminApi('POST', '/api/admin/login', { login, password })
    setBusy(false)
    if (r.ok && r.json?.token) {
      setToken(r.json.token)
      setPassword('')
      setAuthed(true)
    } else {
      setLoginErr(r.json?.error ?? 'Ошибка входа. Запущен ли бэкенд?')
    }
  }

  /* ---------- LOGIN ---------- */
  if (!authed) {
    return (
      <div className="admin-login">
        <Seo title="CRM — вход" description="Панель сотрудников MF PRO" path="/admin" noindex />
        <form className="admin-login__card" onSubmit={doLogin}>
          <div className="admin-login__brand">MF<span>PRO</span></div>
          <h1>Вход для сотрудников</h1>
          <input className="admin-input" placeholder="Логин" value={login} onChange={(e) => setLogin(e.target.value)} autoFocus />
          <input className="admin-input" type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 10 }} />
          {loginErr && <p className="admin-login__error">{loginErr}</p>}
          <button className="admin-btn" type="submit" disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button>
          <Link to="/" className="admin-login__back">← На сайт</Link>
        </form>
      </div>
    )
  }

  if (!me) {
    return <div className="admin-login"><p className="admin-note">Загрузка…</p></div>
  }

  const role = me.user.role
  const calendarRoles = ['director', 'manager', 'marketer', 'smm']
  const smmRoles = ['director', 'manager', 'smm']
  const accRoles = ['director', 'manager', 'accountant', 'finance']
  const mktRoles = ['director', 'manager', 'marketer']
  const nav: { id: Section; label: string; icon: string; show: boolean }[] = [
    { id: 'tasks', label: 'Задачи', icon: 'board', show: true },
    { id: 'marketing', label: 'Маркетинг', icon: 'target', show: mktRoles.includes(role) },
    { id: 'smm', label: 'SMM-дашборд', icon: 'trending', show: smmRoles.includes(role) },
    { id: 'accounting', label: 'Бухгалтерия', icon: 'file', show: accRoles.includes(role) },
    { id: 'calendar', label: 'Контент-календарь', icon: 'calendar', show: calendarRoles.includes(role) },
    { id: 'submissions', label: 'Заявки', icon: 'inbox', show: me.access.length > 0 },
    { id: 'catalog', label: 'Каталог', icon: 'grid', show: me.isManager || role === 'marketer' },
    { id: 'ideas', label: 'Идеи', icon: 'bulb', show: true },
    { id: 'users', label: 'Сотрудники', icon: 'users', show: me.isManager },
  ]
  const visible = nav.filter((n) => n.show)
  const active = visible.some((n) => n.id === section) ? section : 'tasks'

  return (
    <div className="admin-shell">
      <Seo title="CRM MF PRO" description="Панель сотрудников MF PRO" path="/admin" noindex />

      <aside className="admin-side">
        <div className="admin-side__brand">MF<span>PRO</span></div>
        <nav className="admin-side__nav">
          {visible.map((n) => (
            <button key={n.id} className={`admin-side__link ${active === n.id ? 'is-active' : ''}`} onClick={() => setSection(n.id)}>
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
            <button className="admin-side__small" onClick={logout}>Выйти</button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <h1 className="admin-main__title">{visible.find((n) => n.id === active)?.label}</h1>
        {active === 'tasks' && <CrmTasks />}
        {active === 'smm' && <CrmSmm />}
        {active === 'accounting' && <CrmAccounting />}
        {active === 'marketing' && <CrmMarketing />}
        {active === 'calendar' && <CrmCalendar />}
        {active === 'submissions' && <CrmSubmissions />}
        {active === 'catalog' && <AdminCatalog token={getToken() ?? ''} />}
        {active === 'ideas' && <CrmIdeas />}
        {active === 'users' && <CrmUsers />}
      </main>
    </div>
  )
}
