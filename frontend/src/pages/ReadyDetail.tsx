import { Link, useParams } from 'react-router-dom'
import {
  getReadyBusiness,
  relatedReady,
  readyTransfer,
} from '../data/offerings'
import Seo from '../components/Seo'
import '../styles/catalog.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function ReadyDetail() {
  const { id } = useParams()
  const b = id ? getReadyBusiness(id) : undefined

  if (!b) {
    return (
      <section className="section">
        <div className="container catalog-empty" style={{ marginTop: 0 }}>
          <span className="catalog-empty__emoji">🤷</span>
          <h3>Бизнес не найден</h3>
          <div className="catalog-empty__actions">
            <Link className="btn btn--primary" to="/ready">
              К витрине бизнесов
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const related = relatedReady(b.id)
  const metrics = [
    { label: 'Цена', value: `${money(b.price)} сом` },
    { label: 'Выручка/мес', value: `${money(b.revenue)} сом` },
    { label: 'Прибыль/мес', value: `${money(b.profit)} сом` },
    { label: 'Окупаемость', value: b.payback },
  ]

  return (
    <div className="detail">
      <Seo
        title={`${b.title} — ${b.city}`}
        description={`${b.description} Цена ${money(b.price)} сом, выручка ${money(b.revenue)} сом/мес, прибыль ${money(b.profit)} сом/мес.`}
        path={`/ready/${b.id}`}
        type="article"
      />
      <section className="detail-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <Link to="/ready">Готовые бизнесы</Link>
            <span>/</span>
            <span className="breadcrumb__current">{b.title}</span>
          </nav>

          <div className="detail-hero__head">
            <span className="detail-hero__emoji">{b.emoji}</span>
            <div className="detail-hero__badges">
              <span className="bcard__sphere">{b.sphere}</span>
              <span className="detail-hero__format">📍 {b.city}</span>
            </div>
          </div>

          <h1 className="detail-hero__title">{b.title}</h1>
          <p className="detail-hero__lead">{b.description}</p>

          <div className="detail-metrics">
            {metrics.map((m) => (
              <div className="dmetric" key={m.label}>
                <span className="dmetric__label">{m.label}</span>
                <span className="dmetric__value">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section detail-body">
        <div className="container detail-grid">
          <div className="detail-main">
            <div className="detail-block">
              <h2 className="detail-block__title">Что передаётся при покупке</h2>
              <ul className="checklist">
                {readyTransfer.map((item) => (
                  <li className="checklist__item" key={item}>
                    <span className="checklist__mark">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="detail-aside">
            <div className="cta-card">
              <h3 className="cta-card__title">Запросить детали бизнеса</h3>
              <p className="cta-card__text">
                Покажем финансы, документы и поможем безопасно провести сделку с
                полным юридическим сопровождением.
              </p>
              <a href="/#contacts" className="btn btn--mint cta-card__btn">
                Оставить заявку →
              </a>
              <Link to="/ready" className="cta-card__back">
                ← Ко всем бизнесам
              </Link>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="container detail-related">
            <h2 className="detail-block__title">Другие предложения</h2>
            <div className="related-grid">
              {related.map((r) => (
                <Link key={r.id} to={`/ready/${r.id}`} className="rcard">
                  <span className="rcard__emoji">{r.emoji}</span>
                  <div className="rcard__body">
                    <span className="rcard__title">{r.title}</span>
                    <span className="rcard__meta">
                      {money(r.price)} сом · {r.city}
                    </span>
                  </div>
                  <span className="rcard__arrow">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
