# Smart Capital Partners

Фуллстек-проект: **React + Vite** (сайт + CRM) и **Django + DRF** (API).
Дизайн-система — Cal.com-style ([frontend/DESIGN.md](frontend/DESIGN.md)); у CRM есть тёмная и светлая темы.

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
│   ├── legacy/{content,storage}/      # начальные данные сайта и CRM (JSON) для import_legacy
│   └── tests/*.e2e.mjs                # e2e через HTTP (116 проверок)
├── MOBILE.md              # сборка APK / TestFlight
└── PROJECT.md             # контекст проекта для продолжения работы
```

## Запуск

### Бэкенд (Django)

```bash
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                       # заполнить секреты (Telegram, SMTP, DATABASE_URL)
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_users      # 6 сотрудников с паролями по умолчанию (сменить!)
.venv/bin/python manage.py import_legacy   # начальные данные из backend/legacy (один раз)
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

- `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY`, `DATABASE_URL=postgres://…`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`.
- `gunicorn config.wsgi` за nginx; nginx отдаёт `backend/uploads/` по `/uploads/` и `frontend/dist/` как статику.
- `python manage.py collectstatic` для Django-admin (`/django-admin/`).
- Сменить пароли: `python manage.py changepassword <login>`.
