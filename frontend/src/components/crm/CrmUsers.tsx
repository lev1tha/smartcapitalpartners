import { useEffect, useState } from 'react'
import { adminApi } from '../../data/adminApi'

type User = { login: string; name: string; role: string; roleLabel: string }

export default function CrmUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi('GET', '/api/crm/users').then((r) => {
      if (r.ok) setUsers(r.json.users ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="admin-note">Загрузка…</p>

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Роль</th>
            <th>Логин</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.login}>
              <td>{u.name}</td>
              <td>
                <span className="role-badge">{u.roleLabel}</span>
              </td>
              <td className="admin-td-date">{u.login}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="admin-note" style={{ padding: '12px 16px' }}>
        Добавление сотрудников и смена паролей — в Django-admin (<code>/django-admin/</code>) или командой{' '}
        <code>manage.py changepassword &lt;логин&gt;</code>.
      </p>
    </div>
  )
}
