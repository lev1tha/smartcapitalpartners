# MF PRO — контекст проекта (handoff для нового чата)

> Этот файл — полная передача контекста. Прочитай его целиком перед продолжением работы.
> Проект ведётся итеративно, по-русски, аккуратно: каждая фича проверяется сборкой + e2e + визуально в браузере.

---

## 1. Что это за проект

**MF PRO** — портал «Маркетинг и финансы для бизнеса в Кыргызстане» (B2B, помощь предпринимателям).
Состоит из двух частей:

1. **Публичный сайт** — лендинги, каталог бизнес-моделей, услуги, экспресс-тест, налоги, франшизы/инвестиции/готовые бизнесы.
2. **CRM-админка (`/admin`)** — внутренняя система для сотрудников: задачи (kanban), контент-календарь, ролевые дашборды (SMM, Бухгалтерия), управление контентом, заявки.

Дизайн — чистый, в духе Cal.com / Notion: белый фон, тёмно-синий (navy) + мятный (mint) акценты.

---

## 2. Технологии и расположение

| | |
|---|---|
| Корень | `/Users/ashimovace/Desktop/projects/MFPro` |
| Frontend | `frontend/` — React **19.2** + Vite **8** + TypeScript |
| Роутинг | `react-router-dom` **6.30** (НЕ v7! откатили ради SSG) |
| SSG/SEO | `vite-react-ssg` 0.9.1-beta — пререндер всех маршрутов в статичный HTML |
| Backend | `backend/` — **PHP 8.5**, без фреймворка, свой минималистичный роутер |
| Хранилище | JSON-файлы (`backend/storage/`, `backend/content/`), загрузки в `backend/public/uploads/` |
| Node | v24 (умеет запускать `.ts` напрямую — используется в seed/sitemap скриптах) |

### Запуск (нужно 2 терминала)
```bash
# 1. Бэкенд
cd backend && php -S localhost:8000 -t public
# (php установлен через brew; если нет в PATH: export PATH="/opt/homebrew/bin:$PATH")

# 2. Фронтенд
cd frontend && npm run dev   # http://localhost:5173, проксирует /api → :8000
```
Работаем на **http://localhost:5173**. Админка — **/admin**.

### Сборка и проверки
```bash
cd frontend && npm run build          # gen-sitemap + tsc (typecheck) + vite-react-ssg build
cd backend  && node tests/crm.e2e.mjs # 48 e2e-тестов (нужен запущенный php-сервер :8000)
```

---

## 3. Роли и доступы (вход в /admin)

Хранятся в `backend/config.php` (gitignored). Вход по **логину/паролю**, токен подписывается `auth_secret`.

| Логин | Пароль | Роль | Что видит в админке |
|-------|--------|------|---------------------|
| `director` | `director123` | Директор | всё |
| `manager` | `manager123` | Управляющий | всё |
| `marketer` | `marketer123` | Маркетолог | Задачи, Контент-календарь, Заявки, Каталог, Идеи |
| `smm` | `smm123` | СММ | Задачи, **SMM-дашборд**, Контент-календарь, Идеи |
| `accountant` | `accountant123` | Бухгалтер | Задачи, **Бухгалтерия**, Идеи |
| `finance` | `finance123` | Финансист | Задачи, Заявки (только тесты), Бухгалтерия, Идеи |

> ⚠️ Перед публикацией сменить ВСЕ пароли + `auth_secret` в `config.php`.

Ролевые правила (`backend/src/Crm.php`):
- `isManager` = director, manager
- `canCalendar` = director, manager, marketer, smm
- `canSmm` = director, manager, smm
- `canAccounting` = director, manager, accountant, finance
- `submissionAccess`: director/manager/marketer — все заявки; finance — только тесты (quiz); smm/accountant — нет

---

## 4. Структура фронтенда

