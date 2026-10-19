# Frontend — сайт и CRM Smart Capital Partners

React 19 + Vite 8 + TypeScript, `react-router-dom` 6 (SSG через `vite-react-ssg`), Capacitor 8 для мобильного приложения.

```bash
npm install
npm run dev            # http://localhost:5173, /api и /uploads проксируются на Django :8000
npm run build          # sitemap + tsc -b + SSG-сборка в dist/
npm run lint
npm run build:mobile   # сборка для Capacitor (читает .env.mobile с VITE_API_URL)
```

- Публичные страницы — `src/pages/`, CRM — `src/pages/Admin.tsx` + `src/components/crm/`.
- API-клиент — `src/data/adminApi.ts`.
- Стили — только через токены `src/styles/tokens.css` (тёмная тема — `[data-theme="dark"]`).
- Дизайн-система — [DESIGN.md](DESIGN.md).

Общая документация проекта — [../README.md](../README.md), [../PROJECT.md](../PROJECT.md), [../MOBILE.md](../MOBILE.md).
