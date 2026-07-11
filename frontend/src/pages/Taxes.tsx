import { useState } from 'react'
import { Link } from 'react-router-dom'
import { taxRegimes, singleTaxRates } from '../data/taxes'
import Seo from '../components/Seo'
import '../styles/taxes.css'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

export default function Taxes() {
  const [revenue, setRevenue] = useState('')
  const [rateIdx, setRateIdx] = useState(0)

  const r = Number(revenue)
  const rate = singleTaxRates[rateIdx].rate
  const tax = revenue !== '' && r >= 0 ? Math.round(r * rate) : null

  return (
    <div className="taxes">
      <Seo
        title="Налоговые режимы в Кыргызстане + калькулятор"
        description="Патент, единый налог и общий режим в КР простыми словами. Сравнение режимов и калькулятор единого налога. Поможем выбрать выгодный режим."
        path="/taxes"
      />
      <section className="taxes-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span className="breadcrumb__current">Налоги в КР</span>
          </nav>
          <span className="taxes-hero__eyebrow">База знаний</span>
          <h1 className="taxes-hero__title">Налоговые режимы в Кыргызстане</h1>
          <p className="taxes-hero__lead">
            Патент, единый налог и общий режим — простыми словами. Поможем выбрать
            выгодный режим и зарегистрировать бизнес правильно.
          </p>
        </div>
      </section>

      {/* Сравнение режимов */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="section__eyebrow">Сравнение</span>
            <h2 className="section__title">Три режима налогообложения</h2>
          </div>
          <div className="tax-grid">
            {taxRegimes.map((t) => (
              <div className="tax-card" key={t.id}>
                <span className="tax-card__emoji">{t.emoji}</span>
                <h3 className="tax-card__name">{t.name}</h3>
                <div className="tax-card__rate">{t.rate}</div>

                <span className="tax-card__label">Кому подходит</span>
                <p className="tax-card__text">{t.forWhom}</p>

                <span className="tax-card__label">Отчётность</span>
                <p className="tax-card__text">{t.reporting}</p>

                <div className="tax-card__lists">
                  <ul className="tax-list tax-list--pro">
                    {t.pros.map((p) => (
                      <li key={p}>+ {p}</li>
                    ))}
                  </ul>
                  <ul className="tax-list tax-list--con">
                    {t.cons.map((c) => (
                      <li key={c}>− {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Калькулятор единого налога */}
      <section className="section section--dark" id="calc">
        <div className="container">
          <div className="section__head section__head--light">
            <span className="section__eyebrow section__eyebrow--mint">Калькулятор</span>
            <h2 className="section__title">Прикиньте единый налог</h2>
            <p className="section__sub section__sub--light">
              Введите выручку за месяц и выберите вид деятельности.
            </p>
          </div>

          <div className="tax-calc">
            <div className="tax-calc__fields">
              <label className="field">
                <span className="field__label">Выручка за месяц, сом</span>
                <input
                  className="field__input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="например, 500 000"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Вид деятельности</span>
                <select
                  className="field__input"
                  value={rateIdx}
                  onChange={(e) => setRateIdx(Number(e.target.value))}
                >
                  {singleTaxRates.map((s, i) => (
                    <option key={s.label} value={i}>
                      {s.label} — {(s.rate * 100).toFixed(0)}%
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="tax-calc__result">
              {tax !== null ? (
                <>
                  <div className="tax-calc__metric">
                    <span className="tax-calc__value">{money(tax)} сом</span>
                    <span className="tax-calc__sub">единый налог в месяц</span>
                  </div>
                  <div className="tax-calc__metric">
                    <span className="tax-calc__value">{money(tax * 12)} сом</span>
                    <span className="tax-calc__sub">за год</span>
                  </div>
                </>
              ) : (
                <p className="tax-calc__hint">Введите выручку, чтобы увидеть расчёт.</p>
              )}
            </div>

            <p className="tax-calc__disclaimer">
              ⚠️ Ставки иллюстративные и зависят от вида деятельности, района и
              формы расчёта. Актуальные значения уточняйте в ГНС КР — или закажите
              точный расчёт у специалиста Smart Capital Partners.
            </p>
            <a href="/#contacts" className="btn btn--mint tax-calc__btn">
              Подобрать налоговый режим →
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
