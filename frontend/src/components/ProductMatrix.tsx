import { Link } from 'react-router-dom'

type Product = {
  title: string
  description: string
  href: string
  cta: string
  icon: React.ReactNode
  accent: 'navy' | 'mint'
}

const products: Product[] = [
  {
    title: 'Инвестиции',
    description:
      'Поиск инвесторов, подготовка проекта к инвестированию, расчёт ROI и окупаемости.',
    href: '/investments',
    cta: 'Инвестпредложения',
    accent: 'navy',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l6-6 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 8h6v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Франшизы',
    description:
      'Каталог проверенных франшиз для старта в Кыргызстане с минимальными рисками.',
    href: '/franchises',
    cta: 'Каталог франшиз',
    accent: 'mint',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <path d="M3 8l2-4h14l2 4M12 8v12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Бизнес-план',
    description:
      'Профессиональная разработка финансовых моделей, анализ рынка и аудит рисков под ключ.',
    href: '/turnkey',
    cta: 'Заказать под ключ',
    accent: 'navy',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinejoin="round" />
        <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Готовые бизнесы',
    description:
      'Покупка и продажа действующего прибыльного бизнеса с полным юридическим и финансовым сопровождением.',
    href: '/ready',
    cta: 'Витрина бизнесов',
    accent: 'mint',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 21V9l8-5 8 5v12" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6M9 11h.01M15 11h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function ProductMatrix() {
  return (
    <section className="section" id="directions">
      <div className="container">
        <div className="section__head">
          <span className="section__eyebrow">Что мы делаем</span>
          <h2 className="section__title">Основные направления</h2>
          <p className="section__sub">
            Полная экосистема для бизнеса — от первого вложения до продажи
            готового дела.
          </p>
        </div>

        <div className="matrix">
          {products.map((p) => (
            <Link key={p.title} to={p.href} className={`pcard pcard--${p.accent}`}>
              <span className="pcard__icon">{p.icon}</span>
              <h3 className="pcard__title">{p.title}</h3>
              <p className="pcard__desc">{p.description}</p>
              <span className="pcard__cta">{p.cta} →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
