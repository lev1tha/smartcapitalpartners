import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  businessModels,
  spheres,
  formats,
  investmentBuckets,
  type Sphere,
  type Format,
} from '../data/catalog'
import Seo from '../components/Seo'
import { useContent } from '../data/useContent'
import '../styles/catalog.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const initialSphere = (params.get('sphere') as Sphere) || 'all'

  const [query, setQuery] = useState('')
  const [sphere, setSphere] = useState<Sphere | 'all'>(
    spheres.includes(initialSphere as Sphere) ? (initialSphere as Sphere) : 'all',
  )
  const [bucket, setBucket] = useState('any')
  const [format, setFormat] = useState<Format | 'all'>('all')

  const models = useContent('models', businessModels)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const range = investmentBuckets.find((b) => b.id === bucket)!
    return models.filter((m) => {
      if (sphere !== 'all' && m.sphere !== sphere) return false
      if (format !== 'all' && m.format !== format) return false
      if (m.investment < range.min || m.investment >= range.max) return false
      if (q) {
        const hay = `${m.title} ${m.description} ${(m.tags ?? []).join(' ')} ${m.sphere}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [models, query, sphere, bucket, format])

  const isFiltered =
    query !== '' || sphere !== 'all' || bucket !== 'any' || format !== 'all'

  function reset() {
    setQuery('')
    setSphere('all')
    setBucket('any')
    setFormat('all')
    setParams({})
  }

  function pickSphere(s: Sphere | 'all') {
    setSphere(s)
    if (s === 'all') setParams({})
    else setParams({ sphere: s })
  }

  return (
    <div className="catalog">
      <Seo
        title="Каталог бизнес-моделей"
        description="12 проверенных бизнес-моделей для старта в Кыргызстане. Фильтр по сфере, бюджету и формату — выберите модель с понятной экономикой и окупаемостью."
        path="/catalog"
      />
      {/* Hero страницы */}
      <section className="catalog-hero">
        <div className="container">
          <Link to="/" className="catalog-hero__back">
            ← На главную
          </Link>
          <span className="catalog-hero__eyebrow">Каталог бизнес-моделей</span>
          <h1 className="catalog-hero__title">Найдите модель бизнеса под себя</h1>
          <p className="catalog-hero__lead">
            {models.length} проверенных моделей для старта в Кыргызстане.
            Отфильтруйте по сфере, бюджету и формату — и получите подходящие
            варианты с понятной экономикой.
          </p>

          <div className="catalog-search">
            <span className="catalog-search__icon">⌕</span>
            <input
              className="catalog-search__input"
              placeholder="Поиск: кофейня, доставка, онлайн…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Фильтры + результаты */}
      <section className="section catalog-body">
        <div className="container">
          <div className="filters">
            <div className="filter-group">
              <span className="filter-group__label">Сфера</span>
              <div className="filter-chips">
                <button
                  className={`fchip ${sphere === 'all' ? 'is-active' : ''}`}
                  onClick={() => pickSphere('all')}
                >
                  Все
                </button>
                {spheres.map((s) => (
                  <button
                    key={s}
                    className={`fchip ${sphere === s ? 'is-active' : ''}`}
                    onClick={() => pickSphere(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-group__label">Бюджет на старт</span>
              <div className="filter-chips">
                {investmentBuckets.map((b) => (
                  <button
                    key={b.id}
                    className={`fchip ${bucket === b.id ? 'is-active' : ''}`}
                    onClick={() => setBucket(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-group__label">Формат</span>
              <div className="filter-chips">
                <button
                  className={`fchip ${format === 'all' ? 'is-active' : ''}`}
                  onClick={() => setFormat('all')}
                >
                  Любой
                </button>
                {formats.map((f) => (
                  <button
                    key={f}
                    className={`fchip ${format === f ? 'is-active' : ''}`}
                    onClick={() => setFormat(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="catalog-meta">
            <span className="catalog-meta__count">
              Найдено: <strong>{results.length}</strong>
            </span>
            {isFiltered && (
              <button className="catalog-meta__reset" onClick={reset}>
                Сбросить фильтры ✕
              </button>
            )}
          </div>

          {results.length > 0 ? (
            <div className="catalog-grid">
              {results.map((m) => (
                <Link key={m.id} to={`/catalog/${m.id}`} className="bcard">
                  {m.featured && <span className="bcard__flag">Хит</span>}
                  <div className="bcard__top">
                    <span className="bcard__emoji">{m.emoji}</span>
                    <span className="bcard__sphere">{m.sphere}</span>
                  </div>
                  <h3 className="bcard__title">{m.title}</h3>
                  <p className="bcard__desc">{m.description}</p>

                  <div className="bcard__stats">
                    <div className="bstat">
                      <span className="bstat__label">Вложения от</span>
                      <span className="bstat__value">{money(m.investment)} сом</span>
                    </div>
                    <div className="bstat">
                      <span className="bstat__label">Окупаемость</span>
                      <span className="bstat__value">{m.payback}</span>
                    </div>
                  </div>

                  <div className="bcard__tags">
                    {m.tags.map((t) => (
                      <span key={t} className="btag">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="bcard__foot">
                    <span className="bcard__format">{m.format}</span>
                    <span className="bcard__cta">Подробнее →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="catalog-empty">
              <span className="catalog-empty__emoji">🔍</span>
              <h3>Ничего не нашлось</h3>
              <p>
                Под выбранные параметры нет готовой модели. Попробуйте смягчить
                фильтры или оставьте заявку — подберём вариант индивидуально.
              </p>
              <div className="catalog-empty__actions">
                <button className="btn btn--primary" onClick={reset}>
                  Сбросить фильтры
                </button>
                <a href="#contacts" className="btn btn--secondary">
                  Подобрать индивидуально
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
