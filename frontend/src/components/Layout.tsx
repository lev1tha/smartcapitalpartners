import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import LeadFooter from './LeadFooter'

export default function Layout() {
  const { pathname, hash } = useLocation()

  // Есть якорь — скроллим к секции (с задержкой, чтобы страница успела
  // отрисоваться при переходе с другого маршрута); иначе наверх.
  useEffect(() => {
    if (hash) {
      const id = window.setTimeout(() => {
        const el = document.querySelector(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
        else window.scrollTo(0, 0)
      }, 80)
      return () => window.clearTimeout(id)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <LeadFooter />
    </>
  )
}