```
frontend/src/
├── App.tsx                # routes (vite-react-ssg RouteRecord[]) + /admin отдельно
├── main.tsx               # ViteReactSSG({ routes })
├── pages/                 # Home, Catalog, CatalogDetail, Turnkey, Quiz, Taxes,
│                          # Franchises, FranchiseDetail, Investments, InvestmentDetail,
│                          # ReadyBusiness, ReadyDetail, Admin
├── components/
│   ├── Header, Hero, ProductMatrix, Mission, KnowledgeBase, Tools, Trust, LeadFooter
│   ├── Layout.tsx         # общий каркас публичных страниц (хедер+футер, скролл к якорю)
│   ├── Seo.tsx            # <Head> из vite-react-ssg, per-route мета + JSON-LD + noindex
│   ├── Icon.tsx           # SVG-иконки (Feather-style). ВСЕГДА используем их, НЕ эмодзи!
│   ├── AdminCatalog.tsx   # CRUD карточек каталога в админке
│   └── crm/
│       ├── CrmTasks.tsx       # kanban-доска задач (drag-and-drop между статусами)
│       ├── CrmSubmissions.tsx # заявки (лиды/тесты/под ключ), ролевой доступ, CSV
│       ├── CrmIdeas.tsx       # доска идей (+ удаление)
│       ├── CrmUsers.tsx       # список сотрудников
│       ├── CrmCalendar.tsx    # контент-календарь (аккаунты + посты, DnD по дням)
│       ├── CrmSmm.tsx         # SMM-дашборд (инструменты | TODO | KPI)
│       └── CrmAccounting.tsx  # Бухгалтерия (радар | доступы | чек-лист | документы)
├── data/
│   ├── catalog.ts, offerings.ts, taxes.ts, trust.ts, turnkey.ts, quiz.ts  # SEED-данные
│   ├── useContent.ts      # хук живого контента (seed → подмена данными из API)
│   └── adminApi.ts        # fetch-обёртка с токеном (getToken/setToken/clearToken)
├── styles/
│   ├── tokens.css         # CSS-переменные (цвета, шрифты, радиусы, отступы)
│   ├── mfpro.css          # публичный сайт (хедер, hero, секции, футер)
│   ├── catalog.css, turnkey.css, taxes.css, offerings.css, quiz.css
│   └── admin.css          # ВСЯ админка/CRM (большой файл)
└── scripts/
    ├── gen-sitemap.mjs    # генерит public/sitemap.xml из данных (в npm build)
    └── seed-content.ts    # одноразовый сид backend/content/*.json из src/data (Node TS)
```

### Публичные маршруты
`/`, `/catalog`, `/catalog/:id`, `/turnkey`, `/taxes`, `/test`,
`/franchises`, `/franchises/:id`, `/investments`, `/investments/:id`,
`/ready`, `/ready/:id`, `/admin` (noindex, отдельно от Layout).

---

## 5. Структура бэкенда

```
backend/
├── public/index.php       # ЕДИНАЯ точка входа: CORS, ini display_errors off, маршруты, dispatch
├── public/uploads/        # загруженные файлы (квитки, вложения задач)
├── config.php             # СЕКРЕТЫ (gitignored): recipient, smtp, telegram, admin, auth_secret, users
├── config.example.php     # шаблон конфига
├── src/
│   ├── Router.php         # get()/post()/dispatch(), обработчик возвращает массив → JSON
│   ├── Auth.php           # логин/пароль → токен "login.hmac", роли, ROLES
│   ├── Crm.php            # бизнес-логика: статусы задач, transition(), ролевые правила
│   ├── Content.php        # CRUD контента сайта (models/franchises/investments/ready)
│   ├── Store.php          # JSON-хранилище (read/write/id) для storage/*.json
│   ├── Notifier.php       # единая отправка: email (SMTP/mail) + Telegram
│   ├── SmtpMailer.php     # нативный SMTP-over-SSL клиент (без зависимостей)
│   ├── Telegram.php       # отправка в Telegram Bot API через cURL
│   └── Mailer.php         # fallback mail(), получатель
├── storage/               # *.json: leads, quiz-results, turnkey-requests, tasks, ideas,
│                          # accounts, calendar, smm-tasks, smm-settings,
│                          # acc-tasks, acc-docs, acc-settings
├── content/               # models.json, franchises.json, investments.json, ready.json
└── tests/crm.e2e.mjs      # 48 e2e (через fetch к API)
```

### Конвенции PHP
- `declare(strict_types=1)`, `namespace MFPro`, классы статические.
- Роут: `$router->post('/api/...', function () use ($config): array { ... return [...]; });`
- Защита: `$user = Auth::user($config); if (!$user || !Crm::canX(...)) { http_response_code(403); return [...]; }`
- `display_errors` выключен → ответ всегда чистый JSON.
- Хранилище — через `Store::read/write('file.json')`.

---

## 6. API — полный список эндпоинтов

