import { cases, team, testimonials } from '../data/trust'
import './Trust.css'

export default function Trust() {
  return (
    <>
      {/* Кейсы */}
      <section className="section section--soft" id="cases">
        <div className="container">
          <div className="section__head">
            <span className="section__eyebrow">Результаты</span>
            <h2 className="section__title">Кейсы наших клиентов</h2>
            <p className="section__sub">
              Реальные запуски в Кыргызстане — с понятными цифрами.
            </p>
          </div>
          <div className="cases-grid">
            {cases.map((c) => (
              <div className="case-card" key={c.title}>
                <div className="case-card__head">
                  <span className="case-card__emoji">{c.emoji}</span>
                  <div>
                    <span className="case-card__title">{c.title}</span>
                    <span className="case-card__city">{c.city}</span>
                  </div>
                </div>
                <p className="case-card__result">{c.result}</p>
                <div className="case-card__metric">
                  <span className="case-card__metric-value">{c.metric}</span>
                  <span className="case-card__metric-label">{c.metricLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Команда */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="section__eyebrow">Команда</span>
            <h2 className="section__title">Эксперты Smart Capital Partners</h2>
            <p className="section__sub">
              Финансы, маркетинг и юриспруденция — в одной команде.
            </p>
          </div>
          <div className="team-grid">
            {team.map((m) => (
              <div className="team-card" key={m.name}>
                <span className="team-card__emoji">{m.emoji}</span>
                <span className="team-card__name">{m.name}</span>
                <span className="team-card__role">{m.role}</span>
                <span className="team-card__exp">{m.experience}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Отзывы */}
      <section className="section section--soft">
        <div className="container">
          <div className="section__head">
            <span className="section__eyebrow">Отзывы</span>
            <h2 className="section__title">Что говорят клиенты</h2>
          </div>
          <div className="reviews-grid">
            {testimonials.map((t) => (
              <figure className="review-card" key={t.name}>
                <span className="review-card__quote">“</span>
                <blockquote className="review-card__text">{t.text}</blockquote>
                <figcaption className="review-card__author">
                  <strong>{t.name}</strong>
                  <span>{t.business}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
