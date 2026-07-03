import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container">
        <span className="hero__eyebrow">Маркетинг · Финансы · Кыргызстан</span>
        <h1 className="hero__title">
          Маркетинг и финансы для вашего бизнеса в Кыргызстане
        </h1>
        <p className="hero__lead">
          Помогаем запускать, масштабировать и автоматизировать бизнес-процессы.
          От идеи до стабильной прибыли.
        </p>

        <div className="start-banner" id="start">
          <div className="start-banner__glow" aria-hidden="true" />
          <div className="start-banner__content">
            <span className="start-banner__badge">● Бесплатно</span>
            <h2 className="start-banner__title">Пора начать свой бизнес!</h2>
            <p className="start-banner__text">
              Не откладывайте мечты на завтра. Пройдите бесплатный экспресс-тест
              на готовность вашей бизнес-идеи или запишитесь на первичную
              консультацию.
            </p>
            <div className="start-banner__actions">
              <Link className="btn btn--mint" to="/test">
                Пройти тест →
              </Link>
              <a className="btn btn--ghost-light" href="#contacts">
                Записаться на консультацию
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