**Публичные:**
- `GET  /api/health`
- `POST /api/lead` `{name,phone,topic}` — лид с главной
- `POST /api/quiz` `{contact,score,maxScore,level,answers}` — результат теста
- `POST /api/turnkey` `{name,phone,sphere,budget,city,services}` — заявка «под ключ»
- `GET  /api/content?type=models|franchises|investments|ready` — карточки сайта

**Контент (роли director/manager/marketer):**
- `POST /api/admin/content/save` `{type,item}`
- `POST /api/admin/content/delete` `{type,id}`

**Авторизация:**
- `POST /api/admin/login` `{login,password}` → `{token,user,roleLabel}`
- `GET  /api/crm/me` → `{user,roleLabel,isManager,access}`

**Заявки (ролевой доступ):**
- `GET  /api/admin/submissions` → `{access,counts,leads,quiz,turnkey}`

**Задачи (kanban):**
- `GET  /api/crm/tasks` → `{tasks,statuses,roles,me,isManager}`
- `POST /api/crm/tasks/save` (manager) — создать/изменить
- `POST /api/crm/tasks/transition` `{id,action,payload}` — start/submit/approve/reject
- `POST /api/crm/tasks/delete` (manager)
- `POST /api/crm/upload` (multipart) — вложение → `{attachment}`

**Идеи:** `GET /api/crm/ideas`, `POST /api/crm/ideas`, `POST /api/crm/ideas/delete`
**Сотрудники:** `GET /api/crm/users` (manager)

**Контент-календарь (canCalendar):**
- `GET  /api/crm/accounts`; `POST /api/crm/accounts/save` (dir/mgr/mkt); `POST /api/crm/accounts/delete` (mgr)
- `GET  /api/crm/calendar?accountId=`; `POST /api/crm/calendar/save`; `POST /api/crm/calendar/delete`

**SMM-дашборд (canSmm):**
- `GET  /api/crm/smm/board` → `{tasks,settings}`
- `POST /api/crm/smm/tasks/save` `{item}`; `/toggle` `{id}`; `/delete` `{id}`
- `POST /api/crm/smm/settings` `{settings:{tools,kpi}}`

**Бухгалтерия (canAccounting):**
- `GET  /api/crm/acc/board` → `{tasks,docs,settings}`
- `POST /api/crm/acc/tasks/save` `{item}` (period: daily/monthly/quarterly/yearly; status: not_started/in_progress/formed/submitted)
- `POST /api/crm/acc/tasks/status` `{id,status}`
- `POST /api/crm/acc/tasks/receipt` (multipart `file`+`id`) — квиток → статус submitted
- `POST /api/crm/acc/tasks/delete` `{id}`
- `POST /api/crm/acc/docs/save` `{item:{counterparty,type,status}}`; `/delete` `{id}`
- `POST /api/crm/acc/settings` `{settings:{ecpValidUntil,links}}`
- `POST /api/crm/acc/generate` `{month:'YYYY-MM'}` — авто-создание стандартных отчётов КР (идемпотентно). Шаблоны в `mfpro_acc_templates()` в `index.php`

**Маркетинг (canMarketing = director/manager/marketer):**
- `GET  /api/crm/mkt/board` → `{submissionsMonth, submissionsTotal, byType, campaigns, settings}` — метрики из реальных заявок (leads/quiz/turnkey за текущий месяц)
- `POST /api/crm/mkt/campaigns/save` `{item:{name,channel,status,budget,spent,leads}}`; `/delete` `{id}`
- `POST /api/crm/mkt/settings` `{settings:{links,funnel,budgetPlan}}`

---

## 7. Уведомления о заявках

- **Telegram** — НАСТРОЕН и работает. Бот `@mfprokg_bot`, chat_id директора в `config.php`.
  Все 3 формы (lead/quiz/turnkey) шлют через `Notifier::send` → Telegram + (попытка) email.
- **Email (Gmail SMTP)** — код готов (`SmtpMailer`), но **выключен** (`smtp.enabled=false`):
  ждёт App Password от пользователя (`eldimamaev@gmail.com`). Без него письма локально не доходят,
  но заявки всегда сохраняются в `storage/*.json` и идут в Telegram.

---

## 8. SEO / пререндеринг

