import { useState } from 'react'
import { Link } from 'react-router-dom'

const faqs = [
  {
    q: 'Что такое бизнес и предпринимательство?',
    a: 'Бизнес — это любое дело, нацеленное на получение прибыли. Если вы вкладываете собственные умения, время и деньги в создание товаров или предоставление услуг и рассчитываете заработать на этом — вы предприниматель.',
  },
  {
    q: 'С чего начать, если идеи пока нет?',
    a: 'Начните с анализа рынка и собственных навыков. Пройдите экспресс-тест на готовность, изучите каталог франшиз и готовых бизнесов — это даёт быстрый старт с понятной экономикой.',
  },
  {
    q: 'Нужен ли бизнес-план для маленького дела?',
    a: 'Да. Даже простая финансовая модель показывает точку безубыточности и помогает не уйти в минус. Для привлечения инвестиций или кредита бизнес-план обязателен.',
  },
]

const businessTypes = [
  { tag: 'B2B', text: 'Продажи и услуги для других компаний' },
  { tag: 'B2C', text: 'Товары и сервисы для конечных потребителей' },
  { tag: 'Производство', text: 'Создание продукции своими мощностями' },
  { tag: 'Услуги', text: 'Экспертиза, сервис, аутсорсинг' },
  { tag: 'Торговля', text: 'Закуп и перепродажа товаров' },
]

const taxRegimes = [
  {
    name: 'Патент',
    text: 'Фиксированная сумма для мелкой деятельности. Минимум отчётности.',
  },
  {
    name: 'Единый налог',
    text: 'Процент с выручки для малого бизнеса. Простой учёт.',
  },
  {
    name: 'Общий режим',
    text: 'Полный учёт НДС и налога на прибыль для растущих компаний.',
  },
]

export default function KnowledgeBase() {
  const [open, setOpen] = useState(0)

  return (
    <section className="section" id="knowledge">
      <div className="container">
        <div className="section__head">
          <span className="section__eyebrow">База знаний</span>
          <h2 className="section__title">Коротко о главном</h2>
          <p className="section__sub">
            Разбираем базовые вопросы предпринимательства простым языком.
          </p>
        </div>

        <div className="kb">
          {/* Аккордеон */}
          <div className="accordion">
            {faqs.map((item, i) => {
              const isOpen = open === i
              return (
                <div className={`accordion__item ${isOpen ? 'is-open' : ''}`} key={item.q}>
                  <button
                    className="accordion__head"
                    onClick={() => setOpen(isOpen ? -1 : i)}
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

          {/* Виды бизнеса + налоговые режимы */}
          <div className="kb__side">
            <div className="kb__panel">
              <h3 className="kb__panel-title">Виды бизнеса</h3>
              <div className="chips">
                {businessTypes.map((b) => (
                  <div className="chip" key={b.tag}>
                    <span className="chip__tag">{b.tag}</span>
                    <span className="chip__text">{b.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="kb__panel kb__panel--dark">
              <h3 className="kb__panel-title">Налоговые режимы в КР</h3>
              <ul className="regimes">
                {taxRegimes.map((r) => (
                  <li className="regime" key={r.name}>
                    <span className="regime__name">{r.name}</span>
                    <span className="regime__text">{r.text}</span>
                  </li>
                ))}
              </ul>
              <Link to="/taxes" className="kb__link">
                Подробнее о налогах →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
