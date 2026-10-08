# Мобильное приложение SCP CRM (Capacitor)

CRM упаковывается в нативное приложение Android (.apk) и iOS (TestFlight / Ad Hoc)
через Capacitor. Веб-код тот же, что и у сайта; при запуске приложение сразу
открывает `/admin`.

## Что уже настроено

| Файл | Назначение |
|---|---|
| `frontend/capacitor.config.ts` | appId `kg.smartcapitalpartners.crm`, webDir `dist`, `androidScheme: https` |
| `frontend/src/mobile.ts` | в нативной оболочке переводит стартовый маршрут на `/admin` |
| `frontend/src/data/adminApi.ts` | читает `VITE_API_URL` — абсолютный адрес API для приложения |
| `backend/config/settings.py` | CORS уже разрешает `capacitor://localhost` (iOS) и `https://localhost` (Android) |
| `frontend/.env.mobile.example` | шаблон с адресом API |

## Требования

- **Android:** Android SDK (стоит в `~/Library/Android/sdk`) и **JDK 21** (Capacitor 8 / AGP требуют именно 21):
  `brew install openjdk@21` — установлен. Android Studio не обязателен: APK собирается из терминала.
- **iOS:** Xcode 15+ из App Store, CocoaPods (`brew install cocoapods`), аккаунт Apple Developer
  (99 $/год — нужен и для TestFlight, и для Ad Hoc; без него приложение ставится только на свой
  iPhone через Xcode на 7 дней).
- Развёрнутый бэкенд по **HTTPS** (iOS ATS и Android по умолчанию запрещают http://).

## Первый раз: инициализация платформ

```bash
cd frontend
cp .env.mobile.example .env.mobile      # впишите адрес своего API
npm run build:mobile                    # сборка dist/ с VITE_API_URL
npx cap add android
npx cap add ios                         # только на macOS
npx cap sync
```

`android/` и `ios/` — сгенерированные нативные проекты, их коммитят (там лежат иконки,
подписи, настройки). Повторять `cap add` не нужно.

## Каждая новая версия

```bash
cd frontend
npm run build:mobile && npx cap sync
```

`cap sync` копирует `dist/` внутрь нативных проектов и обновляет плагины.

## Android → APK

```bash
cd frontend && npx cap open android
```

В Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
Файл: `frontend/android/app/build/outputs/apk/debug/app-debug.apk` — его можно
отправить сотрудникам (на телефоне разрешить установку из неизвестных источников).

Для Google Play нужен подписанный релиз: **Build → Generate Signed Bundle / APK**,
создайте keystore и **сохраните его** — без него нельзя будет выпускать обновления.

Без Android Studio (так собран текущий APK):

```bash
cd frontend/android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleDebug
```

Файл: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

**Текущая отладочная сборка** смотрит на `http://192.168.200.164:8000` (этот Mac в локальной сети):
бэкенд нужно запускать как `manage.py runserver 0.0.0.0:8000`, телефон — в той же Wi-Fi-сети.
Для этого в `capacitor.config.ts` включён `server.cleartext` при `CAP_CLEARTEXT=1`
и добавлен `android/app/src/debug/AndroidManifest.xml` (только debug). Для прода: задать HTTPS-адрес
в `.env.mobile`, собрать без `CAP_CLEARTEXT`, выпустить подписанный release.

## iOS → TestFlight

```bash
cd frontend && npx cap open ios
```

В Xcode:

1. Target **App → Signing & Capabilities**: выберите Team (Apple Developer), Bundle ID
   `kg.smartcapitalpartners.crm` создастся автоматически.
2. Вверху выберите устройство **Any iOS Device (arm64)** — не симулятор и не конкретный iPhone,
   иначе пункт Archive будет недоступен.
3. **Product → Archive** → в окне Organizer **Distribute App → App Store Connect → Upload**.
4. В [App Store Connect](https://appstoreconnect.apple.com) → TestFlight: добавьте тестировщиков
   по email (внутренние — до 100 человек, без ревью Apple).

**Ad Hoc** (без TestFlight): в Organizer выберите **Distribute App → Ad Hoc**, предварительно
добавив UDID устройств в developer.apple.com → Devices. Полученный `.ipa` ставится через
Apple Configurator или Xcode → Devices.

## Иконки и заставка

Положите `icon.png` (1024×1024) и `splash.png` (2732×2732) в `frontend/resources/` и выполните:

```bash
cd frontend && npx @capacitor/assets generate
```

## Push-уведомления

Сейчас мобильные уведомления идут через **Telegram** (настраивается каждым сотрудником в
CRM → Настройки → Уведомления) — это работает в приложении и в вебе без дополнительной
инфраструктуры.

Нативные push (FCM / APNs) требуют проекта Firebase и ключей APNs; пакет
`@capacitor/push-notifications` уже установлен. Когда появятся ключи: добавить
`google-services.json` в `android/app/`, включить Push в Xcode Capabilities и завести
эндпоинт регистрации устройств в бэкенде. Это отдельная задача.

## Частые проблемы

- **Белый экран после запуска** — не задан `VITE_API_URL` или API отвечает без CORS.
  Проверьте: `curl -I -H "Origin: capacitor://localhost" https://API/api/health`.
- **401 сразу после входа** — токен не сохранился: убедитесь, что `androidScheme: https`.
- **Archive серый** в Xcode — выбран симулятор, нужно «Any iOS Device».
- **`invalid source release: 21`** — Gradle запущен не той Java: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21`.