- `vite-react-ssg` генерит статичный HTML для каждого маршрута (32 страницы) в `npm run build`.
- `Seo.tsx` (через `<Head>`) задаёт per-route `<title>`, `description`, Open Graph, Twitter, canonical;
  на главной — JSON-LD Organization; на `/admin` — `noindex`.
- `index.html` НЕ содержит title/description/og (чтобы не было дублей) — всё через React.
- `public/robots.txt` + `public/sitemap.xml` (генерится `scripts/gen-sitemap.mjs`).
- Перед деплоем: заменить домен `mfpro.kg` в `Seo.tsx`, `robots.txt`, `gen-sitemap.mjs`; добавить `public/og-image.png` (1200×630).

---

## 9. CRM — что уже сделано

- **Задачи (kanban)**: 5 колонок по статусам, **drag-and-drop** между ними, воркфлоу (Новая→В работе→На проверке→Выполнена/Отклонена), отклонение с причиной, сдача с результатом+ссылкой (reels), вложения файлов, история, права по ролям.
- **Контент-календарь**: аккаунты соцсетей, месячная сетка, посты (формат/статус), **DnD постов между днями**.
- **SMM-дашборд** (`CrmSmm`): 3 зоны — инструменты-ссылки | TODO с табами Сегодня/Неделя/Месяц (чекбокс, цветные категории, приоритеты, просрочка, быстрое добавление, оптимистичный UI) | KPI-прогресс-бары (охваты/подписчики/ER). Настройки в drawer.
- **Бухгалтерия** (`CrmAccounting`): Налоговый радар (ближайший дедлайн, цвет по срочности), доступы (ЭЦП с подсветкой <30 дней, ссылки СТИ/ЭСФ/ЭТТН/банк), календарный чек-лист (табы День/Месяц/Квартал/Год + селектор периода), **4-статусный воркфлоу** документов, **загрузка квитка → статус «Сдано»**, контроль первичной документации (таблица). Строгий стиль.
- **Управление контентом сайта**: вкладка «Каталог» — CRUD карточек, публичные страницы тянут живые данные (`useContent`).
- **Заявки**: таблицы лидов/тестов/под-ключ, ролевой доступ, раскрытие ответов теста, экспорт CSV.
- **Идеи**, **Сотрудники**.

---

## 10. Правила и конвенции (СОБЛЮДАТЬ)

1. **Язык интерфейса — русский.**
2. **Иконки — только SVG** через `<Icon name="..." />`. НЕ использовать эмодзи в UI (пользователь просил строгий CRM-стиль).
3. **Дизайн**: чистый, navy (`--color-navy #0e2a47`) + mint (`--color-mint #10b981`), белый фон. Палитра в `tokens.css`. Шрифты: Cal Sans (заголовки) + Inter.
4. **Оптимистичный UI** для чекбоксов/тоглов (ставим локально сразу, потом API, откат при ошибке).
5. **Адаптив админки** обязателен. Брейкпоинты в `admin.css`: 1100 / 860 / 720 / 620 px.
   - Сайдбар → верхняя панель с прокручиваемой лентой иконок (≤860).
   - Kanban: десктоп — грид 5 колонок (высокие); ≤1100 — горизонтальный скролл; ≤720 — вертикальный стек.
   - Дашборды (smm/acc): 3 зоны → стек на ≤1100.
6. **Каждую фичу проверять**: `npm run build` (типы) + `node tests/crm.e2e.mjs` (бэкенд) + визуально в браузере (preview MCP).
7. **e2e**: добавлять тесты для новых эндпоинтов в `crm.e2e.mjs` (ловить и роли/доступы). Уникальные имена переменных (есть коллизии при copy-paste).
8. **Новый ролевой раздел админки**: эндпоинты в `index.php` + роль-хелпер в `Crm.php` + компонент в `components/crm/` + пункт в `nav` массиве `Admin.tsx` (с `show:` по ролям) + рендер по `active === '...'` + стили в `admin.css` + e2e.
9. **Секреты** только в `config.php` (gitignored). Никогда не коммитить.
10. **Превью-тул**: `window.innerWidth` в iframe может «врать» (залипает) — судить о брейкпоинтах по `getComputedStyle`, а не по innerWidth. Скриншоты иногда лагают на 1 кадр — делать повторный.

---

## 11. Что делать дальше (запрошено пользователем)

