import { Link, useParams } from 'react-router-dom'
import {
  businessModels,
  getOps,
  costBreakdown,
  whatYouGet,
  launchSteps,
  type ModelOps,
} from '../data/catalog'
import { useContent } from '../data/useContent'
import Seo from '../components/Seo'
import '../styles/catalog.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function CatalogDetail() {
  const { id } = useParams()
  const models = useContent('models', businessModels)
  const model = id ? models.find((m) => m.id === id) : undefined

  // Модель не найдена
  if (!model) {
    return (
      <section className="section">
        <div className="container catalog-empty" style={{ marginTop: 0 }}>
          <span className="catalog-empty__emoji">🤷</span>
          <h3>Модель не найдена</h3>
          <p>Возможно, ссылка устарела. Вернитесь в каталог и выберите модель.</p>
          <div className="catalog-empty__actions">
            <Link className="btn btn--primary" to="/catalog">
              В каталог
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const breakdown = costBreakdown(model)
  const related = models
    .filter((m) => m.id !== model.id && m.sphere === model.sphere)
    .slice(0, 3)
  const ops: ModelOps | undefined =
    (model as { ops?: ModelOps }).ops ?? getOps(model.id)
  const metrics = [
    { label: 'Вложения от', value: `${money(model.investment)} сом` },
    { label: 'Окупаемость', value: model.payback },
    { label: 'Чистая маржа', value: model.margin },
    { label: 'Средний чек', value: model.avgCheck },
  ]

  return (
    <div className="detail">
      <Seo
        title={`${model.title} — бизнес-модель`}
        description={`${model.description} Вложения от ${money(model.investment)} сом, окупаемость ${model.payback}, маржа ${model.margin}.`}
        path={`/catalog/${model.id}`}
        type="article"
      />
      {/* Hero */}
      <section className="detail-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <Link to="/catalog">Каталог</Link>
            <span>/</span>
            <span className="breadcrumb__current">{model.title}</span>
          </nav>

          <div className="detail-hero__head">
            <span className="detail-hero__emoji">{model.emoji}</span>
            <div className="detail-hero__badges">
              <span className="bcard__sphere">{model.sphere}</span>
              <span className="detail-hero__format">{model.format}</span>
              {model.featured && <span className="bcard__flag detail-hero__flag">Хит</span>}
            </div>
          </div>

          <h1 className="detail-hero__title">{model.title}</h1>
          <p className="detail-hero__lead">{model.longDescription}</p>

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

      {/* Body */}
      <section className="section detail-body">
        <div className="container detail-grid">
          <div className="detail-main">
            {ops && (
              <div className="detail-block">
                <h2 className="detail-block__title">Параметры запуска</h2>
                <div className="ops-grid">
                  <div className="ops-item">
                    <span className="ops-item__label">⏱ Срок запуска</span>
                    <span className="ops-item__value">{ops.launchTime}</span>
                  </div>
                  <div className="ops-item">
                    <span className="ops-item__label">👥 Команда</span>
                    <span className="ops-item__value">{ops.team}</span>
                  </div>
                  <div className="ops-item">
                    <span className="ops-item__label">📐 Помещение</span>
                    <span className="ops-item__value">{ops.space}</span>
                  </div>
                  <div className="ops-item">
                    <span className="ops-item__label">🧾 Налоговый режим</span>
                    <span className="ops-item__value">{ops.taxRegime}</span>
                  </div>
                  <div className="ops-item ops-item--wide">
                    <span className="ops-item__label">📅 Сезонность</span>
                    <span className="ops-item__value">{ops.seasonality}</span>
                  </div>
                </div>
              </div>
            )}

            {ops && (
              <div className="detail-block">
                <h2 className="detail-block__title">Лицензии и разрешения в КР</h2>
                <div className="bcard__tags detail-tags">
                  {ops.licenses.map((l) => (
                    <span key={l} className="btag btag--license">
                      📄 {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ops && (
              <div className="detail-block">
                <h2 className="detail-block__title">Риски и нюансы</h2>
                <ul className="risks">
                  {ops.risks.map((r) => (
                    <li className="risk" key={r}>
                      <span className="risk__mark">!</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="detail-block">
              <h2 className="detail-block__title">Что вы получаете с Smart Capital Partners</h2>
              <ul className="checklist">
                {whatYouGet.map((item) => (
                  <li className="checklist__item" key={item}>
                    <span className="checklist__mark">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="detail-block">
              <h2 className="detail-block__title">Этапы запуска</h2>
              <ol className="steps">
                {launchSteps.map((s, i) => (
                  <li className="step" key={s.title}>
                    <span className="step__num">{i + 1}</span>
                    <div className="step__body">
                      <span className="step__title">{s.title}</span>
                      <span className="step__text">{s.text}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="detail-block">
              <h2 className="detail-block__title">Подходит, если вам важно</h2>
              <div className="bcard__tags detail-tags">
                {model.tags.map((t) => (
                  <span key={t} className="btag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Aside */}
          <aside className="detail-aside">
            <div className="cost-card">
              <h3 className="cost-card__title">Структура стартовых вложений</h3>
              <p className="cost-card__note">Ориентировочно, от {money(model.investment)} сом</p>
              <div className="cost-rows">
                {breakdown.map((b) => (
                  <div className="cost-row" key={b.label}>
                    <div className="cost-row__head">
                      <span className="cost-row__label">{b.label}</span>
                      <span className="cost-row__amount">
                        {money(Math.round(model.investment * b.pct))} сом
                      </span>
                    </div>
                    <div className="cost-bar">
                      <div className="cost-bar__fill" style={{ width: `${b.pct * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="cost-card__total">
                <span>Итого от</span>
                <strong>{money(model.investment)} сом</strong>
              </div>
            </div>

            <div className="cta-card">
              <h3 className="cta-card__title">Получите детальный расчёт</h3>
              <p className="cta-card__text">
                Посчитаем экономику под ваш город и бюджет, подготовим бизнес-план и
                поможем с запуском.
              </p>
              <a href="#contacts" className="btn btn--mint cta-card__btn">
                Оставить заявку →
              </a>
              <Link to="/catalog" className="cta-card__back">
                ← Вернуться в каталог
              </Link>
            </div>
          </aside>
        </div>

        {/* Похожие модели */}
        {related.length > 0 && (
          <div className="container detail-related">
            <h2 className="detail-block__title">Похожие модели в сфере «{model.sphere}»</h2>
            <div className="related-grid">
              {related.map((r) => (
                <Link key={r.id} to={`/catalog/${r.id}`} className="rcard">
                  <span className="rcard__emoji">{r.emoji}</span>
                  <div className="rcard__body">
                    <span className="rcard__title">{r.title}</span>
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
