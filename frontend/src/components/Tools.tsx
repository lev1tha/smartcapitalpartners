import { useState } from 'react'

const fmt = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

const stats = [
  { value: '150+', label: 'разработанных бизнес-планов' },
  { value: '30+', label: 'инвестпроектов в Бишкеке и регионах' },
  { value: '24/7', label: 'поддержка систем учёта' },
]

export default function Tools() {
  const [fixed, setFixed] = useState('')
  const [price, setPrice] = useState('')
  const [variable, setVariable] = useState('')

  const f = Number(fixed)
  const p = Number(price)
  const v = Number(variable)
  const margin = p - v
  const hasInput = fixed !== '' && price !== '' && variable !== ''
  const valid = hasInput && f >= 0 && margin > 0
  const units = valid ? Math.ceil(f / margin) : null
  const revenue = units !== null ? units * p : null

  return (
    <section className="section section--dark" id="tools">
      <div className="container">
        <div className="section__head section__head--light">
          <span className="section__eyebrow section__eyebrow--mint">
            Инструменты и цифры
          </span>
          <h2 className="section__title">Smart Capital Partners — это практическая платформа</h2>
          <p className="section__sub section__sub--light">
            Не просто статьи, а рабочие финансовые инструменты прямо в браузере.
          </p>
        </div>

        <div className="tools">
          {/* Калькулятор точки безубыточности */}
          <div className="calc">
            <div className="calc__head">
              <h3 className="calc__title">Калькулятор точки безубыточности</h3>
              <p className="calc__formula">
                Выручка = Постоянные расходы + Переменные расходы
              </p>
            </div>

            <div className="calc__fields">
              <label className="field">
                <span className="field__label">Постоянные расходы, сом/мес</span>
                <input
                  className="field__input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="например, 80 000"
                  value={fixed}
                  onChange={(e) => setFixed(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Цена за единицу, сом</span>
                <input
                  className="field__input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="например, 500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Переменные расходы на ед., сом</span>
                <input
                  className="field__input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="например, 200"
                  value={variable}
                  onChange={(e) => setVariable(e.target.value)}
                />
              </label>
            </div>

            <div className="calc__result">
              {valid && units !== null && revenue !== null ? (
                <>
                  <div className="calc__metric">
                    <span className="calc__metric-value">{fmt(units)}</span>
                    <span className="calc__metric-label">единиц в месяц</span>
                  </div>
                  <div className="calc__divider" />
                  <div className="calc__metric">
                    <span className="calc__metric-value">{fmt(revenue)} сом</span>
                    <span className="calc__metric-label">выручка для выхода в ноль</span>
                  </div>
                </>
              ) : (
                <p className="calc__hint">
                  {hasInput && margin <= 0
                    ? 'Цена должна быть выше переменных расходов на единицу.'
                    : 'Введите 3 цифры, чтобы увидеть, когда бизнес выйдет в ноль.'}
                </p>
              )}
            </div>

            <a href="#all-tools" className="btn btn--mint calc__btn">
              Открыть все финансовые инструменты →
            </a>
          </div>

          {/* Цифры */}
          <div className="stats">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <span className="stat__value">{s.value}</span>
                <span className="stat__label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
