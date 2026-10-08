/** Форматирование денег, дат, дедлайнов и подписей — без React, чтобы работал Fast Refresh. */

/* ---------- Деньги и даты ---------- */
const CURRENCY_SIGN: Record<string, string> = { KGS: 'сом', USD: '$', EUR: '€', RUB: '₽', KZT: '₸' }

export function formatMoney(value: number | null | undefined, currency = 'KGS', compact = false): string {
  if (value === null || value === undefined) return '•••'
  const abs = Math.abs(value)
  // compact: 10 710 000 → 10,7 млн — для плиток и узких колонок
  const n = compact && abs >= 1_000_000 ? `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value / 1_000_000)} млн`
    : compact && abs >= 100_000 ? `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value / 1000)} тыс`
    : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
  const sign = CURRENCY_SIGN[currency] ?? currency
  return currency === 'KGS' ? `${n} ${sign}` : `${sign}${n}`
}

export const fmtDate = (iso?: string | null, withTime = false) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', withTime
    ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

export const fmtRelative = (iso?: string) => {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`
  return fmtDate(iso)
}

/** Дедлайн: сколько дней осталось / просрочено. */
export function dueLabel(date?: string | null): { text: string; tone: 'ok' | 'warn' | 'err' | 'muted' } | null {
  if (!date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const days = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { text: `просрочено ${-days} дн`, tone: 'err' }
  if (days === 0) return { text: 'сегодня', tone: 'warn' }
  if (days === 1) return { text: 'завтра', tone: 'warn' }
  if (days <= 7) return { text: `через ${days} дн`, tone: 'ok' }
  return { text: fmtDate(date), tone: 'muted' }
}

export const PRIORITY_LABEL: Record<string, string> = { low: 'низкий', normal: 'обычный', high: 'высокий', urgent: 'срочно' }


export const fmtShort = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')} млн` : Math.abs(n) >= 1000 ? `${Math.round(n / 1000)} тыс` : String(n)

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export const TASK_STATUS_LABEL: Record<string, string> = { new: 'Новая', in_progress: 'В работе', review: 'На проверке', done: 'Выполнена', rejected: 'Отклонена' }
export const TASK_STATUS_CLASS: Record<string, string> = { new: 'st-new', in_progress: 'st-prog', review: 'st-review', done: 'st-done', rejected: 'st-rej' }