### A. Дашборд для МАРКЕТОЛОГА (воронки / кампании) — ✅ СДЕЛАНО
`components/crm/CrmMarketing.tsx`. Метрики месяца (заявки/кампании/бюджет/CPL — из реальных данных),
воронка продаж (Заявки авто → Квалификация → Консультация → Договор → Клиент с конверсиями),
кампании CRUD (канал/бюджет/потрачено/лиды/CPL/статус), источники заявок (разбивка leads/quiz/turnkey),
рекламные кабинеты-ссылки. Настройки воронки/бюджета/ссылок в drawer.

<details><summary>Исходное ТЗ-набросок (для справки)</summary>
По аналогии с SMM/Бухгалтерией. Идеи по содержанию (уточнить у пользователя ТЗ, как он делал для SMM/бухгалтера):
- **Воронки продаж**: этапы (лид → квалификация → консультация → договор → оплата), конверсии между этапами, числа на каждом этапе. Можно связать с реальными заявками (`leads`, `quiz`, `turnkey`) из CRM.
- **Кампании**: список рекламных кампаний (канал, бюджет, потрачено, лиды, CPL, ROI), статусы (план/активна/завершена).
- **KPI маркетинга**: лиды за месяц, стоимость лида (CPL), конверсия в клиента, бюджет (план/факт) — прогресс-бары.
- **UTM/каналы**: разбивка лидов по источникам.
- Роль-доступ: `canMarketing` = director, manager, marketer.
- Эндпоинты: `/api/crm/mkt/board`, `/api/crm/mkt/campaigns/save|delete`, `/api/crm/mkt/funnel` (можно считать из заявок), `/api/crm/mkt/settings`.
- Компонент `components/crm/CrmMarketing.tsx`, пункт меню `marketing` (icon: `trending` или новый), e2e.
- **Сначала спросить у пользователя ТЗ/пожелания** (он присылает подробные ТЗ для каждой роли).
</details>

### B. Авто-генерация бухгалтерских задач 1-го числа — ✅ СДЕЛАНО
- Шаблоны в `mfpro_acc_templates()` (`backend/public/index.php`): ежемесячные (20: подоходный+соцфонд; 25: НДС, налог с продаж), квартальный (мес. 4/7/10/1, день 20), годовой (март, день 1).
- Эндпоинт `POST /api/crm/acc/generate` `{month}` — идемпотентно (по title+deadline), `reportingPeriod` = предыдущий месяц.
- В UI бухгалтерии — кнопка «Сгенерировать отчёты» (текущий месяц).
- e2e: создание, идемпотентность, отказ для не-бухгалтера.
- **Для прода (авто 1-го числа)**: добавить cron на сервере, напр.
  `0 9 1 * * curl -s -X POST https://API/api/crm/acc/generate -H "Authorization: Bearer <сервисный токен>" -d '{}'`
  (нужен сервисный токен/ключ; сейчас вызывается из UI вручную).

### Прочие отложенные хотелки
- **Telegram-уведомления** сотруднику при назначении задачи/поста.
- **Email через Gmail SMTP** — ждёт App Password от пользователя.
- **Дедлайны/приоритеты** в обычных задачах (kanban) с подсветкой просрочки.
- **Деплой**: домен, хостинг (Vercel/Netlify для статики + PHP-хостинг для API), заменить mfpro.kg, og-image, сменить пароли.
- Детальные страницы франшиз/инвестиций уже есть; публичные «Контакты», блог — по желанию.

---

## 12. Как продолжить в новом чате

1. Открой новый чат в этой же папке проекта.
2. Скажи ассистенту: «Прочитай `PROJECT.md` в корне и продолжаем — делаем **дашборд маркетолога** (воронки/кампании) и **авто-генерацию бухгалтерских задач 1-го числа**».
3. Ассистент должен: поднять бэкенд (`php -S localhost:8000 -t public` в `backend`) и дев-сервер, и работать по правилам из раздела 10.
4. Для дашборда маркетолога — сначала уточнить ТЗ у пользователя (он любит присылать подробные спецификации, как для SMM/бухгалтера).

Статус: **57 e2e-тестов зелёные, сборка чистая**. Готово **4 ролевых дашборда** (Задачи/kanban, SMM, Бухгалтерия, Маркетинг) + авто-генерация бух. задач. Весь план по дашбордам выполнен.
Дальше по желанию: Telegram-уведомления о задачах, Email SMTP (ждёт App Password), дедлайны в обычных задачах, **деплой**.
