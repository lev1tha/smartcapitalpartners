import { Link, useParams } from 'react-router-dom'
import {
  getInvestment,
  relatedInvestments,
  investmentSafeguards,
} from '../data/offerings'
import Seo from '../components/Seo'
import '../styles/catalog.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function InvestmentDetail() {
  const { id } = useParams()
  const p = id ? getInvestment(id) : undefined

  if (!p) {
    return (
      <section className="section">
        <div className="container catalog-empty" style={{ marginTop: 0 }}>
          <span className="catalog-empty__emoji">🤷</span>
          <h3>Проект не найден</h3>
          <div className="catalog-empty__actions">
            <Link className="btn btn--primary" to="/investments">
              К инвестпредложениям
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const related = relatedInvestments(p.id)
  const metrics = [
    { label: 'Требуется инвестиций', value: `${money(p.amount)} сом` },
    { label: 'Доля', value: p.equity },
    { label: 'Прогноз доходности', value: p.roi },
    { label: 'Срок', value: p.term },
  ]

  return (
    <div className="detail">
      <Seo
        title={`Инвестпроект: ${p.title}`}
        description={`${p.description} Требуется ${money(p.amount)} сом, доля ${p.equity}, прогноз доходности ${p.roi}.`}
        path={`/investments/${p.id}`}
        type="article"
      />
      <section className="detail-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <Link to="/investments">Инвестиции</Link>
            <span>/</span>
            <span className="breadcrumb__current">{p.title}</span>
          </nav>

          <div className="detail-hero__head">
            <span className="detail-hero__emoji">{p.emoji}</span>
            <div className="detail-hero__badges">
              <span className="bcard__sphere">{p.sector}</span>
              <span className="detail-hero__format">Стадия: {p.stage}</span>
            </div>
          </div>

          <h1 className="detail-hero__title">{p.title}</h1>
          <p className="detail-hero__lead">{p.description}</p>

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
              <h2 className="detail-block__title">Как защищены инвестиции</h2>
              <ul className="checklist">
                {investmentSafeguards.map((item) => (
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
              <h3 className="cta-card__title">Запросить проект</h3>
              <p className="cta-card__text">
                Пришлём финмодель, презентацию и условия входа. Поможем проверить
                проект и безопасно оформить сделку.
              </p>
              <a href="/#contacts" className="btn btn--mint cta-card__btn">
                Стать инвестором →
              </a>
              <Link to="/investments" className="cta-card__back">
                ← Ко всем проектам
              </Link>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="container detail-related">
            <h2 className="detail-block__title">Другие проекты</h2>
            <div className="related-grid">
              {related.map((r) => (
                <Link key={r.id} to={`/investments/${r.id}`} className="rcard">
                  <span className="rcard__emoji">{r.emoji}</span>
                  <div className="rcard__body">
                    <span className="rcard__title">{r.title}</span>
                    <span className="rcard__meta">
                      {money(r.amount)} сом · доля {r.equity}
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
