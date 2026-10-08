import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Нативная оболочка CRM (Android / iOS).
 *
 * Сборка берёт готовый dist/ (тот же SSG-билд, что и для сайта); при старте
 * src/mobile.ts переводит приложение на /admin. Запросы к API идут на адрес
 * из VITE_API_URL (см. .env.mobile.example) — прокси Vite в приложении нет.
 */
const config: CapacitorConfig = {
  appId: 'kg.smartcapitalpartners.crm',
  appName: 'SCP CRM',
  webDir: 'dist',
  server: {
    // Android: https://localhost вместо http:// — иначе Secure-cookies и Service Worker не работают
    androidScheme: 'https',
    // Отладочная сборка к локальному Django по http://<LAN-IP>:8000 — разрешаем cleartext.
    // Для прода (API по HTTPS) переменную не задавать.
    cleartext: process.env.CAP_CLEARTEXT === '1',
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
