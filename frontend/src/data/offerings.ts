export type Franchise = {
  id: string
  brand: string
  emoji: string
  category: string
  investment: number
  paushal: number
  royalty: string
  points: number
  payback: string
  description: string
}

export const franchises: Franchise[] = [
  {
    id: 'coffee-brand',
    brand: 'CoffeeGo',
    emoji: '☕',
    category: 'Кофейни',
    investment: 850_000,
    paushal: 150_000,
    royalty: '5% с выручки',
    points: 24,
    payback: '10–14 мес',
    description:
      'Сеть кофеен формата «to go» с узнаваемым брендом. Франчайзи получает готовую концепцию, обучение бариста, рецептуры и поставки зерна. Подходит для старта в проходных местах даже без опыта в общепите.',
  },
  {
    id: 'burger-brand',
    brand: 'BurgerHouse',
    emoji: '🍔',
    category: 'Фастфуд',
    investment: 1_200_000,
    paushal: 300_000,
    royalty: '6% с выручки',
    points: 18,
    payback: '12–18 мес',
    description:
      'Франшиза фастфуда с отлаженными процессами и централизованными поставками. Полный бренд-бук, обучение команды, маркетинговая поддержка и помощь с выбором локации под трафик.',
  },
  {
    id: 'sushi-brand',
    brand: 'SushiMaster',
    emoji: '🍣',
    category: 'Доставка еды',
    investment: 900_000,
    paushal: 200_000,
    royalty: '5% с выручки',
    points: 12,
    payback: '11–16 мес',
    description:
      'Доставка суши и роллов под известным брендом. Готовые рецептуры, поставки, интеграция с агрегаторами и маркетинг от управляющей компании. Работает без зала, только на доставку.',
  },
  {
    id: 'kids-brand',
    brand: 'SmartKids',
    emoji: '🎓',
    category: 'Детское образование',
    investment: 700_000,
    paushal: 120_000,
    royalty: '4% с выручки',
    points: 9,
    payback: '9–13 мес',
    description:
      'Сеть детских развивающих центров. Лицензированные программы и методики, обучение педагогов и маркетинг привлечения родителей. Абонементная модель даёт стабильный денежный поток.',
  },
]

export const franchiseIncludes = [
  'Право работать под известным брендом',
  'Обучение персонала и стандарты',
  'Поставки, рецептуры и оборудование',
  'Маркетинговая поддержка и реклама',
  'Помощь с выбором локации',
  'Сопровождение управляющей компании',
]

export type Investment = {
  id: string
  title: string
  emoji: string
  sector: string
  amount: number
  equity: string
  term: string
  roi: string
  stage: string
  description: string
}

export const investments: Investment[] = [
  {
    id: 'ecofarm',
    title: 'Эко-ферма «Зелёный край»',
    emoji: '🌱',
    sector: 'Сельское хозяйство',
    amount: 3_000_000,
    equity: '25%',
    term: '3 года',
    roi: '~32% годовых',
    stage: 'Расширение',
    description:
      'Действующая эко-ферма по производству органических овощей и зелени. Привлекает инвестиции на расширение площадей и строительство теплиц. Стабильный спрос со стороны супермаркетов и ресторанов Бишкека.',
  },
  {
    id: 'logistics',
    title: 'Логистический хаб',
    emoji: '🚚',
    sector: 'Логистика',
    amount: 5_000_000,
    equity: '30%',
    term: '4 года',
    roi: '~28% годовых',
    stage: 'Действующий бизнес',
    description:
      'Логистический хаб с автопарком и складскими площадями. Расширяет покрытие по регионам КР. Действующие контракты с торговыми сетями обеспечивают предсказуемую выручку.',
  },
  {
    id: 'app-startup',
    title: 'Сервис доставки (приложение)',
    emoji: '📱',
    sector: 'IT / стартап',
    amount: 2_000_000,
    equity: '20%',
    term: '2–3 года',
    roi: 'x3–x5 при выходе',
    stage: 'MVP, первые продажи',
    description:
      'Сервис доставки с собственным приложением. MVP запущен, есть первые продажи и активные пользователи. Инвестиции направляются на масштабирование, маркетинг и расширение команды.',
  },
  {
    id: 'minihotel',
    title: 'Мини-отель на Иссык-Куле',
    emoji: '🏨',
    sector: 'Туризм',
    amount: 4_000_000,
    equity: '35%',
    term: '4–5 лет',
    roi: '~24% годовых',
    stage: 'Строительство',
    description:
      'Строительство мини-отеля на южном берегу Иссык-Куля. Высокий сезонный спрос и устойчивый туристический поток. Инвестиции — на завершение строительства и оснащение.',
  },
]

