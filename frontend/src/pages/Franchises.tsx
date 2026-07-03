import { Link } from 'react-router-dom'
import { franchises } from '../data/offerings'
import Seo from '../components/Seo'
import '../styles/offerings.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function Franchises() {
  return (
    <div className="offerings">
      <Seo
        title="Каталог франшиз в Кыргызстане"
        description="Проверенные франшизы для старта в КР: паушальный взнос, роялти, окупаемость. Готовые бизнес-модели под брендом с обучением и поддержкой."
        path="/franchises"
      />
      <section className="off-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span className="breadcrumb__current">Франшизы</span>
          </nav>
          <span className="off-hero__eyebrow">Каталог франшиз</span>
          <h1 className="off-hero__title">Проверенные франшизы для старта в КР</h1>
          <p className="off-hero__lead">
            Готовые бизнес-модели под известными брендами с обучением и поддержкой.
            Минимум рисков — максимум готовности к запуску.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="off-grid">
            {franchises.map((f) => (
              <Link className="off-card" key={f.id} to={`/franchises/${f.id}`}>
                <div className="off-card__top">
                  <span className="off-card__emoji">{f.emoji}</span>
                  <div>
                    <span className="off-card__title">{f.brand}</span>
                    <span className="off-card__badge">{f.category}</span>
                  </div>
                </div>

                <div className="off-stats">
                  <div className="off-stat">
                    <span className="off-stat__label">Вложения от</span>
                    <span className="off-stat__value">{money(f.investment)} сом</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Паушальный взнос</span>
                    <span className="off-stat__value">{money(f.paushal)} сом</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Роялти</span>
                    <span className="off-stat__value">{f.royalty}</span>
                  </div>
                  <div className="off-stat">
                    <span className="off-stat__label">Окупаемость</span>
                    <span className="off-stat__value">{f.payback}</span>
                  </div>
                </div>

                <div className="off-card__foot">
                  <span className="off-card__meta">{f.points} точек в сети</span>
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
