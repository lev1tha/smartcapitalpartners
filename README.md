# Smart Capital Partners

Фуллстек-проект: **React + Vite** (сайт + CRM) и **Django + DRF** (API).
Дизайн-система — Cal.com-style ([frontend/DESIGN.md](frontend/DESIGN.md)); у CRM есть тёмная и светлая темы.

Прод: **https://kpioshsu.com** (CRM — `/admin`).

## Структура

```
SmartCapitalPartners/
├── frontend/              # React 19 + Vite + TypeScript (+ Capacitor для Android/iOS)
│   ├── capacitor.config.ts
│   └── src/
│       ├── pages/Admin.tsx            # оболочка CRM: меню, поиск ⌘K, уведомления, тема
│       ├── components/crm/            # разделы CRM (задачи, сделки, клиенты, база знаний…)
│       └── styles/{tokens,admin,crm}.css
├── backend/               # Django 5.2 + DRF, PostgreSQL (prod) / SQLite (dev)
│   ├── config/settings.py             # настройки читаются из backend/.env
│   ├── crm/models.py                  # схема данных
│   ├── crm/permissions.py             # матрица прав на поля (видимость финансов и контактов)
│   ├── crm/views/                     # эндпоинты по модулям
│   ├── crm/management/commands/       # seed_users, import_legacy
│   └── tests/*.e2e.mjs                # e2e через HTTP (116 проверок)
├── backend-php/           # прежний PHP-бэкенд (только для импорта данных, не запускается)
├── deploy/                # nginx, systemd, DEPLOY.md — продакшен на VPS
├── MOBILE.md              # сборка APK / TestFlight
├── PROJECT.md             # контекст проекта для продолжения работы
└── GEMINI.md              # инструкции для Gemini CLI (правила, команды, конвенции)
```

## Запуск

### Бэкенд (Django)

```bash
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                       # заполнить секреты (Telegram, SMTP, DATABASE_URL)
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_users      # 6 сотрудников с паролями по умолчанию (сменить!)
.venv/bin/python manage.py import_legacy ../backend-php   # перенос данных из JSON (один раз)
.venv/bin/python manage.py runserver 8000
```

Проверка: <http://localhost:8000/api/health>

### Фронтенд (Vite)

```bash
cd frontend
npm install
npm run dev
```

Vite поднимется на <http://localhost:5173> и проксирует `/api/*` и `/uploads/*` на Django (порт 8000).
CRM — <http://localhost:5173/admin>.

### Проверки

```bash
cd frontend && npm run build              # typecheck + SSG-сборка
cd backend && node tests/crm.e2e.mjs      # прежние модули (57)
cd backend && node tests/pipeline.e2e.mjs # клиенты, сделки, права, документы, уведомления (59)
```

### Мобильное приложение

См. [MOBILE.md](MOBILE.md): `npm run build:mobile && npx cap sync`, затем Android Studio / Xcode.

## Продакшен

Развёрнут на VPS под **kpioshsu.com** (nginx + gunicorn + PostgreSQL 16, домен за Cloudflare).
Пошагово, включая обновление и бэкап, — [deploy/DEPLOY.md](deploy/DEPLOY.md).

- `backend/.env`: `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY`, `DATABASE_URL=postgres://…`, `DJANGO_ALLOWED_HOSTS`,
  `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` (для `/django-admin/` по HTTPS), Telegram и SMTP.
- `gunicorn config.wsgi` (systemd `scp-backend`) за nginx; nginx отдаёт `frontend/dist/`, `/static/` и `/uploads/`.
- Сменить пароли сотрудников: `python manage.py changepassword <login>`.

## Документация

| Файл | О чём |
|---|---|
| [PROJECT.md](PROJECT.md) | полный контекст: роли, API, модели, конвенции, что дальше |
| [GEMINI.md](GEMINI.md) | контекст для Gemini CLI |
| [MOBILE.md](MOBILE.md) | Capacitor, APK, TestFlight |
| [deploy/DEPLOY.md](deploy/DEPLOY.md) | деплой на VPS |
| [frontend/DESIGN.md](frontend/DESIGN.md) | дизайн-токены и компоненты |
