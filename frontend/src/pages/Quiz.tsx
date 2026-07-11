import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  quizQuestions,
  maxScore,
  getResultLevel,
} from '../data/quiz'
import Seo from '../components/Seo'
import '../styles/quiz.css'

type Stage = 'intro' | 'questions' | 'contact' | 'done'
type SubmitStatus = 'idle' | 'sending' | 'ok' | 'err'

export default function Quiz() {
  const [stage, setStage] = useState<Stage>('intro')
  const [step, setStep] = useState(0)
  // answers[i] = индекс выбранного варианта
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => quizQuestions.map(() => null),
  )
  const [contact, setContact] = useState({ name: '', phone: '', email: '' })
  const [status, setStatus] = useState<SubmitStatus>('idle')

  const total = quizQuestions.length
  const score = useMemo(
    () =>
      answers.reduce<number>((sum, ai, i) => {
        if (ai === null) return sum
        return sum + quizQuestions[i].options[ai].score
      }, 0),
    [answers],
  )
  const level = getResultLevel(score)

  function choose(optionIndex: number) {
    setAnswers((prev) => {
      const next = [...prev]
      next[step] = optionIndex
      return next
    })
    // авто-переход на следующий вопрос/контакты
    window.setTimeout(() => {
      if (step < total - 1) setStep((s) => s + 1)
      else setStage('contact')
    }, 220)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')

    const payload = {
      contact,
      score,
      maxScore,
      level: level.title,
      answers: quizQuestions.map((q, i) => ({
        question: q.question,
        answer: answers[i] !== null ? q.options[answers[i]!].label : '—',
      })),
    }

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('ok')
      setStage('done')
    } catch {
      // Даже если бэкенд недоступен — показываем результат, статус ошибки для заявки
      setStatus('err')
      setStage('done')
    }
  }

  /* -------- INTRO -------- */
  if (stage === 'intro') {
    return (
      <div className="quiz">
        <Seo
          title="Экспресс-тест готовности к бизнесу"
          description="Бесплатный тест за 2 минуты: оцените готовность вашей бизнес-идеи и получите персональную рекомендацию специалиста Smart Capital Partners."
          path="/test"
        />
        <div className="quiz__card quiz__intro">
          <span className="quiz__eyebrow">Бесплатный экспресс-тест</span>
          <h1 className="quiz__title">Готов ли ваш бизнес к запуску?</h1>
          <p className="quiz__lead">
            {total} коротких вопросов — около 2 минут. В конце вы получите оценку
            готовности и персональную рекомендацию специалиста Smart Capital Partners.
          </p>
          <ul className="quiz__perks">
            <li>✓ Оценка готовности вашей идеи</li>
            <li>✓ Где сильные стороны, а где пробелы</li>
            <li>✓ Конкретный следующий шаг</li>
          </ul>
          <button className="btn btn--primary quiz__start" onClick={() => setStage('questions')}>
            Начать тест →
          </button>
          <Link to="/" className="quiz__back">
            ← На главную
          </Link>
        </div>
      </div>
    )
  }

  /* -------- QUESTIONS -------- */
  if (stage === 'questions') {
    const q = quizQuestions[step]
    const progress = Math.round(((step) / total) * 100)
    return (
      <div className="quiz">
        <Seo
          title="Экспресс-тест готовности к бизнесу"
          description="Бесплатный тест за 2 минуты: оцените готовность вашей бизнес-идеи и получите персональную рекомендацию специалиста Smart Capital Partners."
          path="/test"
        />
        <div className="quiz__card">
          <div className="quiz__progress">
            <div className="quiz__progress-bar">
              <div className="quiz__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="quiz__progress-label">
              Вопрос {step + 1} из {total}
            </span>
          </div>

          <h2 className="quiz__question">{q.question}</h2>
          {q.hint && <p className="quiz__hint">{q.hint}</p>}

          <div className="quiz__options">
            {q.options.map((opt, i) => (
              <button
                key={opt.label}
                className={`quiz__option ${answers[step] === i ? 'is-selected' : ''}`}
                onClick={() => choose(i)}
              >
                <span className="quiz__option-radio" />
                {opt.label}
              </button>
            ))}
          </div>

          <div className="quiz__nav">
            <button
              className="quiz__nav-btn"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              ← Назад
            </button>
            {answers[step] !== null && step < total - 1 && (
              <button className="quiz__nav-btn quiz__nav-btn--next" onClick={() => setStep((s) => s + 1)}>
                Далее →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* -------- CONTACT -------- */
  if (stage === 'contact') {
    return (
      <div className="quiz">
        <Seo
          title="Экспресс-тест готовности к бизнесу"
          description="Бесплатный тест за 2 минуты: оцените готовность вашей бизнес-идеи и получите персональную рекомендацию специалиста Smart Capital Partners."
          path="/test"
        />
        <form className="quiz__card" onSubmit={submit}>
          <div className="quiz__progress">
            <div className="quiz__progress-bar">
              <div className="quiz__progress-fill" style={{ width: '100%' }} />
            </div>
            <span className="quiz__progress-label">Последний шаг</span>
          </div>

          <h2 className="quiz__question">Куда отправить результат?</h2>
          <p className="quiz__hint">
            Оставьте контакты — пришлём оценку готовности и закрепим за вами
            специалиста для бесплатной консультации.
          </p>

          <div className="quiz__fields">
            <input
              className="quiz__input"
              placeholder="Ваше имя"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              required
            />
            <input
              className="quiz__input"
              placeholder="Телефон / WhatsApp"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              required
            />
            <input
              className="quiz__input"
              type="email"
              placeholder="Email (необязательно)"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
            />
          </div>

          <button className="btn btn--primary quiz__start" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Отправляем…' : 'Показать результат →'}
          </button>
          <button
            type="button"
            className="quiz__back quiz__back--btn"
            onClick={() => setStage('questions')}
          >
            ← Вернуться к вопросам
          </button>
        </form>
      </div>
    )
  }

  /* -------- RESULT -------- */
  const percent = Math.round((score / maxScore) * 100)
  return (
    <div className="quiz">
      <div className="quiz__card quiz__result">
        <span className="quiz__result-emoji">{level.emoji}</span>
        <span className="quiz__eyebrow">
          Ваш результат: {score} из {maxScore} баллов
        </span>
        <h1 className="quiz__title">{level.title}</h1>

        <div className="quiz__scorebar">
          <div className="quiz__scorebar-fill" style={{ width: `${percent}%` }} />
        </div>

        <p className="quiz__lead">{level.summary}</p>

        <div className="quiz__reco">
          <span className="quiz__reco-label">Рекомендация специалиста</span>
          <p>{level.recommendation}</p>
        </div>

        {status === 'ok' ? (
          <p className="quiz__sent">
            ✓ Результат отправлен. Специалист Smart Capital Partners свяжется с вами в ближайшее
            время.
          </p>
        ) : (
          <p className="quiz__sent quiz__sent--warn">
            Результат сформирован. Заявку не удалось отправить автоматически —
            свяжитесь с нами через форму на главной или мессенджеры.
          </p>
        )}

        <div className="quiz__result-actions">
          <a href="/#contacts" className="btn btn--primary">
            Записаться на консультацию
          </a>
          <Link to="/catalog" className="btn btn--secondary">
            Посмотреть каталог
          </Link>
        </div>
      </div>
    </div>
  )
}
