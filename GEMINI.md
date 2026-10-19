# GEMINI.md — контекст проекта Smart Capital Partners

Этот файл Gemini CLI загружает автоматически. Здесь — то, что нужно знать до первой правки.
Полный контекст (роли, API, модели, уведомления) — в [`PROJECT.md`](PROJECT.md); прочитай его,
если задача касается бэкенда, прав доступа или CRM.

**Общайся с пользователем и пиши комментарии/коммиты по-русски.** Интерфейс приложения — тоже на русском.

---

## Что это

B2B-портал «Маркетинг и финансы для бизнеса в Кыргызстане»:

1. **Публичный сайт** (SSG, SEO) — лендинги, каталог бизнес-моделей, экспресс-тест, налоги, франшизы/инвестиции/готовые бизнесы.
2. **CRM `/admin`** — задачи (kanban + doc-view), сделки с P&L, клиенты, база знаний (Notion-блоки), уведомления
   (web + Telegram), поиск ⌘K, ролевые дашборды, права на поля, тёмная/светлая тема.
3. **Мобильное приложение** — та же CRM в Capacitor (Android APK, iOS TestFlight).

Прод: **https://kpioshsu.com** (VPS, nginx + gunicorn + PostgreSQL 16, за Cloudflare).

## Стек

| Часть | Технологии | Папка |
|---|---|---|
| Frontend | React 19.2, Vite 8, TypeScript 6, `react-router-dom` **6.30** (не v7 — из-за SSG), `vite-react-ssg`, `framer-motion`, Capacitor 8 | `frontend/` |
| Backend | Django 5.2 + DRF, Python 3.12, SQLite (dev) / PostgreSQL (prod), gunicorn, whitenoise | `backend/` |
| Деплой | nginx, systemd, certbot | `deploy/` |
| Legacy | старый PHP-бэкенд, **не запускать и не править** — нужен только для `import_legacy` | `backend-php/` |

## Команды

```bash
# Backend (порт 8000)
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_users          # 6 сотрудников, пароль = login + '123'
.venv/bin/python manage.py runserver 8000

# Frontend (порт 5173, проксирует /api и /uploads на :8000)
cd frontend && npm install && npm run dev      # CRM: http://localhost:5173/admin
```

Проверки — **обязательны после каждой фичи**:

```bash
cd frontend && npm run build                   # sitemap + tsc -b + SSG — должно пройти без ошибок
cd frontend && npm run lint
cd backend  && .venv/bin/python manage.py check
cd backend  && node tests/crm.e2e.mjs          # 57 проверок, нужен запущенный Django на :8000
cd backend  && node tests/pipeline.e2e.mjs     # 59 проверок
```

Для e2e внешние каналы лучше выключить: `NOTIFY_ASYNC=0` в `backend/.env`.
Новые миграции: `.venv/bin/python manage.py makemigrations crm`.

## Карта кода

```
frontend/src/
├── pages/                    # публичные страницы; Admin.tsx — оболочка CRM (меню по me.sections, ⌘K, тема, NavCtx)
├── components/crm/           # разделы CRM: CrmTasks, CrmDeals, CrmClients, CrmDocs, BlockEditor, NotificationCenter…
│   ├── ui.tsx                # ThemeProvider, Drawer, Money, Avatar, Empty, Reveal
│   └── format.ts, theme.ts, blocks.ts, nav.ts   # хелперы без React
├── components/Icon.tsx       # единственный источник иконок
├── data/adminApi.ts          # fetch + Bearer-токен, API_BASE из VITE_API_URL, событие 401
└── styles/tokens.css         # дизайн-токены (+ [data-theme="dark"]), admin.css, crm.css

backend/
├── config/settings.py        # всё из backend/.env (python-dotenv)
└── crm/
    ├── models.py             # все модели; воронки сделок — PIPELINES
    ├── roles.py              # роли и доступ к разделам
    ├── permissions.py        # FIELD_REGISTRY, FieldAccess, декоратор require()
    ├── presenters.py         # сериализация в camelCase
    ├── notify.py, audit.py   # уведомления, журнал изменений
    ├── views/{public,auth,tasks,boards,crm,workspace}.py
    ├── urls.py               # пути БЕЗ завершающего слэша
    └── management/commands/  # seed_users, import_legacy
```

## Правила (соблюдать строго)

