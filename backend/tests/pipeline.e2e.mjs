// E2E новых модулей: клиенты, сделки, P&L, права на поля, документы, уведомления, поиск.
// Требует запущенный backend на :8000. Запуск: node tests/pipeline.e2e.mjs
const BASE = process.env.BASE || 'http://localhost:8000'

let passed = 0
let failed = 0
const ok = (cond, label) => {
  cond ? passed++ : failed++
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
}
const section = (t) => console.log(`\n▶ ${t}`)

async function api(method, path, token, body) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, { method, headers, body: payload })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const login = async (l, p) => (await api('POST', '/api/admin/login', null, { login: l, password: p })).json?.token

async function run() {
  const director = await login('director', 'director123')
  const manager = await login('manager', 'manager123')
  const marketer = await login('marketer', 'marketer123')
  const finance = await login('finance', 'finance123')
  const accountant = await login('accountant', 'accountant123')
  const smm = await login('smm', 'smm123')
  const tag = `e2e-${Date.now()}`

  section('me: разделы и матрица полей')
  const meMkt = await api('GET', '/api/crm/me', marketer)
  ok(meMkt.json?.sections?.clients === true && meMkt.json?.sections?.accounting === false, 'маркетолог: клиенты да, бухгалтерия нет')
  ok(meMkt.json?.fields?.deal?.amount?.view === false, 'маркетолог по умолчанию НЕ видит сумму сделки')
  const meFin = await api('GET', '/api/crm/me', finance)
  ok(meFin.json?.fields?.deal?.amount?.edit === true, 'финансист редактирует сумму сделки')

  section('Клиенты')
  const smmClients = await api('GET', '/api/crm/clients', smm)
  ok(smmClients.status === 403, 'СММ не имеет доступа к клиентам')

  const c1 = await api('POST', '/api/crm/clients/save', marketer, {
    item: { name: `ОсОО Кофейня ${tag}`, company: 'Coffee Lab', kind: 'company', phone: '+996 555 000111', email: 'lab@example.kg', tags: ['HoReCa'] },
  })
  ok(c1.status === 200 && c1.json?.client?.id, 'маркетолог создал клиента')
  const clientId = c1.json?.client?.id

  const list = await api('GET', `/api/crm/clients?q=${encodeURIComponent('кофейня')}`, manager)
  ok(list.json?.clients?.some((c) => c.id === clientId), 'поиск клиентов по имени (кириллица, регистр)')

  const accView = await api('GET', `/api/crm/clients/${clientId}`, accountant)
  ok(accView.status === 200 && accView.json?.client?.phone === '+996 555 000111', 'бухгалтер видит контакты клиента')

  section('Сделки и скрытие финансов')
  const d1 = await api('POST', '/api/crm/deals/save', finance, {
    item: { title: `Франшиза кофейни ${tag}`, clientId, pipeline: 'sales', amount: 1500000, commission: 150000, currency: 'KGS', probability: 40 },
  })
  ok(d1.status === 200 && d1.json?.deal?.stage === 'lead', 'финансист создал сделку в первом этапе воронки')
  const dealId = d1.json?.deal?.id

  const mktDeal = await api('GET', `/api/crm/deals/${dealId}`, marketer)
  ok(mktDeal.status === 200, 'маркетолог видит карточку сделки')
  ok(mktDeal.json?.deal?.amount === null && mktDeal.json?.deal?.commission === null, 'сумма и комиссия скрыты (null)')
  ok(mktDeal.json?.deal?.hidden?.includes('amount'), 'список скрытых полей содержит amount')
  ok(mktDeal.json?.deal?.payments === undefined, 'платежи маркетологу не отдаются')

  const mktEdit = await api('POST', '/api/crm/deals/save', marketer, { item: { id: dealId, title: 'Переименовано', amount: 1 } })
  ok(mktEdit.status === 403, 'маркетолог НЕ может изменить сумму (403, а не тихое игнорирование)')
  const mktEditOk = await api('POST', '/api/crm/deals/save', marketer, { item: { id: dealId, title: `Франшиза кофейни v2 ${tag}` } })
  ok(mktEditOk.status === 200 && mktEditOk.json?.deal?.title?.startsWith('Франшиза кофейни v2'), 'маркетолог меняет название без финансов')

  const finDeal = await api('GET', `/api/crm/deals/${dealId}`, finance)
  ok(finDeal.json?.deal?.amount === 1500000 && finDeal.json?.deal?.commission === 150000, 'финансист видит сумму и комиссию')

  const dealsList = await api('GET', '/api/crm/deals?pipeline=sales', director)
  ok(dealsList.json?.pipelines?.sales?.stages?.length >= 5 && dealsList.json?.stageTotals, 'список сделок: воронки и суммы по этапам')
  const badPipeline = await api('GET', '/api/crm/deals?pipeline=nope', director)
  ok(badPipeline.status === 400, 'неизвестная воронка → 400')

  section('Движение по воронке')
  const mv = await api('POST', '/api/crm/deals/move', marketer, { id: dealId, stage: 'negotiation', position: 0 })
  ok(mv.json?.deal?.stage === 'negotiation', 'маркетолог перетащил сделку в «Переговоры»')
  const mvBad = await api('POST', '/api/crm/deals/move', marketer, { id: dealId, stage: 'due_diligence' })
  ok(mvBad.status === 422, 'этап из другой воронки отклонён')
  const won = await api('POST', '/api/crm/deals/move', manager, { id: dealId, stage: 'won' })
  ok(won.json?.deal?.stage === 'won' && won.json?.deal?.probability === 100 && won.json?.deal?.closedAt, 'закрытие: вероятность 100, дата закрытия')

  section('Платежи и P&L')
  const payDenied = await api('POST', '/api/crm/payments/save', marketer, { item: { dealId, amount: 100, direction: 'in' } })
  ok(payDenied.status === 403, 'маркетолог не может добавлять платежи')
  const p1 = await api('POST', '/api/crm/payments/save', accountant, { item: { dealId, amount: 500000, direction: 'in', kind: 'payment', date: '2026-10-01', note: 'Аванс' } })
  ok(p1.status === 200 && p1.json?.pnl?.income === 500000, 'бухгалтер внёс поступление, P&L пересчитан')
  const p2 = await api('POST', '/api/crm/payments/save', finance, { item: { dealId, amount: 120000, direction: 'out', kind: 'expense', note: 'Юрист' } })
  ok(p2.json?.pnl?.net === 380000, 'расход учтён: net = 500000 − 120000')
  const pBad = await api('POST', '/api/crm/payments/save', finance, { item: { dealId, amount: -5, direction: 'in' } })
  ok(pBad.status === 422, 'отрицательная сумма отклонена')

  const clientCard = await api('GET', `/api/crm/clients/${clientId}`, director)
  ok(clientCard.json?.client?.pnl?.net === 380000 && clientCard.json?.client?.deals?.length === 1, 'профиль клиента: сделки + P&L')
  const clientCardMkt = await api('GET', `/api/crm/clients/${clientId}`, marketer)
  ok(clientCardMkt.json?.client?.pnl === undefined && clientCardMkt.json?.client?.deals?.[0]?.amount === null, 'маркетолог: профиль без P&L и сумм')

  section('Матрица прав (директор)')
  const permDenied = await api('POST', '/api/crm/permissions/fields', manager, { role: 'marketer', resource: 'deal', field: 'amount', canView: true })
  ok(permDenied.status === 403, 'управляющий не меняет матрицу прав')
  const permOk = await api('POST', '/api/crm/permissions/fields', director, { role: 'marketer', resource: 'deal', field: 'amount', canView: true, canEdit: false })
  ok(permOk.status === 200 && permOk.json?.roles?.marketer?.deal?.amount?.view === true, 'директор открыл маркетологу просмотр суммы')
  const mktDeal2 = await api('GET', `/api/crm/deals/${dealId}`, marketer)
  ok(mktDeal2.json?.deal?.amount === 1500000 && mktDeal2.json?.deal?.editable?.amount === false, 'маркетолог теперь видит сумму, но не редактирует')
  const mktEdit2 = await api('POST', '/api/crm/deals/save', marketer, { item: { id: dealId, title: 'x', amount: 2 } })
  ok(mktEdit2.status === 403, 'и всё ещё не может её менять')
  await api('POST', '/api/crm/permissions/fields', director, { role: 'marketer', resource: 'deal', field: 'amount', canView: false, canEdit: false })
  const mktDeal3 = await api('GET', `/api/crm/deals/${dealId}`, marketer)
  ok(mktDeal3.json?.deal?.amount === null, 'право отозвано — сумма снова скрыта')

  section('Задачи ↔ клиент/сделка, doc-view')
  const t1 = await api('POST', '/api/crm/tasks/save', director, {
    item: { title: `Подготовить договор ${tag}`, assignee: 'finance', dealId, dueDate: '2026-10-20', priority: 'high',
      content: [{ type: 'h2', text: 'Чек-лист' }, { type: 'todo', text: 'Проверить реквизиты', checked: false }] },
  })
  ok(t1.status === 200 && t1.json?.task?.clientId === clientId && t1.json?.task?.dealTitle, 'задача привязана к сделке и клиенту автоматически')
  const taskId = t1.json?.task?.id
  const badBlock = await api('POST', '/api/crm/tasks/content', finance, { id: taskId, content: [{ type: 'video', text: '' }] })
  ok(badBlock.status === 422, 'неизвестный тип блока отклонён')
  const content = await api('POST', '/api/crm/tasks/content', finance, { id: taskId, content: [{ type: 'todo', text: 'Проверить реквизиты', checked: true }] })
  ok(content.json?.task?.content?.[0]?.checked === true, 'исполнитель отметил пункт чек-листа')
  const contentDenied = await api('POST', '/api/crm/tasks/content', smm, { id: taskId, content: [] })
  ok(contentDenied.status === 403, 'чужой сотрудник не правит документ задачи')
  const dealCard = await api('GET', `/api/crm/deals/${dealId}`, director)
  ok(dealCard.json?.deal?.tasks?.some((t) => t.id === taskId), 'задача видна в карточке сделки')
  const ruDate = await api('POST', '/api/crm/tasks/save', director, { item: { title: `Дата по-русски ${tag}`, dueDate: '20.06' } })
  ok(ruDate.json?.task?.dueDate?.endsWith('-06-20'), 'срок «20.06» распознан')
  await api('POST', '/api/crm/tasks/delete', director, { id: ruDate.json?.task?.id })

  section('Уведомления')
  const finNotif = await api('GET', '/api/crm/notifications?unread=1', finance)
  const assigned = finNotif.json?.notifications?.find((n) => n.link?.id === taskId)
  ok(assigned && assigned.kind === 'task' && assigned.priority === 'high', 'финансист получил уведомление о новой задаче (high)')
  const read = await api('POST', '/api/crm/notifications/read', finance, { ids: [assigned?.id] })
  ok(typeof read.json?.unread === 'number', 'отметка прочитанным возвращает счётчик')
  const after = await api('GET', '/api/crm/notifications?unread=1', finance)
  ok(!after.json?.notifications?.some((n) => n.id === assigned?.id), 'прочитанное исчезло из непрочитанных')
  const settings = await api('POST', '/api/crm/notifications/settings', finance, { dndEnabled: true, dndStart: '22:00', dndEnd: '08:00', telegramMinPriority: 'high' })
  ok(settings.json?.settings?.dndEnabled === true && settings.json?.settings?.telegramMinPriority === 'high', 'настройки «не беспокоить» сохранены')
  const badTime = await api('POST', '/api/crm/notifications/settings', finance, { dndStart: 'late' })
  ok(badTime.status === 422, 'невалидное время отклонено')
  await api('POST', '/api/crm/notifications/settings', finance, { dndEnabled: false, telegramMinPriority: 'normal' })

  section('Документы')
  const doc = await api('POST', '/api/crm/docs/save', marketer, { item: { title: `Регламент ${tag}`, clientId, content: [{ type: 'p', text: 'Порядок работы с франшизой' }] } })
  ok(doc.status === 200 && doc.json?.document?.id, 'создан документ с привязкой к клиенту')
  const docId = doc.json?.document?.id
  const child = await api('POST', '/api/crm/docs/save', marketer, { item: { title: 'Вложенная', parentId: docId } })
  const docView = await api('GET', `/api/crm/docs/${docId}`, smm)
  ok(docView.json?.document?.children?.length === 1 && docView.json?.document?.clientName, 'документ открывается с вложенными страницами и клиентом')
  const selfParent = await api('POST', '/api/crm/docs/save', marketer, { item: { id: docId, parentId: docId } })
  ok(selfParent.status === 422, 'документ нельзя вложить сам в себя')
  const delDenied = await api('POST', '/api/crm/docs/delete', smm, { id: docId })
  ok(delDenied.status === 403, 'чужой документ не удалить')

  section('Поиск Cmd+K')
  const srch = await api('GET', `/api/crm/search?q=${encodeURIComponent(tag)}`, director)
  const types = new Set((srch.json?.results ?? []).map((r) => r.type))
  ok(['task', 'client', 'deal', 'document'].every((t) => types.has(t)), 'поиск находит задачу, клиента, сделку и документ')
  const srchBody = await api('GET', `/api/crm/search?q=${encodeURIComponent('Порядок работы')}`, director)
  ok(srchBody.json?.results?.some((r) => r.type === 'document'), 'поиск по тексту внутри документа')
  const srchSmm = await api('GET', `/api/crm/search?q=${encodeURIComponent(tag)}`, smm)
  ok(!srchSmm.json?.results?.some((r) => r.type === 'client' || r.type === 'deal'), 'СММ не находит клиентов и сделки')

  section('Журнал и дашборд')
  const logsDenied = await api('GET', '/api/crm/logs', finance)
  ok(logsDenied.status === 403, 'финансист не видит журнал')
  const logs = await api('GET', `/api/crm/logs?entityType=deal&entityId=${dealId}`, director)
  ok(logs.json?.logs?.some((l) => l.action === 'stage') && logs.json?.logs?.some((l) => l.action === 'create'), 'журнал: создание и смена этапа сделки')
  const dash = await api('GET', '/api/crm/dashboard', director)
  ok(dash.json?.pipeline?.funnel?.length === 3 && dash.json?.finance?.all, 'дашборд директора: 3 воронки и финансы')
  const dashSmm = await api('GET', '/api/crm/dashboard', smm)
  ok(dashSmm.status === 200 && dashSmm.json?.pipeline === undefined && dashSmm.json?.finance === undefined, 'дашборд СММ: только задачи')

  section('Пользовательские свойства')
  const fd = await api('POST', '/api/crm/fields/save', manager, { item: { resource: 'deal', label: 'Источник', type: 'select', options: ['Instagram', 'Рекомендация'] } })
  ok(fd.status === 200 && fd.json?.field?.options?.length === 2, 'управляющий добавил свойство-список для сделок')
  const fdDenied = await api('POST', '/api/crm/fields/save', marketer, { item: { resource: 'deal', label: 'x' } })
  ok(fdDenied.status === 403, 'маркетолог не добавляет свойства')
  const withCf = await api('POST', '/api/crm/deals/save', finance, { item: { id: dealId, title: `Франшиза кофейни ${tag}`, customFields: { [fd.json?.field?.id]: 'Instagram' } } })
  ok(withCf.json?.deal?.customFields?.[fd.json?.field?.id] === 'Instagram', 'значение свойства сохранено в сделке')
  await api('POST', '/api/crm/fields/delete', manager, { id: fd.json?.field?.id })

  section('Уборка')
  await api('POST', '/api/crm/tasks/delete', director, { id: taskId })
  await api('POST', '/api/crm/docs/delete', manager, { id: child.json?.document?.id })
  await api('POST', '/api/crm/docs/delete', manager, { id: docId })
  const delDealDenied = await api('POST', '/api/crm/deals/delete', finance, { id: dealId })
  ok(delDealDenied.status === 403, 'сделку удаляет только руководитель')
  const delClient = await api('POST', '/api/crm/clients/delete', director, { id: clientId })
  ok(delClient.status === 200, 'директор удалил клиента (сделки и платежи каскадом)')
  const gone = await api('GET', `/api/crm/deals/${dealId}`, director)
  ok(gone.status === 404, 'сделка удалена вместе с клиентом')

  console.log(`\n${'='.repeat(40)}\nИТОГО: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('E2E упал:', e)
  process.exit(1)
})
