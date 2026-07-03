import { useEffect, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'

type Idea = { id: string; text: string; author: string; authorRole: string; createdAt: string }

const ROLE_LABEL: Record<string, string> = {
  director: 'Директор',
  manager: 'Управляющий',
  marketer: 'Маркетолог',
  smm: 'СММ',
  accountant: 'Бухгалтер',
  finance: 'Финансист',
}
const fmt = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export default function CrmIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [me, setMe] = useState<{ name: string; isManager: boolean } | null>(null)

  async function load() {
    const r = await adminApi('GET', '/api/crm/ideas')
    if (r.ok) setIdeas(r.json.ideas ?? [])
  }
  useEffect(() => {
    load()
    adminApi('GET', '/api/crm/me').then((r) => {
      if (r.ok) setMe({ name: r.json.user.name, isManager: r.json.isManager })
    })
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    const r = await adminApi('POST', '/api/crm/ideas', { text })
    setBusy(false)
    if (r.ok) {
      setText('')
      load()
    }
  }

  async function remove(idea: Idea) {
    if (!confirm('Удалить идею?')) return
    const r = await adminApi('POST', '/api/crm/ideas/delete', { id: idea.id })
    if (r.ok) load()
  }

  const canDelete = (idea: Idea) => !!me && (me.isManager || idea.author === me.name)

  return (
    <div className="crm-ideas">
      <form className="idea-input" onSubmit={add}>
        <input
          className="admin-input"
          placeholder="Маркетинговая идея, гипотеза, предложение…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="admin-btn admin-btn--mint" type="submit" disabled={busy}>
          Добавить
        </button>
      </form>

      <div className="idea-list">
        {ideas.map((i) => (
          <div className="idea-card" key={i.id}>
            {canDelete(i) && (
              <button className="idea-del" onClick={() => remove(i)} title="Удалить идею">
                <Icon name="trash" size={15} />
              </button>
            )}
            <p>{i.text}</p>
            <span className="idea-meta">
              {i.author} · {ROLE_LABEL[i.authorRole] ?? i.authorRole} · {fmt(i.createdAt)}
            </span>
          </div>
        ))}
        {ideas.length === 0 && <p className="admin-note">Пока нет идей — добавьте первую!</p>}
      </div>
    </div>
  )
}
