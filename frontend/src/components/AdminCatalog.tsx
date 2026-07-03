import { useCallback, useEffect, useState } from 'react'
import { spheres, formats, type BusinessModel } from '../data/catalog'

type Model = BusinessModel & { ops?: unknown }

const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n)

const emptyForm = {
  id: '',
  title: '',
  emoji: '🏢',
  sphere: 'Услуги',
  format: 'Офлайн',
  investment: '',
  payback: '',
  margin: '',
  avgCheck: '',
  tags: '',
  featured: false,
  description: '',
  longDescription: '',
}
type Form = typeof emptyForm

export default function AdminCatalog({ token }: { token: string }) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Model | 'new' | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/content?type=models')
      const d = await res.json()
      setModels(Array.isArray(d.items) ? d.items : [])
    } catch {
      setError('Не удалось загрузить карточки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openNew() {
    setForm(emptyForm)
    setEditing('new')
    setError('')
  }

  function openEdit(m: Model) {
    setForm({
      id: m.id,
      title: m.title ?? '',
      emoji: m.emoji ?? '🏢',
      sphere: m.sphere ?? 'Услуги',
      format: m.format ?? 'Офлайн',
      investment: String(m.investment ?? ''),
      payback: m.payback ?? '',
      margin: m.margin ?? '',
      avgCheck: m.avgCheck ?? '',
      tags: (m.tags ?? []).join(', '),
      featured: !!m.featured,
      description: m.description ?? '',
      longDescription: m.longDescription ?? '',
    })
    setEditing(m)
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Укажите название')
      return
    }
    setSaving(true)
    setError('')
    // Сохраняем существующие поля (например, ops) + перезаписываем из формы.
    const original = editing !== 'new' && editing ? editing : {}
    const item = {
      ...original,
      id: form.id || undefined,
      title: form.title.trim(),
      emoji: form.emoji.trim() || '🏢',
      sphere: form.sphere,
      format: form.format,
      investment: Number(form.investment) || 0,
      payback: form.payback.trim(),
      margin: form.margin.trim(),
      avgCheck: form.avgCheck.trim(),
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      featured: form.featured,
      description: form.description.trim(),
      longDescription: form.longDescription.trim() || form.description.trim(),
    }
    try {
      const res = await fetch('/api/admin/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'models', item }),
      })
      if (!res.ok) throw new Error()
      setEditing(null)
      await load()
    } catch {
      setError('Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  async function remove(m: Model) {
    if (!confirm(`Удалить карточку «${m.title}»?`)) return
    try {
      await fetch('/api/admin/content/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'models', id: m.id }),
      })
      await load()
    } catch {
      setError('Не удалось удалить')
    }
  }

  const set = (k: keyof Form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  /* ---------- FORM ---------- */
  if (editing) {
    return (
      <form className="cms-form" onSubmit={save}>
        <div className="cms-form__head">
          <h2>{editing === 'new' ? 'Новая карточка' : 'Редактирование'}</h2>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditing(null)}>
            ← Назад к списку
          </button>
        </div>

        <div className="cms-grid">
          <label className="cms-field cms-field--sm">
            <span>Эмодзи</span>
            <input className="admin-input" value={form.emoji} onChange={(e) => set('emoji', e.target.value)} />
          </label>
          <label className="cms-field cms-field--grow">
            <span>Название *</span>
            <input className="admin-input" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </label>

          <label className="cms-field">
            <span>Сфера</span>
            <select className="admin-input" value={form.sphere} onChange={(e) => set('sphere', e.target.value)}>
              {spheres.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="cms-field">
            <span>Формат</span>
            <select className="admin-input" value={form.format} onChange={(e) => set('format', e.target.value)}>
              {formats.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>

          <label className="cms-field">
            <span>Вложения от, сом</span>
            <input
              className="admin-input"
              type="number"
              value={form.investment}
              onChange={(e) => set('investment', e.target.value)}
            />
          </label>
          <label className="cms-field">
            <span>Окупаемость</span>
            <input className="admin-input" value={form.payback} onChange={(e) => set('payback', e.target.value)} placeholder="8–12 мес" />
          </label>
          <label className="cms-field">
            <span>Маржа</span>
            <input className="admin-input" value={form.margin} onChange={(e) => set('margin', e.target.value)} placeholder="55–65%" />
          </label>
          <label className="cms-field">
            <span>Средний чек</span>
            <input className="admin-input" value={form.avgCheck} onChange={(e) => set('avgCheck', e.target.value)} placeholder="180 сом" />
          </label>

          <label className="cms-field cms-field--full">
            <span>Теги (через запятую)</span>
            <input className="admin-input" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Высокая маржа, Проходное место" />
          </label>

          <label className="cms-field cms-field--full">
            <span>Краткое описание (для карточки)</span>
            <textarea className="admin-input cms-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
          </label>
          <label className="cms-field cms-field--full">
            <span>Полное описание (для страницы)</span>
            <textarea className="admin-input cms-textarea" value={form.longDescription} onChange={(e) => set('longDescription', e.target.value)} rows={4} />
          </label>

          <label className="cms-check cms-field--full">
            <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
            Отметить как «Хит»
          </label>
        </div>

        {error && <p className="admin-note admin-note--err">{error}</p>}
        <div className="cms-form__actions">
          <button className="admin-btn admin-btn--mint" type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить карточку'}
          </button>
        </div>
      </form>
    )
  }

  /* ---------- LIST ---------- */
  return (
    <div className="cms">
      <div className="cms-toolbar">
        <span className="cms-count">Карточек: {models.length}</span>
        <button className="admin-btn admin-btn--mint" onClick={openNew}>
          + Создать карточку
        </button>
      </div>

      {loading && <p className="admin-note">Загрузка…</p>}
      {error && <p className="admin-note admin-note--err">{error}</p>}

      <div className="cms-list">
        {models.map((m) => (
          <div className="cms-card" key={m.id}>
            <span className="cms-card__emoji">{m.emoji}</span>
            <div className="cms-card__body">
              <span className="cms-card__title">
                {m.title} {m.featured && <span className="cms-flag">Хит</span>}
              </span>
              <span className="cms-card__meta">
                {m.sphere} · {m.format} · от {money(m.investment)} сом · {m.payback}
              </span>
            </div>
            <div className="cms-card__actions">
              <button className="admin-btn admin-btn--ghost" onClick={() => openEdit(m)}>
                Изменить
              </button>
              <button className="admin-btn admin-btn--danger" onClick={() => remove(m)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
