# Smart Capital Partners — контекст проекта (handoff для нового чата)

> Прочитай этот файл целиком перед продолжением работы.
> Проект ведётся итеративно, по-русски, аккуратно: каждая фича проверяется сборкой + e2e + визуально в браузере.

---

## 1. Что это за проект

**Smart Capital Partners** — портал «Маркетинг и финансы для бизнеса в Кыргызстане» (B2B).

1. **Публичный сайт** — лендинги, каталог бизнес-моделей, услуги, экспресс-тест, налоги, франшизы/инвестиции/готовые бизнесы.
2. **CRM (`/admin`)** — внутренняя система: обзор, задачи (kanban + doc-view), сделки (воронки продаж/инвестиций/партнёрств с P&L),
   клиенты, база знаний, уведомления (web + Telegram), поиск ⌘K, ролевые дашборды (маркетинг, SMM, бухгалтерия),
   контент-календарь, заявки, каталог, идеи, сотрудники, настройки (права на поля, свойства, журнал).

Дизайн — Cal.com / Notion: navy `#001E52` + cornflower `#528AEB`. У CRM **тёмная тема по умолчанию** и светлая (переключатель в сайдбаре).
Суммы — моноширинным JetBrains Mono. Иконки — только SVG через `<Icon name="…" />`, без эмодзи.

---

## 2. Технологии и расположение

| | |
|---|---|
| Корень | `/Users/ashimovace/Desktop/projects/MFPro` |
| Frontend | `frontend/` — React **19.2** + Vite **8** + TypeScript, `framer-motion` 14, Capacitor 8 |
| Роутинг | `react-router-dom` **6.30** (НЕ v7 — ради SSG) |
| SSG/SEO | `vite-react-ssg` 0.9.1-beta — пререндер публичных маршрутов |
| Backend | `backend/` — **Django 5.2 + DRF**, Python 3.12 (`backend/.venv`) |
| База | SQLite в dev (`backend/db.sqlite3`), PostgreSQL в проде (`DATABASE_URL`); PostgreSQL 16 установлен локально через brew |
| Файлы | `backend/uploads/` (URL `/uploads/…`, как раньше) |
| Начальные данные | `backend/legacy/{content,storage}/*.json` — каталог сайта и данные CRM, загружаются `import_legacy` |
| Node | v24 |

### Запуск (2 терминала или `.claude/launch.json`: `backend` + `frontend`)
```bash
cd backend  && .venv/bin/python manage.py runserver 8000
cd frontend && npm run dev            # http://localhost:5173 → /api и /uploads проксируются на :8000
```
CRM — **http://localhost:5173/admin**.

### Сборка и проверки
```bash
cd frontend && npm run build                 # typecheck + SSG
cd backend  && node tests/crm.e2e.mjs        # 57 — прежние модули
cd backend  && node tests/pipeline.e2e.mjs   # 59 — клиенты/сделки/права/документы/уведомления/поиск
cd backend  && .venv/bin/python manage.py check
```
Оба e2e нужен запущенный Django на :8000. Для тестов внешние каналы лучше выключать: `NOTIFY_ASYNC=0`.

---

## 3. Роли и доступы

Сотрудники — `django.contrib.auth.User` + `crm.Profile(role)`. Создание/сброс: `manage.py seed_users` (пароли по умолчанию `login + '123'`,
**сменить перед публикацией**: `manage.py changepassword <login>`). Токен — DRF Token с TTL `AUTH_TOKEN_TTL_DAYS` (30), выход отзывает токен.

| Логин | Роль | Разделы |
|---|---|---|
| `director` | Директор | всё + матрица прав на поля |
| `manager` | Управляющий | всё, кроме матрицы прав |
| `marketer` | Маркетолог | задачи, сделки/клиенты (без сумм), маркетинг, календарь, заявки, каталог |
| `smm` | СММ | задачи, SMM-дашборд, календарь |
| `accountant` | Бухгалтер | задачи, бухгалтерия, клиенты/сделки (видит финансы, правит платежи) |
| `finance` | Финансист | задачи, заявки (тесты), бухгалтерия, клиенты/сделки (полные финансы) |

Правила разделов — `backend/crm/roles.py` (`section_access(role)` отдаётся в `/api/crm/me` → `sections`, фронт строит меню по нему).

**Права на поля** — `backend/crm/permissions.py`:
- `FIELD_REGISTRY`: `client.{email,phone,telegram}`, `deal.{amount,commission,probability}`, `finance.payments` — кто видит/правит по умолчанию.
- Переопределения — таблица `FieldPermission`, меняет директор в CRM → Настройки → Права на поля.
- Скрытое поле приходит как `null` + имя в `hidden`; запись защищённого поля → **403** (не игнорируется молча).
- Директор всегда видит всё (нельзя «запереть» себя).

---

## 4. Структура фронтенда

