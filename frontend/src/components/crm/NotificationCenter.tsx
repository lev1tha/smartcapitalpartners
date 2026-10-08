/**
 * Центр уведомлений: колокольчик со счётчиком, панель с лентой и настройками
 * (Telegram chat_id, минимальный приоритет, «Не беспокоить»).
 * Непрочитанные подтягиваются каждые 30 секунд.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '../../data/adminApi'
import Icon from '../Icon'
import { useNav, type EntityType } from './nav'
import { fmtRelative } from './format'

type Notification = {
  id: number; title: string; body: string; kind: string; priority: string
  link: { type: string; id: string } | null; isRead: boolean; delivered: string[]; createdAt: string
}
type Settings = { telegramChatId: string; notifyTelegram: boolean; telegramMinPriority: string; dndEnabled: boolean; dndStart: string; dndEnd: string }

const PRIO_COLOR: Record<string, string> = { low: 'var(--color-muted-soft)', normal: 'var(--color-mint)', high: 'var(--color-warning)', urgent: 'var(--color-error)' }

export default function NotificationCenter({ initialUnread = 0 }: { initialUnread?: number }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'list' | 'settings'>('list')
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(initialUnread)
  const wrap = useRef<HTMLDivElement>(null)
  const nav = useNav()
  const reduce = useReducedMotion()

  const load = useCallback(async () => {
    const r = await adminApi('GET', '/api/crm/notifications')
    if (r.ok) { setItems(r.json.notifications ?? []); setUnread(r.json.unread ?? 0) }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc); window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey) }
  }, [open])

  async function markRead(ids: number[] | 'all') {
    setItems((list) => list.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, isRead: true } : n)))
    const r = await adminApi('POST', '/api/crm/notifications/read', ids === 'all' ? { all: true } : { ids })
    if (r.ok) setUnread(r.json.unread ?? 0)
  }

  function openItem(n: Notification) {
    if (!n.isRead) markRead([n.id])
    if (n.link) { setOpen(false); nav(n.link.type as EntityType, n.link.id) }
  }

  return (
    <div className="notif-wrap" ref={wrap}>
      <button className="icon-btn" onClick={() => { setOpen((o) => !o); if (!open) load() }} aria-label="Уведомления" title="Уведомления">
        <Icon name="bell" size={17} />
        {unread > 0 && <span className="icon-btn__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="notif-panel" initial={reduce ? false : { opacity: 0, scale: 0.96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -4 }} transition={{ duration: 0.16 }}>
            <div className="notif-panel__head">
              <strong>Уведомления</strong>
              <div className="tabs">
                <button className={tab === 'list' ? 'is-active' : ''} onClick={() => setTab('list')}>Лента</button>
                <button className={tab === 'settings' ? 'is-active' : ''} onClick={() => setTab('settings')}>Настройки</button>
              </div>
            </div>
            {tab === 'list' ? (
              <>
                <div className="notif-list">
                  {items.length === 0 && <p className="hint" style={{ padding: 24, textAlign: 'center' }}>Пока тихо. Здесь появятся задачи, сделки и заявки.</p>}
                  {items.map((n) => (
                    <button key={n.id} className={`notif ${n.isRead ? '' : 'is-unread'}`} onClick={() => openItem(n)}>
                      <span className="notif__dot" style={{ background: PRIO_COLOR[n.priority] ?? PRIO_COLOR.normal, opacity: n.isRead ? 0.35 : 1 }} />
                      <span style={{ minWidth: 0 }}>
                        <span className="notif__title">{n.title}</span>
                        {n.body && <span className="notif__body">{n.body}</span>}
                      </span>
                      <span className="notif__time">{fmtRelative(n.createdAt)}{n.delivered.includes('telegram') && <Icon name="send" size={10} />}</span>
                    </button>
                  ))}
                </div>
                <div className="notif-panel__foot">
                  <span className="hint">{unread ? `${unread} непрочитанных` : 'Всё прочитано'}</span>
                  {unread > 0 && <button onClick={() => markRead('all')}>Прочитать все</button>}
                </div>
              </>
            ) : <NotificationSettings />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function NotificationSettings() {
  const [s, setS] = useState<Settings | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { adminApi('GET', '/api/crm/notifications/settings').then((r) => r.ok && setS(r.json.settings)) }, [])

  async function save(patch: Partial<Settings>) {
    if (!s) return
    const next = { ...s, ...patch }
    setS(next)
    const r = await adminApi('POST', '/api/crm/notifications/settings', next)
    if (!r.ok) setMsg(r.json?.error ?? 'Не сохранилось'); else setMsg('')
  }
  async function test() {
    await save({})
    const r = await adminApi('POST', '/api/crm/notifications/test')
    setMsg(r.ok ? 'Сообщение отправлено в Telegram' : r.json?.error ?? 'Не удалось отправить')
  }

  if (!s) return <p className="hint" style={{ padding: 14 }}>Загрузка…</p>
  return (
    <div className="notif-settings">
      <label className="cms-field"><span>Telegram chat_id</span>
        <div className="inline-form">
          <input className="admin-input" placeholder="Напишите @userinfobot" value={s.telegramChatId} onChange={(e) => setS({ ...s, telegramChatId: e.target.value })} onBlur={(e) => save({ telegramChatId: e.target.value })} />
          <button className="admin-btn admin-btn--ghost" type="button" onClick={test} disabled={!s.telegramChatId}>Проверить</button>
        </div>
        <span className="hint">Напишите боту @scpkg_bot «/start», затем узнайте свой chat_id у @userinfobot.</span>
      </label>
      <label className="switch"><span>Присылать в Telegram</span><input type="checkbox" checked={s.notifyTelegram} onChange={(e) => save({ notifyTelegram: e.target.checked })} /></label>
      <label className="cms-field"><span>Минимальный приоритет для Telegram</span>
        <select className="admin-input" style={{ height: 36 }} value={s.telegramMinPriority} onChange={(e) => save({ telegramMinPriority: e.target.value })}>
          <option value="low">Все уведомления</option><option value="normal">Обычные и выше</option><option value="high">Только важные</option><option value="urgent">Только срочные</option>
        </select>
      </label>
      <label className="switch"><span>Не беспокоить ночью</span><input type="checkbox" checked={s.dndEnabled} onChange={(e) => save({ dndEnabled: e.target.checked })} /></label>
      {s.dndEnabled && (
        <div className="time-range">
          <input className="admin-input" type="time" value={s.dndStart} onChange={(e) => save({ dndStart: e.target.value })} /> — <input className="admin-input" type="time" value={s.dndEnd} onChange={(e) => save({ dndEnd: e.target.value })} />
          <span className="hint">Срочные приходят всегда</span>
        </div>
      )}
      {msg && <p className="hint" style={{ color: msg.includes('отправлено') ? 'var(--color-success)' : 'var(--color-error)' }}>{msg}</p>}
    </div>
  )
}
