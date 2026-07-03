import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

type Item = { to: string; label: string; hash?: boolean }

const directions: Item[] = [
  { to: '/franchises', label: 'Франшизы' },
  { to: '/investments', label: 'Инвестиции' },
  { to: '/ready', label: 'Готовые бизнесы' },
  { to: '/turnkey', label: 'Бизнес под ключ' },
]

const knowledge: Item[] = [
  { to: '/taxes', label: 'Налоги в КР' },
  { to: '/test', label: 'Экспресс-тест' },
  { to: '/#knowledge', label: 'База знаний', hash: true },
]

export default function Header() {
  const [open, setOpen] = useState(false) // мобильное меню
  const [group, setGroup] = useState<string | null>(null) // открытый дропдаун
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  const closeAll = () => {
    setOpen(false)
    setGroup(null)
  }

  // Закрытие дропдауна по клику вне шапки
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setGroup(null)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const renderItem = (it: Item) =>
    it.hash ? (
      <Link key={it.to} to={it.to} onClick={closeAll}>
        {it.label}
      </Link>
    ) : (
      <NavLink
        key={it.to}
        to={it.to}
        className={({ isActive }) => (isActive ? 'is-active' : '')}
        onClick={closeAll}
      >
        {it.label}
      </NavLink>
    )

  const dirCurrent = directions.some((d) => pathname === d.to)
  const knCurrent = knowledge.some((k) => !k.hash && pathname === k.to)

  const renderGroup = (id: string, label: string, items: Item[], current: boolean) => (
    <div className="nav-group">
      <button
        type="button"
        className={`nav-group__trigger ${group === id ? 'is-open' : ''} ${current ? 'is-current' : ''}`}
        onClick={() => setGroup((g) => (g === id ? null : id))}
        aria-expanded={group === id}
      >
        {label}
        <span className="nav-group__chev">▾</span>
      </button>
      <div className={`nav-group__panel ${group === id ? 'is-open' : ''}`}>
        {items.map(renderItem)}
      </div>
    </div>
  )

  return (
    <header className="header" ref={ref}>
      <div className="container header__inner">
        <Link className="header__brand" to="/" onClick={closeAll}>
          MF<span>PRO</span>
        </Link>

        <button
          className={`header__burger ${open ? 'is-open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Меню"
          aria-expanded={open}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`header__menu ${open ? 'is-open' : ''}`}>
          <nav className="header__nav">
            <NavLink
              to="/catalog"
              className={({ isActive }) => (isActive ? 'is-active' : '')}
              onClick={closeAll}
            >
              Каталог
            </NavLink>
            {renderGroup('dir', 'Направления', directions, dirCurrent)}
            {renderGroup('kn', 'Знания', knowledge, knCurrent)}
          </nav>

          <Link to="/#contacts" className="btn btn--primary header__cta" onClick={closeAll}>
            Консультация
          </Link>
        </div>
      </div>
    </header>
  )
}