```
frontend/src/
├── App.tsx, main.tsx (+ mobile.ts — в Capacitor сразу открывает /admin)
├── pages/Admin.tsx           # оболочка CRM: меню по me.sections, топбар (поиск ⌘K, колокольчик), тема,
│                             # NavCtx — переходы к сущностям (task/deal/client/document/submission)
├── components/crm/
│   ├── ui.tsx                # ThemeProvider/ThemeToggle, Drawer (framer-motion), Money, Avatar, Empty, Reveal
│   ├── format.ts, theme.ts, blocks.ts, nav.ts   # хелперы без React (Fast Refresh)
│   ├── BlockEditor.tsx       # Notion-блоки: «/» меню, # ## - [] > ---, Enter/Backspace/стрелки, чек-листы
│   ├── CrmDashboard.tsx      # обзор: плитки, дедлайны, воронки, недавние сделки
│   ├── CrmTasks.tsx          # kanban + карточка задачи (свойства, doc-view, результат, история)
│   ├── CrmDeals.tsx          # доска сделок (DnD, «капитальная полоса» по этапам), карточка: финансы, платежи/P&L, заметки
│   ├── CrmClients.tsx        # список + профиль (контакты, P&L, сделки, задачи, документы, заметки)
│   ├── CrmDocs.tsx           # база знаний (дерево страниц, автосохранение)
│   ├── NotificationCenter.tsx# колокольчик, лента, настройки Telegram/DND
│   ├── CommandPalette.tsx    # ⌘K
│   ├── CrmSettings.tsx       # уведомления | свойства | права на поля | журнал
│   └── CrmSmm/Accounting/Marketing/Calendar/Submissions/Ideas/Users.tsx  # прежние разделы (не менялись)
├── data/adminApi.ts          # fetch + токен, API_BASE из VITE_API_URL (для приложения), событие 401
└── styles/tokens.css (+[data-theme=dark]), admin.css (база), crm.css (новые разделы)
```

Публичные маршруты: `/`, `/catalog(/:id)`, `/turnkey`, `/taxes`, `/test`, `/franchises(/:id)`, `/investments(/:id)`, `/ready(/:id)`, `/admin` (noindex).

---

## 5. Структура бэкенда

```
backend/
├── manage.py, requirements.txt, .env(.example)
├── config/settings.py        # env через python-dotenv; CORS включает capacitor://localhost и https://localhost
├── crm/
│   ├── models.py             # Profile, Lead/QuizResult/TurnkeyRequest, ContentItem, Client, Deal, Payment, Task(+TaskEvent),
│   │                         # Idea, SocialAccount, CalendarPost, SmmTask, AccTask, AccDoc, Campaign, BoardSettings,
│   │                         # Document, Notification, AuditLog, FieldPermission, FieldDefinition
│   ├── roles.py              # роли и правила разделов
│   ├── permissions.py        # FieldAccess (матрица полей), декоратор require()
│   ├── auth.py               # Bearer-токен с TTL
│   ├── notify.py             # Telegram/email, DND, приоритеты; внешние каналы — после коммита, в фоне
│   ├── audit.py, blocks.py, defaults.py, presenters.py, utils.py, signals.py (Unicode LIKE для SQLite)
│   ├── views/public.py       # health, lead, quiz, turnkey, content
│   ├── views/auth.py         # login/logout/me/users/submissions/content save|delete
│   ├── views/tasks.py        # задачи, переходы, doc-view, upload
│   ├── views/boards.py       # идеи, календарь, SMM, бухгалтерия, маркетинг
│   ├── views/crm.py          # клиенты, сделки, платежи, дашборд
│   ├── views/workspace.py    # документы, уведомления, поиск, журнал, права, свойства
│   ├── urls.py               # все пути — без завершающего слэша
│   └── management/commands/  # seed_users, import_legacy [root]
├── legacy/{content,storage}/ # начальные данные (JSON) для import_legacy
├── uploads/                  # файлы (gitignored)
└── tests/crm.e2e.mjs, tests/pipeline.e2e.mjs
```

### Конвенции Python
- Ответ ошибки всегда `{"error": "…"}` (`ApiError(message, code)`), коды: 401/403/404/422.
- Вьюхи — `@api_view` + `@require(check, message, anon_status)`; `anon_status=403` там, где анониму нужен 403.
- JSON-ключи ответов — camelCase (см. `presenters.py`), фронт не менялся для старых разделов.
- Финансовые поля в ответах — через `field_access(request)`; перед записью — `fa.assert_editable(...)`.
- Изменения клиентов/сделок/платежей/задач пишутся в `AuditLog` (`audit.record`).
- Уведомления — `notify(users, title, body, kind, priority, link)`; роли — `users_with_roles(...)`.

---

## 6. API

**Прежние пути сохранены 1-в-1** (см. раздел «API» старой версии: `/api/lead|quiz|turnkey|content`, `/api/admin/login|submissions|content/*`,
`/api/crm/me|users|tasks/*|upload|ideas/*|accounts/*|calendar/*|smm/*|acc/*|mkt/*`).

