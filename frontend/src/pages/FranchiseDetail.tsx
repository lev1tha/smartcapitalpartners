import { Link, useParams } from 'react-router-dom'
import {
  getFranchise,
  relatedFranchises,
  franchiseIncludes,
} from '../data/offerings'
import Seo from '../components/Seo'
import '../styles/catalog.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function FranchiseDetail() {
  const { id } = useParams()
  const f = id ? getFranchise(id) : undefined

  if (!f) {
    return (
      <section className="section">
        <div className="container catalog-empty" style={{ marginTop: 0 }}>
          <span className="catalog-empty__emoji">🤷</span>
          <h3>Франшиза не найдена</h3>
          <div className="catalog-empty__actions">
            <Link className="btn btn--primary" to="/franchises">
              К каталогу франшиз
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const related = relatedFranchises(f.id)
  const metrics = [
    { label: 'Вложения от', value: `${money(f.investment)} сом` },
    { label: 'Паушальный взнос', value: `${money(f.paushal)} сом` },
    { label: 'Роялти', value: f.royalty },
    { label: 'Окупаемость', value: f.payback },
  ]

  return (
    <div className="detail">
      <Seo
        title={`Франшиза ${f.brand}`}
        description={`${f.description} Вложения от ${money(f.investment)} сом, паушальный взнос ${money(f.paushal)} сом, окупаемость ${f.payback}.`}
        path={`/franchises/${f.id}`}
        type="article"
      />
      <section className="detail-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <Link to="/franchises">Франшизы</Link>
            <span>/</span>
            <span className="breadcrumb__current">{f.brand}</span>
          </nav>

          <div className="detail-hero__head">
            <span className="detail-hero__emoji">{f.emoji}</span>
            <div className="detail-hero__badges">
              <span className="bcard__sphere">{f.category}</span>
              <span className="detail-hero__format">{f.points} точек в сети</span>
            </div>
          </div>

          <h1 className="detail-hero__title">{f.brand}</h1>
          <p className="detail-hero__lead">{f.description}</p>

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
              <h2 className="detail-block__title">Что входит во франшизу</h2>
              <ul className="checklist">
                {franchiseIncludes.map((item) => (
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
              <h3 className="cta-card__title">Получить условия франшизы</h3>
              <p className="cta-card__text">
                Пришлём полную презентацию, финмодель и условия договора. Поможем
                оценить и запустить точку.
              </p>
              <a href="/#contacts" className="btn btn--mint cta-card__btn">
                Оставить заявку →
              </a>
              <Link to="/franchises" className="cta-card__back">
                ← Ко всем франшизам
              </Link>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="container detail-related">
            <h2 className="detail-block__title">Другие франшизы</h2>
            <div className="related-grid">
              {related.map((r) => (
                <Link key={r.id} to={`/franchises/${r.id}`} className="rcard">
                  <span className="rcard__emoji">{r.emoji}</span>
                  <div className="rcard__body">
                    <span className="rcard__title">{r.brand}</span>
                    <span className="rcard__meta">
                      от {money(r.investment)} сом · {r.payback}
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
