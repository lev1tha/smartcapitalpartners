import { Fragment, useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../data/adminApi'

type Lead = { name: string; phone: string; topic?: string; createdAt: string }
type QuizAnswer = { question: string; answer: string }
type QuizResult = {
  name: string; phone: string; email?: string; score: number; maxScore: number
  level: string; answers: QuizAnswer[]; createdAt: string
}
type Turnkey = {
  name: string; phone: string; sphere?: string; budget?: string; city?: string
  services?: string[]; createdAt: string
}
type Data = {
  access: string[]
  counts: Record<string, number>
  leads: Lead[]
  quiz: QuizResult[]
  turnkey: Turnkey[]
}
type Tab = 'leads' | 'quiz' | 'turnkey'

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CrmSubmissions() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('leads')
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminApi('GET', '/api/admin/submissions')
    if (r.ok) {
      setData(r.json)
      const access = r.json.access ?? []
      if (access.length && !access.includes(tab)) setTab(access[0])
    }
    setLoading(false)
  }, [tab])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <p className="admin-note">Загрузка…</p>
  if (!data) return <p className="admin-note admin-note--err">Не удалось загрузить</p>

  const access = data.access ?? []
  const labels: Record<Tab, string> = { leads: 'Лиды', quiz: 'Тесты', turnkey: 'Под ключ' }
  const tabs = (['leads', 'quiz', 'turnkey'] as Tab[]).filter((t) => access.includes(t))

  function exportCsv() {
    if (!data) return
    const rows: string[][] = []
    if (tab === 'leads') {
      rows.push(['Дата', 'Имя', 'Телефон', 'Тема'])
      data.leads.forEach((l) => rows.push([fmtDate(l.createdAt), l.name, l.phone, l.topic ?? '']))
    } else if (tab === 'quiz') {
      rows.push(['Дата', 'Имя', 'Телефон', 'Email', 'Баллы', 'Уровень'])
      data.quiz.forEach((q) => rows.push([fmtDate(q.createdAt), q.name, q.phone, q.email ?? '', `${q.score}/${q.maxScore}`, q.level]))
    } else {
      rows.push(['Дата', 'Имя', 'Телефон', 'Сфера', 'Бюджет', 'Город', 'Услуги'])
      data.turnkey.forEach((t) => rows.push([fmtDate(t.createdAt), t.name, t.phone, t.sphere ?? '', t.budget ?? '', t.city ?? '', (t.services ?? []).join('; ')]))
    }
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `mfpro-${tab}.csv`
    a.click()
  }

  if (tabs.length === 0) {
    return <p className="admin-note">У вашей роли нет доступа к заявкам.</p>
  }

  return (
    <div>
      <div className="admin-tabs">
        {tabs.map((t) => (
          <button key={t} className={`admin-tab ${tab === t ? 'is-active' : ''}`} onClick={() => { setTab(t); setExpanded(null) }}>
            {labels[t]}
            <span className="admin-tab__count">{data.counts[t] ?? 0}</span>
          </button>
        ))}
        <button className="admin-btn admin-btn--mint admin-export" onClick={exportCsv}>Экспорт CSV</button>
      </div>

      <div className="admin-table-wrap">
        {tab === 'leads' && (
          <table className="admin-table">
            <thead><tr><th>Дата</th><th>Имя</th><th>Телефон</th><th>Тема</th></tr></thead>
            <tbody>
              {data.leads.map((l, i) => (
                <tr key={i}>
                  <td className="admin-td-date">{fmtDate(l.createdAt)}</td>
                  <td>{l.name}</td>
                  <td><a href={`tel:${l.phone}`}>{l.phone}</a></td>
                  <td>{l.topic ?? '—'}</td>
                </tr>
              ))}
              {data.leads.length === 0 && <tr><td colSpan={4} className="admin-empty">Пока нет заявок</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'quiz' && (
          <table className="admin-table">
            <thead><tr><th></th><th>Дата</th><th>Имя</th><th>Телефон</th><th>Email</th><th>Балл</th><th>Уровень</th></tr></thead>
            <tbody>
              {data.quiz.map((q, i) => (
                <Fragment key={i}>
                  <tr className="admin-row-click" onClick={() => setExpanded(expanded === i ? null : i)}>
                    <td className="admin-toggle">{expanded === i ? '−' : '+'}</td>
                    <td className="admin-td-date">{fmtDate(q.createdAt)}</td>
                    <td>{q.name}</td>
                    <td><a href={`tel:${q.phone}`} onClick={(e) => e.stopPropagation()}>{q.phone}</a></td>
                    <td>{q.email || '—'}</td>
                    <td><span className="admin-score">{q.score}/{q.maxScore}</span></td>
                    <td>{q.level}</td>
                  </tr>
                  {expanded === i && (
                    <tr className="admin-answers-row">
                      <td colSpan={7}>
                        <div className="admin-answers">
                          <strong>Ответы:</strong>
                          <ol>{q.answers.map((a, j) => <li key={j}>{a.question} — <b>{a.answer}</b></li>)}</ol>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {data.quiz.length === 0 && <tr><td colSpan={7} className="admin-empty">Пока нет тестов</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'turnkey' && (
          <table className="admin-table">
            <thead><tr><th>Дата</th><th>Имя</th><th>Телефон</th><th>Сфера</th><th>Бюджет</th><th>Город</th><th>Услуги</th></tr></thead>
            <tbody>
              {data.turnkey.map((t, i) => (
                <tr key={i}>
                  <td className="admin-td-date">{fmtDate(t.createdAt)}</td>
                  <td>{t.name}</td>
                  <td><a href={`tel:${t.phone}`}>{t.phone}</a></td>
                  <td>{t.sphere ?? '—'}</td>
                  <td>{t.budget ?? '—'}</td>
                  <td>{t.city ?? '—'}</td>
                  <td className="admin-services">{(t.services ?? []).join(', ') || '—'}</td>
                </tr>
              ))}
              {data.turnkey.length === 0 && <tr><td colSpan={7} className="admin-empty">Пока нет заявок</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
