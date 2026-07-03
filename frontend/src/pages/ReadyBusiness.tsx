import { Link } from 'react-router-dom'
import { readyBusinesses } from '../data/offerings'
import Seo from '../components/Seo'
import '../styles/offerings.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function ReadyBusiness() {
  return (
    <div className="offerings">
      <Seo
        title="Готовый бизнес на продажу в Кыргызстане"
        description="Действующий прибыльный бизнес в КР с финансовым и юридическим сопровождением сделки: цена, выручка, прибыль и окупаемость."
        path="/ready"
      />
      <section className="off-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span className="breadcrumb__current">Готовые бизнесы</span>
          </nav>
          <span className="off-hero__eyebrow">Витрина готового бизнеса</span>
          <h1 className="off-hero__title">Действующий бизнес на продажу</h1>
          <p className="off-hero__lead">
            Покупка прибыльного бизнеса с полным юридическим и финансовым
            сопровождением. Проверяем оборот, прибыль и документы перед сделкой.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="off-grid">
            {readyBusinesses.map((b) => (
              <Link className="off-card" key={b.id} to={`/ready/${b.id}`}>
                <div className="off-card__top">
                  <span className="off-card__emoji">{b.emoji}</span>
                  <div>
                    <span className="off-card__title">{b.title}</span>
                    <span className="off-card__badge">
                      {b.sphere} · {b.city}
                    </span>
                  </div>
                </div>

                <div className="off-stats">
                  <div className="off-stat">
                    <span className="off-stat__label">Цена</span>
                    <span className="off-stat__value">{money(b.price)} сом</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Окупаемость</span>
                    <span className="off-stat__value">{b.payback}</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Выручка/мес</span>
                    <span className="off-stat__value">{money(b.revenue)} сом</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Прибыль/мес</span>
                    <span className="off-stat__value">{money(b.profit)} сом</span>
                  </div>
                </div>

                <div className="off-card__foot">
                  <span className="off-card__meta">С сопровождением сделки</span>
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