Новое:
- `POST /api/admin/logout`; `GET /api/crm/me` дополнительно отдаёт `sections`, `fields`, `unreadNotifications`.
- Задачи: `POST /api/crm/tasks/content` `{id, content?, customFields?, startDate?, dueDate?}`; в `save` — `priority`, `startDate`, `clientId`, `dealId`, `content`, `customFields`. Даты принимают `ГГГГ-ММ-ДД` и `ДД.ММ`.
- `GET /api/crm/dashboard`.
- Клиенты: `GET /api/crm/clients?q&status`, `GET /api/crm/clients/<id>`, `POST …/clients/save|delete`.
- Сделки: `GET /api/crm/deals?pipeline&q`, `GET /api/crm/deals/<id>`, `POST …/deals/save|move|delete`; платежи `POST /api/crm/payments/save|delete`.
  Воронки и этапы — `PIPELINES` в `models.py` (sales / investment / partnership).
- Документы: `GET /api/crm/docs?clientId&dealId`, `GET /api/crm/docs/<id>`, `POST …/docs/save|delete`.
- Уведомления: `GET /api/crm/notifications?unread=1`, `POST …/read {ids|all}`, `GET|POST …/settings`, `POST …/test`.
- `GET /api/crm/search?q=`, `GET /api/crm/logs?entityType&entityId` (руководители).
- `GET|POST /api/crm/permissions/fields` (директор), `GET /api/crm/fields?resource`, `POST /api/crm/fields/save|delete` (руководители).

Формат блоков документа: `[{id, type: p|h1|h2|h3|bullet|numbered|todo|quote|callout|code|divider, text, checked?}]` (валидация в `blocks.py`).

---

## 7. Уведомления

- **Заявки с сайта** → Telegram директору (`TELEGRAM_LEADS_CHAT_ID`) + email (если задан `EMAIL_HOST_PASSWORD`) + центр уведомлений ролей, которые видят этот тип заявок.
- **События CRM** (назначение задачи, сдача на проверку, принятие/отклонение, новая/закрытая сделка) → центр уведомлений + личный Telegram сотрудника
  (`Profile.telegram_chat_id`, настраивается в CRM → Настройки → Уведомления: минимальный приоритет, «Не беспокоить», срочные пробивают DND).
- Бот: `@scpkg_bot`, токен — `TELEGRAM_BOT_TOKEN` в `backend/.env`.
- Нативные push (FCM/APNs) — не подключены, см. `MOBILE.md`.

---

## 8. SEO / пререндеринг — без изменений
`vite-react-ssg`, `Seo.tsx`, `public/robots.txt`, `scripts/gen-sitemap.mjs`. Перед деплоем заменить домен, добавить `og-image.png`.

---

## 9. Мобильное приложение
`frontend/capacitor.config.ts`, `npm run build:mobile` (читает `.env.mobile` с `VITE_API_URL`), `npx cap add android|ios`, `npx cap sync`.
Подробно — `MOBILE.md`. Нужны JDK 17 (сейчас не установлен) и Xcode.

---

## 10. Правила и конвенции (СОБЛЮДАТЬ)

1. Язык интерфейса — русский. Иконки — только SVG `<Icon />`.
2. Цвета только через токены `tokens.css`; тёмная тема переопределяет токены в `[data-theme="dark"]`. Новый CSS — в `crm.css`.
   В тёмной теме `--color-navy` — светлый **цвет текста**, фон сайдбара — `--color-sidebar`.
3. Деньги — компонент `<Money value currency compact? signed? />` (null = скрыто правами → замок).
4. Переходы между сущностями — `useNav()(type, id)`, не прямые setState из компонентов.
5. Оптимистичный UI для DnD и чекбоксов; автосохранение редакторов с debounce 700 мс.
6. Адаптив обязателен: брейкпоинты 1100 / 860 / 720 / 620 (admin.css, crm.css). Проверять по `getComputedStyle`, не по `innerWidth`.
7. Каждую фичу: `npm run build` + оба e2e + визуально. Новые эндпоинты — покрывать в `pipeline.e2e.mjs` (включая роли и 403).
8. Секреты — только в `backend/.env` (gitignored).
9. ESLint-правило `set-state-in-effect` срабатывает на существующий паттерн загрузки данных в `useEffect` — это известный baseline, не чинить массово.

---

## 11. Что дальше (по желанию пользователя)
- Деплой сделан (см. `deploy/DEPLOY.md`, домен kpioshsu.com). Осталось: нативные push, Gantt.
- Timeline/Gantt и календарный вид задач (бэкенд уже хранит `start_date`/`due_date`).
- Нативные push (Firebase) — см. `MOBILE.md`.
- Telegram-бот с командами (посмотреть задачи / сменить статус из чата).
- Автогенерация бухгалтерских задач 1-го числа — cron: `0 9 1 * * curl -X POST https://API/api/crm/acc/generate -H "Authorization: Bearer <токен>"`.

## 12. Как продолжить в новом чате
1. Открыть чат в этой папке, сказать: «Прочитай `PROJECT.md` и продолжаем — …».
2. Поднять Django (`backend`) и Vite (`frontend`) — есть конфиги в `.claude/launch.json`.
3. Статус: **116 e2e зелёные, `tsc -b` чистый**. Бэкенд — только Django (PHP удалён, начальные данные в `backend/legacy/`), CRM получила обзор, сделки с P&L, клиентов, базу знаний, уведомления, ⌘K, права на поля, тёмную тему, Capacitor-конфиг.
