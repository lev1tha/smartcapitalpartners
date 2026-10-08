/**
 * Общие элементы CRM: тема, выезжающая панель (drawer) на Framer Motion,
 * денежные суммы моноширинным шрифтом, форматирование дат.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ThemeCtx, useTheme, type Theme } from './theme'
import Icon from '../Icon'
import { formatMoney } from './format'

/* ---------- Тема ---------- */
const THEME_KEY = 'scp_theme'

/** Тема живёт на корне CRM (атрибут data-theme) и запоминается в localStorage. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    return () => document.documentElement.removeAttribute('data-theme')
  }, [theme])
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button className={`icon-btn ${className}`} onClick={toggle} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} aria-label="Переключить тему">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
    </button>
  )
}

/* ---------- Drawer ---------- */
const spring = { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 } as const

/**
 * Выезжающая справа панель. width: 'md' (520) | 'lg' (760) | 'xl' (960).
 * Закрывается по Esc и клику на затемнение.
 */
export function Drawer({
  open, onClose, width = 'md', children, className = '',
}: {
  open: boolean
  onClose: () => void
  width?: 'md' | 'lg' | 'xl'
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="drawer drawer--glass"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
        >
          <motion.div
            className={`drawer__panel drawer__panel--${width} ${className}`}
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { x: 0 } : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduce ? { x: 0, opacity: 0 } : { x: '100%' }}
            transition={reduce ? { duration: 0 } : spring}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function DrawerHead({ children, onClose }: { children?: ReactNode; onClose: () => void }) {
  return (
    <div className="drawer__head">
      <div className="drawer__head-left">{children}</div>
      <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={18} /></button>
    </div>
  )
}

/* ---------- Появление списков ---------- */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Сумма в моноширинном начертании; null (скрыто правами) → замок. */
export function Money({ value, currency = 'KGS', className = '', signed = false, compact = false }: {
  value: number | null | undefined
  currency?: string
  className?: string
  signed?: boolean
  compact?: boolean
}) {
  if (value === null || value === undefined) {
    return <span className={`money money--hidden ${className}`} title="Скрыто правами доступа"><Icon name="lock" size={12} /> •••</span>
  }
  const sign = signed && value > 0 ? '+' : ''
  return <span className={`money ${value < 0 ? 'money--neg' : ''} ${className}`} title={compact ? formatMoney(value, currency) : undefined}>{sign}{formatMoney(value, currency, compact)}</span>
}

export function Empty({ icon = 'inbox', title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="crm-empty">
      <Icon name={icon} size={28} />
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  )
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = 200 + (hash % 80) // синие-фиолетовые оттенки бренда
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 55% 42%)` }} title={name}>
      {initials || '•'}
    </span>
  )
}
