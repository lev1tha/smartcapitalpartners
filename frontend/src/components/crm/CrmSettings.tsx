/**
 * Настройки: уведомления (все), пользовательские свойства (руководители),
 * матрица прав на поля (директор), журнал действий (руководители).
 */
import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'
import { NotificationSettings } from './NotificationCenter'
import { fmtDate } from './format'

type Tab = 'notifications' | 'fields' | 'permissions' | 'logs'

export default function CrmSettings({ isManager, isDirector }: { isManager: boolean; isDirector: boolean }) {
  const [tab, setTab] = useState<Tab>('notifications')
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'notifications', label: 'Уведомления', show: true },
    { id: 'fields', label: 'Свойства', show: isManager },
    { id: 'permissions', label: 'Права на поля', show: isDirector },
    { id: 'logs', label: 'Журнал', show: isManager },
  ]
  return (
    <div style={{ maxWidth: 900 }}>
      <div className="tabs">{tabs.filter((t) => t.show).map((t) => <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      {tab === 'notifications' && <div className="panel" style={{ maxWidth: 520 }}><h3>Как и когда получать уведомления</h3><NotificationSettings /></div>}
      {tab === 'fields' && <FieldDefinitions />}
      {tab === 'permissions' && <FieldPermissions />}
      {tab === 'logs' && <AuditLogs />}
    </div>
  )
}

/* ---------- Свойства «на лету» ---------- */
type FieldDef = { id: string; resource: string; label: string; type: string; options: string[] }
const RESOURCES: Record<string, string> = { task: 'Задачи', client: 'Клиенты', deal: 'Сделки' }

function FieldDefinitions() {
  const [fields, setFields] = useState<FieldDef[]>([])
  const [types, setTypes] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ resource: 'deal', label: '', type: 'text', options: '' })
  const [err, setErr] = useState('')
  const load = useCallback(() => adminApi('GET', '/api/crm/fields').then((r) => { if (r.ok) { setFields(r.json.fields); setTypes(r.json.types) } }), [])
  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    const r = await adminApi('POST', '/api/crm/fields/save', { item: { ...form, options: form.options.split(',').map((o) => o.trim()).filter(Boolean) } })
    if (r.ok) { setForm({ ...form, label: '', options: '' }); load() } else setErr(r.json?.error ?? 'Ошибка')
  }
  async function remove(f: FieldDef) {
    if (!confirm(`Удалить свойство «${f.label}»? Значения в карточках останутся, но перестанут отображаться.`)) return
    await adminApi('POST', '/api/crm/fields/delete', { id: f.id }); load()
  }

  return (
    <div className="panel">
      <h3>Дополнительные свойства <small>появляются в карточках задач, клиентов и сделок</small></h3>
      <form className="inline-form" onSubmit={add} style={{ marginBottom: 16 }}>
        <select className="admin-input" value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })}>{Object.entries(RESOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="admin-input" placeholder="Название свойства" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
        <select className="admin-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {form.type === 'select' && <input className="admin-input" placeholder="Варианты через запятую" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />}
        <button className="admin-btn admin-btn--mint" type="submit"><Icon name="plus" size={14} /> Добавить</button>
      </form>
      {err && <p className="err">{err}</p>}
      {fields.length === 0 ? <p className="hint">Свойств пока нет. Например: «Источник» (список) для сделок или «Сфера» для клиентов.</p> : (
        <table className="matrix">
          <thead><tr><th>Раздел</th><th>Свойство</th><th>Тип</th><th>Варианты</th><th /></tr></thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id}><td>{RESOURCES[f.resource]}</td><td className="role-cell">{f.label}</td><td>{types[f.type]}</td><td className="hint">{f.options.join(', ')}</td>
                <td><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => remove(f)} aria-label="Удалить"><Icon name="trash" size={13} /></button></td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ---------- Матрица прав на поля ---------- */
type Matrix = { fields: Record<string, { id: string; label: string }[]>; roles: Record<string, Record<string, Record<string, { view: boolean; edit: boolean }>>>; roleLabels: Record<string, string> }
const RES_LABEL: Record<string, string> = { client: 'Клиент', deal: 'Сделка', finance: 'Финансы' }

function FieldPermissions() {
  const [m, setM] = useState<Matrix | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { adminApi('GET', '/api/crm/permissions/fields').then((r) => (r.ok ? setM(r.json) : setErr(r.json?.error ?? 'Нет доступа'))) }, [])

  async function toggle(role: string, resource: string, field: string, what: 'view' | 'edit') {
    if (!m) return
    const cur = m.roles[role][resource][field]
    const next = what === 'view' ? { canView: !cur.view, canEdit: !cur.view && cur.edit } : { canView: cur.view, canEdit: !cur.edit }
    const r = await adminApi('POST', '/api/crm/permissions/fields', { role, resource, field, ...next })
    if (r.ok) setM(r.json); else setErr(r.json?.error ?? 'Ошибка')
  }

  if (err) return <p className="admin-note admin-note--err">{err}</p>
  if (!m) return <p className="admin-note">Загрузка…</p>
  const roles = Object.keys(m.roleLabels).filter((r) => r !== 'director')
  return (
    <div className="panel" style={{ overflowX: 'auto' }}>
      <h3>Кто что видит и редактирует <small>директор видит всё всегда</small></h3>
      <p className="hint" style={{ marginBottom: 14 }}>Первая кнопка — просмотр, вторая — редактирование. Скрытое поле приходит в CRM как «•••», попытка изменить его блокируется сервером.</p>
      <table className="matrix">
        <thead><tr><th>Поле</th>{roles.map((r) => <th key={r} className="center">{m.roleLabels[r]}</th>)}</tr></thead>
        <tbody>
          {Object.entries(m.fields).map(([res, fields]) => fields.map((f, i) => (
            <tr key={`${res}.${f.id}`}>
              <td className="role-cell">{i === 0 && <span className="hint" style={{ display: 'block', fontSize: 11 }}>{RES_LABEL[res] ?? res}</span>}{f.label}</td>
              {roles.map((r) => {
                const p = m.roles[r][res][f.id]
                return (
                  <td key={r} className="center">
                    <span className="perm">
                      <button className={p.view ? 'is-on' : ''} title={p.view ? 'Видит' : 'Скрыто'} onClick={() => toggle(r, res, f.id, 'view')}><Icon name={p.view ? 'eye' : 'eye-off'} size={14} /></button>
                      <button className={p.edit ? 'is-on' : ''} title={p.edit ? 'Редактирует' : 'Только чтение'} disabled={!p.view} onClick={() => toggle(r, res, f.id, 'edit')}><Icon name="edit" size={13} /></button>
                    </span>
                  </td>
                )
              })}
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Журнал ---------- */
type Log = { id: number; actor: string; action: string; entityType: string; entityId: string; summary: string; changes: Record<string, [unknown, unknown]>; createdAt: string }
const ACTION_LABEL: Record<string, string> = { create: 'создал', update: 'изменил', delete: 'удалил', stage: 'перевёл', transition: 'перевёл' }

function AuditLogs() {
  const [logs, setLogs] = useState<Log[]>([])
  const [type, setType] = useState('')
  useEffect(() => { adminApi('GET', `/api/crm/logs${type ? `?entityType=${type}` : ''}`).then((r) => r.ok && setLogs(r.json.logs)) }, [type])
  return (
    <div className="panel">
      <h3>Журнал действий
        <select className="admin-input" style={{ height: 32, fontSize: 12, width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Все</option><option value="client">Клиенты</option><option value="deal">Сделки</option><option value="payment">Платежи</option><option value="task">Задачи</option><option value="document">Документы</option><option value="permissions">Права</option>
        </select>
      </h3>
      {logs.length === 0 && <p className="hint">Записей пока нет.</p>}
      {logs.map((l) => (
        <div className="log-row" key={l.id}>
          <time>{fmtDate(l.createdAt, true)}</time>
          <div>
            <b>{l.actor}</b> {ACTION_LABEL[l.action] ?? l.action}: {l.summary}
            {Object.keys(l.changes).length > 0 && (
              <div className="diff">{Object.entries(l.changes).map(([k, [a, b]]) => <span key={k}>{k}: {String(a ?? '—')} → {String(b ?? '—')}</span>)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
