import { Link } from 'react-router-dom'
import { investments } from '../data/offerings'
import Seo from '../components/Seo'
import '../styles/offerings.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function Investments() {
  return (
    <div className="offerings">
      <Seo
        title="Инвестиционные предложения в Кыргызстане"
        description="Проекты в Бишкеке и регионах, открытые для инвестиций: сумма, доля, доходность и срок. Проверка проекта и безопасное оформление сделки."
        path="/investments"
      />
      <section className="off-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span className="breadcrumb__current">Инвестиции</span>
          </nav>
          <span className="off-hero__eyebrow">Инвестиционные предложения</span>
          <h1 className="off-hero__title">Проекты, открытые для инвестиций</h1>
          <p className="off-hero__lead">
            Отобранные проекты в Бишкеке и регионах с подготовленной финмоделью.
            Помогаем проверить проект и оформить сделку безопасно.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="off-grid">
            {investments.map((p) => (
              <Link className="off-card" key={p.id} to={`/investments/${p.id}`}>
                <div className="off-card__top">
                  <span className="off-card__emoji">{p.emoji}</span>
                  <div>
                    <span className="off-card__title">{p.title}</span>
                    <span className="off-card__badge">{p.sector}</span>
                  </div>
                </div>

                <div className="off-stats">
                  <div className="off-stat">
                    <span className="off-stat__label">Требуется инвестиций</span>
                    <span className="off-stat__value">{money(p.amount)} сом</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Доля</span>
                    <span className="off-stat__value">{p.equity}</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Прогноз доходности</span>
                    <span className="off-stat__value">{p.roi}</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Срок</span>
                    <span className="off-stat__value">{p.term}</span>
                  </div>
                </div>

                <div className="off-card__foot">
                  <span className="off-card__meta">Стадия: {p.stage}</span>
                  <span className="off-card__cta">Подробнее →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
