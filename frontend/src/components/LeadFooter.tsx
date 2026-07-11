import { useState } from 'react'
import { Link } from 'react-router-dom'

type Status = 'idle' | 'sending' | 'ok' | 'err'

export default function LeadFooter() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [topic, setTopic] = useState('Финансы')
  const [status, setStatus] = useState<Status>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, topic }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('ok')
      setName('')
      setPhone('')
    } catch {
      setStatus('err')
    }
  }

  return (
    <footer className="footer" id="contacts">
      <div className="container">
        <div className="lead">
          <div className="lead__text">
            <h2 className="lead__title">
              Остались вопросы по маркетингу или финансам?
            </h2>
            <p className="lead__sub">
              Оставьте заявку, и наш эксперт свяжется с вами в течение 15 минут.
            </p>
          </div>

          <form className="lead__form" onSubmit={submit}>
            <input
              className="lead__input"
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="lead__input"
              placeholder="Телефон / WhatsApp"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <select
              className="lead__input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option>Финансы</option>
              <option>Маркетинг</option>
              <option>Инвестиции</option>
              <option>Франшизы</option>
              <option>Готовый бизнес</option>
            </select>
            <button
              className="btn btn--mint"
              type="submit"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Отправляем…' : 'Оставить заявку'}
            </button>
            {status === 'ok' && (
              <p className="lead__msg lead__msg--ok">
                ✓ Заявка принята! Эксперт скоро свяжется с вами.
              </p>
            )}
            {status === 'err' && (
              <p className="lead__msg lead__msg--err">
                Не удалось отправить. Проверьте, запущен ли бэкенд.
              </p>
            )}
          </form>
        </div>

        <div className="footer__bottom">
          <div className="footer__brand">
            <div className="footer__brand-mark">
              <img src="/logo-emblem.svg" alt="" className="footer__emblem" />
              Smart Capital Partners
            </div>
            <p>Маркетинг и финансы для бизнеса в Кыргызстане.</p>
          </div>

          <div className="footer__col">
            <span className="footer__col-title">Направления</span>
            <Link to="/catalog">Каталог моделей</Link>
            <Link to="/franchises">Франшизы</Link>
            <Link to="/investments">Инвестиции</Link>
            <Link to="/ready">Готовые бизнесы</Link>
            <Link to="/turnkey">Бизнес под ключ</Link>
          </div>

          <div className="footer__col">
            <span className="footer__col-title">Полезное</span>
            <Link to="/test">Экспресс-тест</Link>
            <Link to="/taxes">Налоги в КР</Link>
            <Link to="/#knowledge">База знаний</Link>
            <a href="#contacts">Консультация</a>
          </div>

          <div className="footer__col">
            <span className="footer__col-title">Контакты</span>
            <a href="https://t.me" target="_blank" rel="noreferrer">
              Telegram-бот
            </a>
            <a href="https://wa.me" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a href="#instagram">Instagram</a>
          </div>
        </div>

        <div className="footer__legal">
          <span>ОсОО «Smart Capital Partners» · Бишкек, Кыргызстан</span>
          <span>© 2026 Все права защищены</span>
        </div>
      </div>
    </footer>
  )
}
