import { useState } from 'react'
import { Link } from 'react-router-dom'
import { spheres, investmentBuckets } from '../data/catalog'
import {
  included,
  steps,
  planSections,
  faq,
  cities,
  serviceOptions,
} from '../data/turnkey'
import Seo from '../components/Seo'
import '../styles/turnkey.css'

type SubmitStatus = 'idle' | 'sending' | 'ok' | 'err'

export default function Turnkey() {
  const [sphere, setSphere] = useState('')
  const [budget, setBudget] = useState('')
  const [city, setCity] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [openFaq, setOpenFaq] = useState(0)

  function toggleService(s: string) {
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const payload = { sphere, budget, city, services, name, phone }
    try {
      const res = await fetch('/api/turnkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('ok')
    } catch {
      setStatus('err')
    }
  }

  return (
    <div className="turnkey">
      <Seo
        title="Бизнес под ключ"
        description="Запуск бизнеса под ключ в Кыргызстане: подбор модели, финмодель, бизнес-план, регистрация и сопровождение. От идеи до первой прибыли."
        path="/turnkey"
      />
      {/* Hero */}
      <section className="tk-hero">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span className="breadcrumb__current">Бизнес под ключ</span>
          </nav>
          <span className="tk-hero__eyebrow">Услуга «под ключ»</span>
          <h1 className="tk-hero__title">
            Запустим ваш бизнес под ключ — от идеи до первой прибыли
          </h1>
          <p className="tk-hero__lead">
            Берём на себя всё: подбираем бизнес-модель, считаем экономику, готовим
            бизнес-план, регистрируем компанию и помогаем с запуском. Вам остаётся
            принимать решения и зарабатывать.
          </p>
          <div className="tk-hero__actions">
            <a href="#constructor" className="btn btn--primary">
              Рассчитать мой бизнес →
            </a>
            <a href="#how" className="btn btn--secondary">
              Как мы работаем
            </a>
          </div>
        </div>
      </section>

      {/* Что входит */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="section__eyebrow">Что входит</span>
            <h2 className="section__title">Полный цикл запуска бизнеса</h2>
            <p className="section__sub">
              Один подрядчик закрывает все задачи старта — без десятка фрилансеров
              и потери времени.
            </p>
          </div>
          <div className="tk-grid">
            {included.map((it) => (
              <div className="tk-card" key={it.title}>
                <span className="tk-card__emoji">{it.emoji}</span>
                <h3 className="tk-card__title">{it.title}</h3>
                <p className="tk-card__text">{it.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Как мы работаем */}
      <section className="section section--soft" id="how">
        <div className="container">
          <div className="section__head">
            <span className="section__eyebrow">Этапы</span>
            <h2 className="section__title">Как мы работаем</h2>
          </div>
          <div className="tk-steps">
            {steps.map((s, i) => (
              <div className="tk-step" key={s.title}>
                <span className="tk-step__num">{i + 1}</span>
                <h3 className="tk-step__title">{s.title}</h3>
                <p className="tk-step__text">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Что в бизнес-плане */}
      <section className="section">
        <div className="container tk-plan">
          <div className="tk-plan__text">
            <span className="section__eyebrow">Документ</span>
            <h2 className="section__title">Что входит в бизнес-план</h2>
            <p className="section__sub" style={{ margin: '12px 0 0' }}>
              Готовим инвестиционный бизнес-план под требования банков и
              инвесторов Кыргызстана. Вы получаете документ, с которым можно идти
              за финансированием.
            </p>
          </div>
          <ul className="tk-plan__list">
            {planSections.map((sec, i) => (
              <li className="tk-plan__item" key={sec}>
                <span className="tk-plan__num">{String(i + 1).padStart(2, '0')}</span>
                {sec}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Конструктор-заявка */}
      <section className="section section--dark" id="constructor">
        <div className="container">
          <div className="section__head section__head--light">
            <span className="section__eyebrow section__eyebrow--mint">Конструктор</span>
            <h2 className="section__title">Соберите свой проект под ключ</h2>
            <p className="section__sub section__sub--light">
              Выберите параметры — подготовим расчёт и предложение под вашу
              ситуацию.
            </p>
          </div>

          {status === 'ok' ? (
            <div className="tk-success">
              <span className="tk-success__emoji">✅</span>
              <h3>Заявка принята!</h3>
              <p>
                Специалист MF PRO свяжется с вами в ближайшее время и подготовит
                расчёт под ваш проект.
              </p>
              <div className="tk-success__actions">
                <Link to="/catalog" className="btn btn--mint">
                  Посмотреть каталог моделей
                </Link>
              </div>
            </div>
          ) : (
            <form className="tk-form" onSubmit={submit}>
              <div className="tk-field">
                <span className="tk-field__label">1. Сфера бизнеса</span>
                <div className="tk-chips">
                  {spheres.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={`tk-chip ${sphere === s ? 'is-active' : ''}`}
                      onClick={() => setSphere(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tk-field">
                <span className="tk-field__label">2. Бюджет на старт</span>
                <div className="tk-chips">
                  {investmentBuckets
                    .filter((b) => b.id !== 'any')
                    .map((b) => (
                      <button
                        type="button"
                        key={b.id}
                        className={`tk-chip ${budget === b.label ? 'is-active' : ''}`}
                        onClick={() => setBudget(b.label)}
                      >
                        {b.label}
                      </button>
                    ))}
                </div>
              </div>

              <div className="tk-field">
                <span className="tk-field__label">3. Город</span>
                <div className="tk-chips">
                  {cities.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`tk-chip ${city === c ? 'is-active' : ''}`}
                      onClick={() => setCity(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tk-field">
                <span className="tk-field__label">4. Что нужно сделать</span>
                <div className="tk-chips">
                  {serviceOptions.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={`tk-chip tk-chip--check ${services.includes(s) ? 'is-active' : ''}`}
                      onClick={() => toggleService(s)}
                    >
                      {services.includes(s) ? '✓ ' : ''}
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tk-field">
                <span className="tk-field__label">5. Контакты</span>
                <div className="tk-inputs">
                  <input
                    className="tk-input"
                    placeholder="Ваше имя"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <input
                    className="tk-input"
                    placeholder="Телефон / WhatsApp"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                className="btn btn--mint tk-form__submit"
                type="submit"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Отправляем…' : 'Получить расчёт под ключ →'}
              </button>
              {status === 'err' && (
                <p className="tk-form__err">
                  Не удалось отправить — проверьте, запущен ли бэкенд, или
                  напишите нам в мессенджеры.
                </p>
              )}
            </form>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container tk-faq">
          <div className="section__head" style={{ textAlign: 'left', margin: '0 0 28px' }}>
            <span className="section__eyebrow">Вопросы</span>
            <h2 className="section__title">Частые вопросы</h2>
          </div>
          <div className="accordion">
            {faq.map((item, i) => {
              const isOpen = openFaq === i
              return (
                <div className={`accordion__item ${isOpen ? 'is-open' : ''}`} key={item.q}>
                  <button
                    className="accordion__head"
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <span className="accordion__sign">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && <p className="accordion__body">{item.a}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
