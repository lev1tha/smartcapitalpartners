export type QuizOption = {
  label: string
  score: number
}

export type QuizQuestion = {
  id: string
  question: string
  hint?: string
  options: QuizOption[]
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'idea',
    question: 'Есть ли у вас конкретная бизнес-идея?',
    options: [
      { label: 'Да, чёткая и продуманная идея', score: 3 },
      { label: 'Есть направление, но без деталей', score: 2 },
      { label: 'Пока просто хочу свой бизнес', score: 1 },
    ],
  },
  {
    id: 'market',
    question: 'Изучали ли вы спрос и конкурентов?',
    hint: 'Понимание рынка снижает риск провала на старте.',
    options: [
      { label: 'Да, проанализировал рынок и конкурентов', score: 3 },
      { label: 'Поверхностно, в общих чертах', score: 2 },
      { label: 'Нет, ещё не изучал', score: 1 },
    ],
  },
  {
    id: 'budget',
    question: 'Какой бюджет готовы вложить в старт?',
    options: [
      { label: 'Более 1 млн сом', score: 3 },
      { label: 'От 300 тыс до 1 млн сом', score: 2 },
      { label: 'До 300 тыс или пока нет средств', score: 1 },
    ],
  },
  {
    id: 'cushion',
    question: 'Есть ли финансовая подушка на 3–6 месяцев?',
    hint: 'Резерв позволяет пережить период до выхода на прибыль.',
    options: [
      { label: 'Да, есть запас на жизнь и бизнес', score: 3 },
      { label: 'Частично', score: 2 },
      { label: 'Нет', score: 1 },
    ],
  },
  {
    id: 'experience',
    question: 'Есть ли опыт в выбранной сфере?',
    options: [
      { label: 'Да, работал в этой сфере', score: 3 },
      { label: 'Косвенный или смежный опыт', score: 2 },
      { label: 'Нет опыта', score: 1 },
    ],
  },
  {
    id: 'plan',
    question: 'Есть ли бизнес-план или финансовая модель?',
    options: [
      { label: 'Да, есть готовый расчёт', score: 3 },
      { label: 'В процессе / черновик', score: 2 },
      { label: 'Нет', score: 1 },
    ],
  },
  {
    id: 'timing',
    question: 'Когда планируете запуститься?',
    options: [
      { label: 'В ближайшие 1–3 месяца', score: 3 },
      { label: 'В течение полугода', score: 2 },
      { label: 'Пока не определился со сроками', score: 1 },
    ],
  },
]

export const maxScore = quizQuestions.length * 3 // 21

export type ResultLevel = {
  id: 'low' | 'mid' | 'high'
  min: number
  title: string
  emoji: string
  summary: string
  recommendation: string
}

export const resultLevels: ResultLevel[] = [
  {
    id: 'high',
    min: 17,
    emoji: '🚀',
    title: 'Высокая готовность к запуску',
    summary:
      'У вас сильная база: есть идея, ресурсы и понимание рынка. Вы почти готовы стартовать.',
    recommendation:
      'Чтобы не упустить детали и стартовать без ошибок — обсудите финмодель и план запуска с нашим специалистом.',
  },
  {
    id: 'mid',
    min: 12,
    emoji: '📊',
    title: 'Хорошая основа, есть пробелы',
    summary:
      'Вы движетесь в правильном направлении, но часть важных вопросов пока не закрыта.',
    recommendation:
      'Консультация специалиста Smart Capital Partners поможет закрыть пробелы: бюджет, бизнес-план и стратегию выхода на прибыль.',
  },
  {
    id: 'low',
    min: 7,
    emoji: '🌱',
    title: 'Идея на старте — нужна проработка',
    summary:
      'Желание есть — это главное. Но идею нужно довести до конкретного плана с цифрами.',
    recommendation:
      'Рекомендуем начать с бесплатной консультации: вместе со специалистом определим нишу, бюджет и первые шаги.',
  },
]

export function getResultLevel(score: number): ResultLevel {
  return (
    resultLevels.find((l) => score >= l.min) ??
    resultLevels[resultLevels.length - 1]
  )
}