### Frontend
1. Иконки — только SVG через `<Icon name="…" />`. **Никаких эмодзи** в интерфейсе.
2. Цвета — только CSS-переменные из `tokens.css`. Тёмная тема переопределяет токены в `[data-theme="dark"]`;
   в ней `--color-navy` — это светлый цвет **текста**, фон сайдбара — `--color-sidebar`. Новый CSS CRM — в `crm.css`.
3. Бренд: navy `#001E52` + cornflower `#528AEB`, стиль Cal.com/Notion (см. `frontend/DESIGN.md`). Суммы — JetBrains Mono.
4. Деньги выводить через `<Money value currency compact? signed? />`; `null` = поле скрыто правами (показывается замок).
5. Переходы между сущностями — `useNav()(type, id)`, а не прямой `setState` из компонентов.
6. Оптимистичный UI для drag-and-drop и чекбоксов; автосохранение редакторов с debounce 700 мс.
7. Адаптив обязателен: брейкпоинты 1100 / 860 / 720 / 620 px.
8. Не обновлять `react-router-dom` до v7 — сломается SSG.
9. Предупреждение ESLint `set-state-in-effect` на загрузке данных в `useEffect` — известный baseline, массово не чинить.

### Backend
1. Ошибка API — всегда `{"error": "…"}` через `ApiError(message, code)`; коды 401/403/404/422.
2. Вьюхи — `@api_view` + `@require(check, message, anon_status)`.
3. JSON-ключи ответов — **camelCase** (через `presenters.py`).
4. Финансовые и контактные поля отдавать через `field_access(request)`; перед записью — `fa.assert_editable(...)`.
   Скрытое поле → `null` + имя в `hidden`; запись защищённого поля → **403**, не молчаливое игнорирование.
5. Изменения клиентов/сделок/платежей/задач писать в журнал: `audit.record(...)`.
6. Уведомления — `notify(users, title, body, kind, priority, link)`; получатели по ролям — `users_with_roles(...)`.
7. Каждый новый эндпоинт покрывать в `backend/tests/pipeline.e2e.mjs`, включая проверки ролей и 403.

### Роли
`director`, `manager`, `marketer`, `smm`, `accountant`, `finance`. Доступ к разделам — `crm/roles.py`
(фронт строит меню по `GET /api/crm/me` → `sections`). Директор всегда видит всё.

### Безопасность и git
- Секреты — только в `backend/.env` (в `.gitignore`). Не коммитить `.env`, `backend-php/config.php`, `db.sqlite3`, `uploads/`.
- Не выводить содержимое `.env` в ответах и логах.
- В сообщениях коммитов не добавлять строки про ИИ-соавторство. Не делать `git push` — пользователь пушит сам.
- Не трогать прод-сервер; для деплоя — только инструкции из `deploy/DEPLOY.md`.

## Где что менять

| Задача | Файлы |
|---|---|
| Новый раздел CRM | `components/crm/CrmX.tsx`, `pages/Admin.tsx` (меню), `crm/roles.py` (доступ), `views/*.py`, `urls.py`, e2e |
| Новая модель / поле | `crm/models.py` → `makemigrations` → `presenters.py` → при необходимости `FIELD_REGISTRY` |
| Новая публичная страница | `frontend/src/pages/`, маршрут в `App.tsx`, `<Seo />`, `scripts/gen-sitemap.mjs` |
| Домен сайта | `components/Seo.tsx` (`SITE_URL`), `scripts/gen-sitemap.mjs` (`SITE`), `public/robots.txt` |
| Мобильная сборка | `MOBILE.md`, `frontend/capacitor.config.ts`, `frontend/.env.mobile` |
| Сервер | `deploy/DEPLOY.md`, `deploy/nginx/`, `deploy/systemd/` |

## Документация

- [`PROJECT.md`](PROJECT.md) — полный handoff: API, роли, уведомления, планы.
- [`README.md`](README.md) — быстрый старт.
- [`MOBILE.md`](MOBILE.md) — Capacitor, APK (JDK 21), TestFlight.
- [`deploy/DEPLOY.md`](deploy/DEPLOY.md) — деплой и обновление прода.
- [`frontend/DESIGN.md`](frontend/DESIGN.md) — дизайн-система.

При изменении архитектуры, команд или правил — обнови `PROJECT.md` и этот файл.
