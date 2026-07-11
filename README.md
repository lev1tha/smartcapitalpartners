# SmartCapitalPartners

Фуллстек-проект: **React + Vite** (фронтенд) и **PHP** (бэкенд API).
Дизайн-система установлена через [getdesign](https://getdesign.md) (`add cal`, вдохновлена Cal.com) — см. [frontend/DESIGN.md](frontend/DESIGN.md).

## Структура

```
SmartCapitalPartners/
├── frontend/          # React + Vite + TypeScript
│   ├── DESIGN.md      # дизайн-система (референс для UI)
│   └── src/
│       ├── styles/tokens.css   # CSS-переменные из DESIGN.md
│       ├── App.tsx
│       └── App.css
└── backend/           # PHP API
    ├── public/index.php        # точка входа + маршруты
    └── src/Router.php          # минималистичный роутер
```

## Запуск

### Бэкенд (PHP)

Нужен PHP 8.1+ ([установить](https://www.php.net/downloads) или `brew install php`).

```bash
cd backend
php -S localhost:8000 -t public
```

Проверка: <http://localhost:8000/api/health>

### Фронтенд (Vite)

```bash
cd frontend
npm install
npm run dev
```

Vite поднимется на <http://localhost:5173> и проксирует `/api/*` на PHP-бэкенд (порт 8000).

## API

| Метод | Путь          | Описание            |
|-------|---------------|---------------------|
| GET   | `/api/health` | Проверка состояния  |
| GET   | `/api/items`  | Пример ресурса      |