export const investmentSafeguards = [
  'Проверка проекта (due diligence) от Smart Capital Partners',
  'Юридическое оформление сделки',
  'Прозрачная финансовая модель',
  'Договор с фиксированной долей',
  'Контроль ключевых показателей проекта',
]

export type ReadyBusiness = {
  id: string
  title: string
  emoji: string
  sphere: string
  city: string
  price: number
  revenue: number
  profit: number
  payback: string
  description: string
}

export const readyBusinesses: ReadyBusiness[] = [
  {
    id: 'ready-coffee',
    title: 'Действующая кофейня',
    emoji: '☕',
    sphere: 'Общепит',
    city: 'Бишкек',
    price: 1_800_000,
    revenue: 450_000,
    profit: 160_000,
    payback: '11 мес',
    description:
      'Кофейня в центре Бишкека с постоянным потоком клиентов и налаженными процессами. Продаётся в связи с переездом владельца. Оборудование, персонал и локация передаются новому собственнику.',
  },
  {
    id: 'ready-store',
    title: 'Магазин продуктов',
    emoji: '🛒',
    sphere: 'Торговля',
    city: 'Ош',
    price: 2_500_000,
    revenue: 900_000,
    profit: 180_000,
    payback: '14 мес',
    description:
      'Продуктовый магазин у дома в Оше со стабильной выручкой и базой постоянных покупателей. Налаженные поставки, оформленные документы и обученный персонал.',
  },
  {
    id: 'ready-barber',
    title: 'Барбершоп с базой клиентов',
    emoji: '💈',
    sphere: 'Услуги',
    city: 'Бишкек',
    price: 1_400_000,
    revenue: 320_000,
    profit: 140_000,
    payback: '10 мес',
    description:
      'Барбершоп с лояльной базой клиентов и сильными мастерами в Бишкеке. Передаётся бренд, аккаунты в соцсетях, записи клиентов и оборудование.',
  },
  {
    id: 'ready-carwash',
    title: 'Автомойка на трассе',
    emoji: '🚗',
    sphere: 'Услуги',
    city: 'Кант',
    price: 3_200_000,
    revenue: 500_000,
    profit: 200_000,
    payback: '16 мес',
    description:
      'Автомойка на оживлённой трассе возле Канта. Стабильный поток авто, минимум персонала. Земля в долгосрочной аренде, оборудование в хорошем состоянии.',
  },
]

export const readyTransfer = [
  'Оборудование и мебель',
  'База клиентов и аккаунты в соцсетях',
  'Договор аренды помещения',
  'Обученный персонал',
  'Налаженные поставки',
  'Юридическое сопровождение сделки',
]

export function getFranchise(id: string) {
  return franchises.find((f) => f.id === id)
}
export function getInvestment(id: string) {
  return investments.find((p) => p.id === id)
}
export function getReadyBusiness(id: string) {
  return readyBusinesses.find((b) => b.id === id)
}
export function relatedFranchises(id: string) {
  return franchises.filter((f) => f.id !== id).slice(0, 3)
}
export function relatedInvestments(id: string) {
  return investments.filter((p) => p.id !== id).slice(0, 3)
}
export function relatedReady(id: string) {
  return readyBusinesses.filter((b) => b.id !== id).slice(0, 3)
}
