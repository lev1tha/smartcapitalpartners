// E2E-тесты CRM (через API). Требует запущенный backend на localhost:8000.
// Запуск: node tests/crm.e2e.mjs
const BASE = process.env.BASE || 'http://localhost:8000'

let passed = 0
let failed = 0
function ok(cond, label) {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.log(`  ✗ ${label}`)
  }
}
function section(t) {
  console.log(`\n▶ ${t}`)
}

async function api(method, path, token, body, isForm) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (isForm) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, { method, headers, body: payload })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* пусто */
  }
  return { status: res.status, json }
}

async function login(loginName, password) {
  const r = await api('POST', '/api/admin/login', null, { login: loginName, password })
  return r.json?.token
}

async function run() {
  section('Авторизация по ролям')
  const director = await login('director', 'director123')
  const manager = await login('manager', 'manager123')
  const smm = await login('smm', 'smm123')
  const marketer = await login('marketer', 'marketer123')
  const finance = await login('finance', 'finance123')
  const accountant = await login('accountant', 'accountant123')
  ok(!!director, 'директор вошёл')
  ok(!!smm, 'СММ вошёл')
  ok(!!marketer && !!finance && !!accountant, 'маркетолог/финансист/бухгалтер вошли')

  const bad = await api('POST', '/api/admin/login', null, { login: 'smm', password: 'wrong' })
  ok(bad.status === 401, 'неверный пароль → 401')

  const me = await api('GET', '/api/crm/me', smm)
  ok(me.json?.user?.role === 'smm', 'me возвращает роль смм')

  section('Постановка задачи (директор → СММ)')
  const created = await api('POST', '/api/crm/tasks/save', director, {
    item: { title: 'Снять reels про кофейню', description: 'Видео для Instagram', assignee: 'smm' },
  })
  ok(created.status === 200 && created.json?.task?.status === 'new', 'задача создана, статус «новая»')
  const taskId = created.json?.task?.id

  const smmCreate = await api('POST', '/api/crm/tasks/save', smm, { item: { title: 'Я сам себе' } })
  ok(smmCreate.status === 403, 'СММ НЕ может создавать задачи (403)')

  section('Воркфлоу СММ')
  const smmTasks = await api('GET', '/api/crm/tasks', smm)
  ok(smmTasks.json?.tasks?.some((t) => t.id === taskId), 'СММ видит назначенную задачу')

  const acTasks = await api('GET', '/api/crm/tasks', accountant)
  ok(!acTasks.json?.tasks?.some((t) => t.id === taskId), 'бухгалтер НЕ видит чужую задачу')

  const start = await api('POST', '/api/crm/tasks/transition', smm, { id: taskId, action: 'start' })
  ok(start.json?.task?.status === 'in_progress', 'СММ взял в работу → «в работе»')

  const submit = await api('POST', '/api/crm/tasks/transition', smm, {
    id: taskId,
    action: 'submit',
    payload: { resultText: 'Reels опубликован', resultLink: 'https://instagram.com/reel/abc123' },
  })
  ok(submit.json?.task?.status === 'review', 'СММ сдал на проверку → «на проверке»')
  ok(submit.json?.task?.result?.link === 'https://instagram.com/reel/abc123', 'ссылка на reels сохранена')

  const smmApprove = await api('POST', '/api/crm/tasks/transition', smm, { id: taskId, action: 'approve' })
  ok(smmApprove.status === 422, 'СММ НЕ может принять свою задачу')

  section('Отклонение с причиной (директор)')
  const rejectNoReason = await api('POST', '/api/crm/tasks/transition', director, { id: taskId, action: 'reject', payload: {} })
  ok(rejectNoReason.status === 422, 'отклонение без причины → ошибка')

  const reject = await api('POST', '/api/crm/tasks/transition', director, {
    id: taskId,
    action: 'reject',
    payload: { reason: 'Переснять с лучшим светом' },
  })
  ok(reject.json?.task?.status === 'rejected', 'директор отклонил → «отклонена»')
  ok(reject.json?.task?.rejectionReason === 'Переснять с лучшим светом', 'причина отклонения сохранена')

  section('Переделка и приёмка')
  await api('POST', '/api/crm/tasks/transition', smm, { id: taskId, action: 'start' })
  await api('POST', '/api/crm/tasks/transition', smm, {
    id: taskId, action: 'submit', payload: { resultText: 'Переснял', resultLink: 'https://instagram.com/reel/xyz789' },
  })
  const approve = await api('POST', '/api/crm/tasks/transition', director, { id: taskId, action: 'approve' })
  ok(approve.json?.task?.status === 'done', 'директор принял → «выполнена»')
  ok((approve.json?.task?.history?.length ?? 0) >= 6, 'история переходов записана')

  section('Ролевой доступ к заявкам')
  const accSub = await api('GET', '/api/admin/submissions', accountant)
  ok(Array.isArray(accSub.json?.access) && accSub.json.access.length === 0, 'бухгалтер не видит заявки')

  const finSub = await api('GET', '/api/admin/submissions', finance)
  ok(finSub.json?.access?.includes('quiz') && !finSub.json?.access?.includes('leads'), 'финансист видит только тесты')

  const mktSub = await api('GET', '/api/admin/submissions', marketer)
  ok(['leads', 'quiz', 'turnkey'].every((k) => mktSub.json?.access?.includes(k)), 'маркетолог видит все заявки')

  section('Идеи и сотрудники')
  const idea = await api('POST', '/api/crm/ideas', marketer, { text: 'Запустить акцию «Бизнес за 1 сом»' })
  ok(idea.status === 200, 'маркетолог добавил идею')
  const ideasSeen = await api('GET', '/api/crm/ideas', accountant)
  ok(ideasSeen.json?.ideas?.some((i) => i.text.includes('Бизнес за 1 сом')), 'бухгалтер видит идею (общий борд)')

  const usersDir = await api('GET', '/api/crm/users', director)
  ok((usersDir.json?.users?.length ?? 0) === 6, 'директор видит 6 сотрудников')
  const usersSmm = await api('GET', '/api/crm/users', smm)
  ok(usersSmm.status === 403, 'СММ НЕ видит список сотрудников')

  section('Удаление идей')
  const myIdea = await api('POST', '/api/crm/ideas', smm, { text: 'Идея СММ на удаление' })
  const ideaId = myIdea.json?.idea?.id
  const delOther = await api('POST', '/api/crm/ideas/delete', accountant, { id: ideaId })
  ok(delOther.status === 403, 'бухгалтер НЕ может удалить чужую идею')
  const delOwn = await api('POST', '/api/crm/ideas/delete', smm, { id: ideaId })
  ok(delOwn.status === 200, 'СММ удалил свою идею')

  section('Контент-календарь')
  const accDenied = await api('GET', '/api/crm/accounts', accountant)
  ok(accDenied.status === 403, 'бухгалтер НЕ имеет доступа к календарю')

  const newAcc = await api('POST', '/api/crm/accounts/save', marketer, { item: { name: 'Тест-аккаунт TikTok', platform: 'TikTok' } })
  ok(newAcc.status === 200, 'маркетолог создал аккаунт')
  const accId = newAcc.json?.account?.id

  const smmAccCreate = await api('POST', '/api/crm/accounts/save', smm, { item: { name: 'СММ аккаунт' } })
  ok(smmAccCreate.status === 403, 'СММ НЕ может создавать аккаунты')

  const newPost = await api('POST', '/api/crm/calendar/save', smm, {
    item: { accountId: accId, date: '2026-07-15', type: 'reels', title: 'Reels: запуск кофейни', status: 'scheduled' },
  })
  ok(newPost.status === 200, 'СММ добавил пост в календарь')
  const postId = newPost.json?.post?.id

  const seenByMkt = await api('GET', `/api/crm/calendar?accountId=${accId}`, marketer)
  ok(seenByMkt.json?.posts?.some((p) => p.id === postId), 'маркетолог видит пост СММ (общий календарь аккаунта)')

  const delPost = await api('POST', '/api/crm/calendar/delete', manager, { id: postId })
  ok(delPost.status === 200, 'управляющий удалил пост')

  const delAcc = await api('POST', '/api/crm/accounts/delete', director, { id: accId })
  ok(delAcc.status === 200, 'директор удалил тест-аккаунт')

  section('SMM-дашборд')
  const smmDenied = await api('GET', '/api/crm/smm/board', finance)
  ok(smmDenied.status === 403, 'финансист не имеет SMM-дашборда')

  const smmBoard = await api('GET', '/api/crm/smm/board', smm)
  ok(smmBoard.status === 200 && smmBoard.json?.settings?.kpi, 'СММ открыл дашборд (есть KPI)')

  const smmTask = await api('POST', '/api/crm/smm/tasks/save', smm, {
    item: { title: 'Мониторинг комментариев и ЛС', period: 'daily', category: 'Модерация', priority: 'high' },
  })
  ok(smmTask.status === 200 && smmTask.json?.task?.isCompleted === false, 'СММ добавил daily-задачу')
  const stId = smmTask.json?.task?.id

  const toggled = await api('POST', '/api/crm/smm/tasks/toggle', smm, { id: stId })
  ok(toggled.json?.task?.isCompleted === true, 'отметка выполнения переключилась')

  const setSaved = await api('POST', '/api/crm/smm/settings', smm, {
    settings: { tools: { autopost: { url: 'https://smmplanner.com', status: 'Ближайший пост: 15:00' }, design: { url: 'x' }, analytics: { url: 'y' } }, kpi: { reach: { current: 50000, target: 100000 }, followers: { current: 200, target: 1000 }, er: { current: 3, target: 5 } } },
  })
  ok(setSaved.json?.settings?.kpi?.reach?.current === 50000, 'СММ сохранил KPI/настройки')

  await api('POST', '/api/crm/smm/tasks/delete', smm, { id: stId })

  section('Бухгалтерия')
  const accNoAccess = await api('GET', '/api/crm/acc/board', smm)
  ok(accNoAccess.status === 403, 'СММ не имеет бухгалтерского дашборда')

  const accBoard = await api('GET', '/api/crm/acc/board', accountant)
  ok(accBoard.status === 200 && accBoard.json?.settings?.links?.sti, 'бухгалтер открыл дашборд (есть ссылки СТИ)')

  const accTask = await api('POST', '/api/crm/acc/tasks/save', accountant, {
    item: { title: 'Сдать отчёт по подоходному и соцфонду', period: 'monthly', reportingPeriod: '2026-05', deadline: '2026-06-20', status: 'not_started' },
  })
  ok(accTask.status === 200, 'бухгалтер создал отчёт с дедлайном')
  const atId = accTask.json?.task?.id

  const st1 = await api('POST', '/api/crm/acc/tasks/status', accountant, { id: atId, status: 'in_progress' })
  ok(st1.json?.task?.status === 'in_progress', 'статус → «В процессе»')
  const stFinal = await api('POST', '/api/crm/acc/tasks/status', accountant, { id: atId, status: 'submitted' })
  ok(stFinal.json?.task?.status === 'submitted', 'статус → «Сдано»')

  const badStatus = await api('POST', '/api/crm/acc/tasks/status', accountant, { id: atId, status: 'wtf' })
  ok(badStatus.status === 422, 'невалидный статус отклонён')

  const doc = await api('POST', '/api/crm/acc/docs/save', accountant, { item: { counterparty: 'ОсОО «Поставщик»', type: 'Акт сверки', status: 'requested' } })
  ok(doc.status === 200, 'добавлен документ для контроля')

  const accSet = await api('POST', '/api/crm/acc/settings', accountant, {
    settings: { ecpValidUntil: '2026-07-01', links: { sti: { name: 'СТИ', url: 'https://cabinet.sti.gov.kg' }, esf: { name: 'ЭСФ', url: 'x' }, ettn: { name: 'ЭТТН', url: 'y' }, bank: { name: 'Банк', url: '' } } },
  })
  ok(accSet.json?.settings?.ecpValidUntil === '2026-07-01', 'сохранён срок ЭЦП')

  const gen1 = await api('POST', '/api/crm/acc/generate', accountant, { month: '2026-08' })
  ok(gen1.json?.created >= 3, 'авто-генерация создала стандартные отчёты (≥3)')
  const gen2 = await api('POST', '/api/crm/acc/generate', accountant, { month: '2026-08' })
  ok(gen2.json?.created === 0, 'повторная генерация не дублирует (идемпотентность)')
  const genDenied = await api('POST', '/api/crm/acc/generate', smm, { month: '2026-08' })
  ok(genDenied.status === 403, 'СММ не может генерировать бух. задачи')
  // уборка сгенерированного
  const board2 = await api('GET', '/api/crm/acc/board', accountant)
  for (const t of (board2.json?.tasks ?? []).filter((x) => x.deadline?.startsWith('2026-08'))) {
    await api('POST', '/api/crm/acc/tasks/delete', accountant, { id: t.id })
  }

  await api('POST', '/api/crm/acc/tasks/delete', accountant, { id: atId })
  await api('POST', '/api/crm/acc/docs/delete', accountant, { id: doc.json?.doc?.id })

  section('Маркетинг')
  const mktNoAccess = await api('GET', '/api/crm/mkt/board', smm)
  ok(mktNoAccess.status === 403, 'СММ не имеет маркетингового дашборда')

  const mktBoard = await api('GET', '/api/crm/mkt/board', marketer)
  ok(mktBoard.status === 200 && typeof mktBoard.json?.submissionsMonth === 'number', 'маркетолог видит метрики из заявок')
  ok(mktBoard.json?.byType && 'leads' in mktBoard.json.byType, 'есть разбивка заявок по источникам')

  const camp = await api('POST', '/api/crm/mkt/campaigns/save', marketer, {
    item: { name: 'Таргет на бизнес-планы', channel: 'Meta Ads', status: 'active', budget: 50000, spent: 20000, leads: 40 },
  })
  ok(camp.status === 200, 'маркетолог создал кампанию')
  const campId = camp.json?.campaign?.id

  const mktSet = await api('POST', '/api/crm/mkt/settings', marketer, {
    settings: { links: { ads: { name: 'Google Ads', url: 'x' }, meta: { name: 'Meta', url: 'y' }, analytics: { name: 'GA', url: 'z' }, twogis: { name: '2GIS', url: '' } }, funnel: { qualified: 30, consultation: 15, contract: 8, client: 5 }, budgetPlan: 200000 },
  })
  ok(mktSet.json?.settings?.funnel?.client === 5, 'сохранены воронка и бюджет')

  const campDenied = await api('POST', '/api/crm/mkt/campaigns/save', smm, { item: { name: 'x' } })
  ok(campDenied.status === 403, 'СММ не может создавать кампании')

  await api('POST', '/api/crm/mkt/campaigns/delete', marketer, { id: campId })

  section('Уборка')
  const del = await api('POST', '/api/crm/tasks/delete', director, { id: taskId })
  ok(del.status === 200, 'директор удалил тестовую задачу')

  console.log(`\n${'='.repeat(40)}`)
  console.log(`ИТОГО: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('E2E упал:', e)
  process.exit(1)
})
