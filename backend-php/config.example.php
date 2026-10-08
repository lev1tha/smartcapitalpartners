<?php

/**
 * Конфигурация доставки заявок. Скопируйте в config.php и заполните секреты.
 * config.php не коммитится в git (см. .gitignore).
 */

return [
    // Куда отправлять все заявки и результаты тестов
    'recipient' => 'eldimamaev@gmail.com',

    // === Gmail SMTP ===
    // 1) Включите 2FA в Google-аккаунте
    // 2) Создайте «Пароль приложения»: https://myaccount.google.com/apppasswords
    // 3) Вставьте 16-значный пароль в 'password' и поставьте 'enabled' => true
    'smtp' => [
        'enabled'   => false,
        'host'      => 'smtp.gmail.com',
        'port'      => 465,
        'username'  => 'eldimamaev@gmail.com',
        'password'  => '',            // ← App Password (16 символов, без пробелов)
        'from'      => 'eldimamaev@gmail.com',
        'from_name' => 'Smart Capital Partners',
    ],

    // === Telegram ===
    // 1) Создайте бота у @BotFather → получите token
    // 2) Напишите боту /start, затем узнайте chat_id у @userinfobot
    // 3) Заполните и поставьте 'enabled' => true
    'telegram' => [
        'enabled' => false,
        'token'   => '',             // ← токен бота от @BotFather
        'chat_id' => '',             // ← ваш chat_id от @userinfobot
    ],

    // === Админ-панель (/admin) ===
    'admin' => [
        'password' => 'change-me',   // ← пароль для входа в админку
    ],
];
