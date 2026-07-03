<?php

declare(strict_types=1);

/**
 * MFPro API — единая точка входа (front controller).
 * Запуск для разработки:
 *   php -S localhost:8000 -t public
 */

// API отдаёт JSON — предупреждения/уведомления не должны попадать в тело ответа.
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

use MFPro\Router;
use MFPro\Notifier;
use MFPro\Auth;
use MFPro\Content;
use MFPro\Store;
use MFPro\Crm;

require __DIR__ . '/../src/Router.php';
require __DIR__ . '/../src/Mailer.php';
require __DIR__ . '/../src/SmtpMailer.php';
require __DIR__ . '/../src/Telegram.php';
require __DIR__ . '/../src/Notifier.php';
require __DIR__ . '/../src/Auth.php';
require __DIR__ . '/../src/Content.php';
require __DIR__ . '/../src/Store.php';
require __DIR__ . '/../src/Crm.php';

// Загрузка конфигурации доставки (config.php не в git — см. config.example.php).
$config = file_exists(__DIR__ . '/../config.php')
    ? (array)require __DIR__ . '/../config.php'
    : [];
Notifier::configure($config);

// CORS для локальной разработки (Vite на 5173). В проде проксируется через Vite/Nginx.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$router = new Router();

$router->get('/api/health', static function (): array {
    return [
        'status'  => 'ok',
        'service' => 'mfpro-api',
        'time'    => date(DATE_ATOM),
    ];
});

// Приём заявок с лид-формы главной страницы.
$router->post('/api/lead', static function (): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        http_response_code(400);
        return ['error' => 'Invalid JSON body'];
    }

    $name  = trim((string)($data['name'] ?? ''));
    $phone = trim((string)($data['phone'] ?? ''));
    $topic = trim((string)($data['topic'] ?? ''));

    if ($name === '' || $phone === '') {
        http_response_code(422);
        return ['error' => 'Поля "name" и "phone" обязательны'];
    }

    $lead = [
        'name'      => $name,
        'phone'     => $phone,
        'topic'     => $topic,
        'createdAt' => date(DATE_ATOM),
        'ip'        => $_SERVER['REMOTE_ADDR'] ?? null,
    ];

    // Простое хранилище в JSON-файле (на старте). Позже — БД / CRM / Telegram.
    $file = __DIR__ . '/../storage/leads.json';
    $leads = json_decode((string)@file_get_contents($file), true);
    if (!is_array($leads)) {
        $leads = [];
    }
    $leads[] = $lead;
    @file_put_contents($file, json_encode($leads, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    $body = implode("\n", [
        'Новая заявка с сайта MF PRO',
        '===========================',
        "Имя:     {$name}",
        "Телефон: {$phone}",
        'Тема:    ' . ($topic !== '' ? $topic : '—'),
        '',
        'Дата: ' . date('d.m.Y H:i'),
    ]);
    $sent = Notifier::send('MF PRO — заявка: ' . $name, $body);

    return ['status' => 'ok', 'sent' => $sent, 'message' => 'Заявка принята'];
});

// Результаты экспресс-теста: отправка на почту + сохранение копии.
$router->post('/api/quiz', static function (): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        http_response_code(400);
        return ['error' => 'Invalid JSON body'];
    }

    $contact = is_array($data['contact'] ?? null) ? $data['contact'] : [];
    $name  = trim((string)($contact['name'] ?? ''));
    $phone = trim((string)($contact['phone'] ?? ''));
    $email = trim((string)($contact['email'] ?? ''));

    if ($name === '' || $phone === '') {
        http_response_code(422);
        return ['error' => 'Имя и телефон обязательны'];
    }

    $score    = (int)($data['score'] ?? 0);
    $maxScore = (int)($data['maxScore'] ?? 0);
    $level    = trim((string)($data['level'] ?? ''));
    $answers  = is_array($data['answers'] ?? null) ? $data['answers'] : [];

    $result = [
        'name'      => $name,
        'phone'     => $phone,
        'email'     => $email,
        'score'     => $score,
        'maxScore'  => $maxScore,
        'level'     => $level,
        'answers'   => $answers,
        'createdAt' => date(DATE_ATOM),
        'ip'        => $_SERVER['REMOTE_ADDR'] ?? null,
    ];

    // Сохраняем копию.
    $file = __DIR__ . '/../storage/quiz-results.json';
    $all = json_decode((string)@file_get_contents($file), true);
    if (!is_array($all)) {
        $all = [];
    }
    $all[] = $result;
    @file_put_contents($file, json_encode($all, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    // Формируем письмо.
    $lines = [
        'Новый результат экспресс-теста MF PRO',
        '======================================',
        "Имя:      {$name}",
        "Телефон:  {$phone}",
        "Email:    " . ($email !== '' ? $email : '—'),
        "Результат: {$score} из {$maxScore} — {$level}",
        '',
        'Ответы:',
    ];
    foreach ($answers as $i => $a) {
        $q = (string)($a['question'] ?? '');
        $ans = (string)($a['answer'] ?? '');
        $n = $i + 1;
        $lines[] = "{$n}. {$q}";
        $lines[] = "   → {$ans}";
    }
    $lines[] = '';
    $lines[] = 'Дата: ' . date('d.m.Y H:i');

    $sent = Notifier::send('MF PRO — заявка с теста: ' . $name, implode("\n", $lines));

    return [
        'status'  => 'ok',
        'sent'    => $sent,
        'message' => 'Результат сохранён',
    ];
});

// Заявка с конструктора «Бизнес под ключ».
$router->post('/api/turnkey', static function (): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        http_response_code(400);
        return ['error' => 'Invalid JSON body'];
    }

    $name     = trim((string)($data['name'] ?? ''));
    $phone    = trim((string)($data['phone'] ?? ''));
    $sphere   = trim((string)($data['sphere'] ?? ''));
    $budget   = trim((string)($data['budget'] ?? ''));
    $city     = trim((string)($data['city'] ?? ''));
    $services = is_array($data['services'] ?? null) ? $data['services'] : [];

    if ($name === '' || $phone === '') {
        http_response_code(422);
        return ['error' => 'Имя и телефон обязательны'];
    }

    $request = [
        'name'      => $name,
        'phone'     => $phone,
        'sphere'    => $sphere,
        'budget'    => $budget,
        'city'      => $city,
        'services'  => $services,
        'createdAt' => date(DATE_ATOM),
        'ip'        => $_SERVER['REMOTE_ADDR'] ?? null,
    ];

    $file = __DIR__ . '/../storage/turnkey-requests.json';
    $all = json_decode((string)@file_get_contents($file), true);
    if (!is_array($all)) {
        $all = [];
    }
    $all[] = $request;
    @file_put_contents($file, json_encode($all, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    $body = implode("\n", [
        'Новая заявка «Бизнес под ключ»',
        '==============================',
        "Имя:      {$name}",
        "Телефон:  {$phone}",
        "Сфера:    " . ($sphere !== '' ? $sphere : '—'),
        "Бюджет:   " . ($budget !== '' ? $budget : '—'),
        "Город:    " . ($city !== '' ? $city : '—'),
        "Услуги:   " . (count($services) ? implode(', ', $services) : '—'),
        '',
        'Дата: ' . date('d.m.Y H:i'),
    ]);
    $sent = Notifier::send('MF PRO — бизнес под ключ: ' . $name, $body);

    return ['status' => 'ok', 'sent' => $sent, 'message' => 'Заявка принята'];
});

// ===================== АДМИНКА =====================

// Вход: логин + пароль → токен сотрудника.
$router->post('/api/admin/login', function () use ($config): array {
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $login = is_array($data) ? (string)($data['login'] ?? '') : '';
    $password = is_array($data) ? (string)($data['password'] ?? '') : '';

    $user = Auth::login($config, $login, $password);
    if ($user === null) {
        http_response_code(401);
        return ['error' => 'Неверный логин или пароль'];
    }
    return [
        'token' => Auth::tokenFor($user['id'], $config),
        'user' => $user,
        'roleLabel' => Auth::ROLES[$user['role']] ?? $user['role'],
    ];
});

// Текущий пользователь.
$router->get('/api/crm/me', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null) {
        http_response_code(401);
        return ['error' => 'Требуется авторизация'];
    }
    return [
        'user' => $user,
        'roleLabel' => Auth::ROLES[$user['role']] ?? $user['role'],
        'isManager' => Crm::isManager($user['role']),
        'access' => Crm::submissionAccess($user['role']),
    ];
});

// Заявки — только разрешённые роли видят соответствующие типы.
$router->get('/api/admin/submissions', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null) {
        http_response_code(401);
        return ['error' => 'Требуется авторизация'];
    }
    $access = Crm::submissionAccess($user['role']);
    $map = ['leads' => 'leads.json', 'quiz' => 'quiz-results.json', 'turnkey' => 'turnkey-requests.json'];

    $out = ['counts' => [], 'leads' => [], 'quiz' => [], 'turnkey' => [], 'access' => $access];
    foreach ($map as $key => $file) {
        if (in_array($key, $access, true)) {
            $items = array_reverse(Store::read($file));
            $out[$key] = $items;
            $out['counts'][$key] = count($items);
        }
    }
    return $out;
});

// ===================== КОНТЕНТ (карточки) =====================

// Публичный список карточек: /api/content?type=models|franchises|investments|ready
$router->get('/api/content', static function (): array {
    $type = (string)($_GET['type'] ?? '');
    if (!Content::isValidType($type)) {
        http_response_code(400);
        return ['error' => 'Неизвестный тип контента'];
    }
    return ['items' => Content::all($type)];
});

// Создание/обновление карточки (под токеном).
$router->post('/api/admin/content/save', function () use ($config): array {
    if (!Auth::hasRole($config, ['director', 'manager', 'marketer'])) {
        http_response_code(403);
        return ['error' => 'Недостаточно прав'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $type = is_array($data) ? (string)($data['type'] ?? '') : '';
    $item = is_array($data['item'] ?? null) ? $data['item'] : null;

    if (!Content::isValidType($type) || $item === null) {
        http_response_code(400);
        return ['error' => 'Нужны type и item'];
    }
    if (trim((string)($item['title'] ?? $item['brand'] ?? '')) === '') {
        http_response_code(422);
        return ['error' => 'Название обязательно'];
    }
    return ['item' => Content::save($type, $item)];
});

// Удаление карточки (под токеном).
$router->post('/api/admin/content/delete', function () use ($config): array {
    if (!Auth::hasRole($config, ['director', 'manager', 'marketer'])) {
        http_response_code(403);
        return ['error' => 'Недостаточно прав'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $type = is_array($data) ? (string)($data['type'] ?? '') : '';
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';

    if (!Content::isValidType($type) || $id === '') {
        http_response_code(400);
        return ['error' => 'Нужны type и id'];
    }
    Content::delete($type, $id);
    return ['status' => 'ok'];
});

// ===================== CRM: ЗАДАЧИ =====================

// Список задач (видимые пользователю) + справочники.
$router->get('/api/crm/tasks', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null) {
        http_response_code(401);
        return ['error' => 'Требуется авторизация'];
    }
    $tasks = Crm::visibleTasks(Store::read('tasks.json'), $user);
    // новые сверху
    usort($tasks, static fn ($a, $b) => strcmp((string)($b['createdAt'] ?? ''), (string)($a['createdAt'] ?? '')));
    return [
        'tasks' => $tasks,
        'statuses' => Crm::STATUSES,
        'roles' => Auth::ROLES,
        'me' => $user,
        'isManager' => Crm::isManager($user['role']),
    ];
});

// Создание/редактирование задачи (управляющий/директор).
$router->post('/api/crm/tasks/save', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::isManager($user['role'])) {
        http_response_code(403);
        return ['error' => 'Ставить задачи может управляющий или директор'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $item = is_array($data['item'] ?? null) ? $data['item'] : null;
    if ($item === null || trim((string)($item['title'] ?? '')) === '') {
        http_response_code(422);
        return ['error' => 'Укажите название задачи'];
    }

    $tasks = Store::read('tasks.json');
    $id = (string)($item['id'] ?? '');
    $now = date(DATE_ATOM);

    if ($id !== '') {
        $found = false;
        foreach ($tasks as $i => $t) {
            if ((string)($t['id'] ?? '') === $id) {
                $tasks[$i] = array_merge($t, [
                    'title' => trim((string)$item['title']),
                    'description' => trim((string)($item['description'] ?? '')),
                    'assignee' => (string)($item['assignee'] ?? ($t['assignee'] ?? '')),
                    'dueDate' => (string)($item['dueDate'] ?? ($t['dueDate'] ?? '')),
                    'priority' => (string)($item['priority'] ?? ($t['priority'] ?? 'normal')),
                    'updatedAt' => $now,
                ]);
                $found = true;
                $saved = $tasks[$i];
                break;
            }
        }
        if (!$found) {
            http_response_code(404);
            return ['error' => 'Задача не найдена'];
        }
    } else {
        $saved = [
            'id' => Store::id('task_'),
            'title' => trim((string)$item['title']),
            'description' => trim((string)($item['description'] ?? '')),
            'assignee' => (string)($item['assignee'] ?? ''),
            'dueDate' => (string)($item['dueDate'] ?? ''),
            'priority' => (string)($item['priority'] ?? 'normal'),
            'status' => 'new',
            'result' => ['text' => '', 'link' => ''],
            'rejectionReason' => '',
            'attachments' => [],
            'createdBy' => $user['id'],
            'createdByName' => $user['name'],
            'createdByRole' => $user['role'],
            'createdAt' => $now,
            'updatedAt' => $now,
            'history' => [[
                'at' => $now, 'by' => $user['name'], 'byRole' => $user['role'],
                'action' => 'create', 'note' => 'Задача создана',
            ]],
        ];
        array_unshift($tasks, $saved);
    }
    Store::write('tasks.json', $tasks);
    return ['task' => $saved];
});

// Переход статуса задачи (взять/сдать/принять/отклонить).
$router->post('/api/crm/tasks/transition', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null) {
        http_response_code(401);
        return ['error' => 'Требуется авторизация'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    $action = is_array($data) ? (string)($data['action'] ?? '') : '';
    $payload = is_array($data['payload'] ?? null) ? $data['payload'] : [];

    $tasks = Store::read('tasks.json');
    foreach ($tasks as $i => $t) {
        if ((string)($t['id'] ?? '') === $id) {
            [$updated, $err] = Crm::transition($t, $action, $user, $payload);
            if ($err !== null) {
                http_response_code(422);
                return ['error' => $err];
            }
            $tasks[$i] = $updated;
            Store::write('tasks.json', $tasks);
            return ['task' => $updated];
        }
    }
    http_response_code(404);
    return ['error' => 'Задача не найдена'];
});

// Удаление задачи (управляющий/директор).
$router->post('/api/crm/tasks/delete', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::isManager($user['role'])) {
        http_response_code(403);
        return ['error' => 'Недостаточно прав'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    $tasks = array_values(array_filter(
        Store::read('tasks.json'),
        static fn ($t) => (string)($t['id'] ?? '') !== $id
    ));
    Store::write('tasks.json', $tasks);
    return ['status' => 'ok'];
});

// Загрузка файла (Excel/Word/PDF/изображения) → ссылка.
$router->post('/api/crm/upload', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null) {
        http_response_code(401);
        return ['error' => 'Требуется авторизация'];
    }
    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        http_response_code(400);
        return ['error' => 'Файл не получен'];
    }
    $file = $_FILES['file'];
    $allowed = ['xlsx', 'xls', 'csv', 'docx', 'doc', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt'];
    $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) {
        http_response_code(422);
        return ['error' => 'Недопустимый тип файла'];
    }
    if ((int)$file['size'] > 15 * 1024 * 1024) {
        http_response_code(422);
        return ['error' => 'Файл больше 15 МБ'];
    }
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $safe = preg_replace('/[^\p{L}\p{N}\.\-_]+/u', '_', (string)$file['name']);
    $name = Store::id('f_') . '_' . $safe;
    if (!@move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
        http_response_code(500);
        return ['error' => 'Не удалось сохранить файл'];
    }
    return ['attachment' => [
        'name' => (string)$file['name'],
        'url' => '/uploads/' . $name,
        'size' => (int)$file['size'],
    ]];
});

// ===================== CRM: ИДЕИ =====================

$router->get('/api/crm/ideas', function () use ($config): array {
    if (!Auth::check($config)) {
        http_response_code(401);
        return ['error' => 'Требуется авторизация'];
    }
    $ideas = Store::read('ideas.json');
    usort($ideas, static fn ($a, $b) => strcmp((string)($b['createdAt'] ?? ''), (string)($a['createdAt'] ?? '')));
    return ['ideas' => $ideas];
});

$router->post('/api/crm/ideas', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null) {
        http_response_code(401);
        return ['error' => 'Требуется авторизация'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $text = is_array($data) ? trim((string)($data['text'] ?? '')) : '';
    if ($text === '') {
        http_response_code(422);
        return ['error' => 'Пустая идея'];
    }
    $ideas = Store::read('ideas.json');
    $idea = [
        'id' => Store::id('idea_'),
        'text' => $text,
        'author' => $user['name'],
        'authorRole' => $user['role'],
        'createdAt' => date(DATE_ATOM),
    ];
    array_unshift($ideas, $idea);
    Store::write('ideas.json', $ideas);
    return ['idea' => $idea];
});

// Удаление идеи (автор или руководитель).
$router->post('/api/crm/ideas/delete', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null) {
        http_response_code(401);
        return ['error' => 'Требуется авторизация'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    $ideas = Store::read('ideas.json');
    $target = null;
    foreach ($ideas as $it) {
        if ((string)($it['id'] ?? '') === $id) {
            $target = $it;
            break;
        }
    }
    if ($target === null) {
        http_response_code(404);
        return ['error' => 'Идея не найдена'];
    }
    if (($target['author'] ?? '') !== $user['name'] && !Crm::isManager($user['role'])) {
        http_response_code(403);
        return ['error' => 'Можно удалять только свои идеи'];
    }
    $ideas = array_values(array_filter($ideas, static fn ($it) => (string)($it['id'] ?? '') !== $id));
    Store::write('ideas.json', $ideas);
    return ['status' => 'ok'];
});

// ===================== CRM: КОНТЕНТ-КАЛЕНДАРЬ =====================

// Аккаунты (соцсети/клиенты).
$router->get('/api/crm/accounts', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canCalendar($user['role'])) {
        http_response_code(403);
        return ['error' => 'Недостаточно прав'];
    }
    return ['accounts' => Store::read('accounts.json')];
});

$router->post('/api/crm/accounts/save', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !in_array($user['role'], ['director', 'manager', 'marketer'], true)) {
        http_response_code(403);
        return ['error' => 'Добавлять аккаунты может управляющий/маркетолог'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $item = is_array($data['item'] ?? null) ? $data['item'] : null;
    if ($item === null || trim((string)($item['name'] ?? '')) === '') {
        http_response_code(422);
        return ['error' => 'Укажите название аккаунта'];
    }
    $accounts = Store::read('accounts.json');
    $id = (string)($item['id'] ?? '');
    $saved = [
        'id' => $id !== '' ? $id : Store::id('acc_'),
        'name' => trim((string)$item['name']),
        'platform' => trim((string)($item['platform'] ?? '')),
    ];
    if ($id !== '') {
        $found = false;
        foreach ($accounts as $i => $a) {
            if ((string)($a['id'] ?? '') === $id) {
                $accounts[$i] = $saved;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $accounts[] = $saved;
        }
    } else {
        $accounts[] = $saved;
    }
    Store::write('accounts.json', $accounts);
    return ['account' => $saved];
});

$router->post('/api/crm/accounts/delete', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::isManager($user['role'])) {
        http_response_code(403);
        return ['error' => 'Удалять аккаунты может управляющий/директор'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    Store::write('accounts.json', array_values(array_filter(
        Store::read('accounts.json'),
        static fn ($a) => (string)($a['id'] ?? '') !== $id
    )));
    // вместе с аккаунтом убираем его посты
    Store::write('calendar.json', array_values(array_filter(
        Store::read('calendar.json'),
        static fn ($p) => (string)($p['accountId'] ?? '') !== $id
    )));
    return ['status' => 'ok'];
});

// Посты календаря.
$router->get('/api/crm/calendar', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canCalendar($user['role'])) {
        http_response_code(403);
        return ['error' => 'Недостаточно прав'];
    }
    $accountId = (string)($_GET['accountId'] ?? '');
    $posts = Store::read('calendar.json');
    if ($accountId !== '') {
        $posts = array_values(array_filter($posts, static fn ($p) => (string)($p['accountId'] ?? '') === $accountId));
    }
    return ['posts' => $posts];
});

$router->post('/api/crm/calendar/save', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canCalendar($user['role'])) {
        http_response_code(403);
        return ['error' => 'Недостаточно прав'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $item = is_array($data['item'] ?? null) ? $data['item'] : null;
    if ($item === null || trim((string)($item['title'] ?? '')) === '' || trim((string)($item['date'] ?? '')) === '') {
        http_response_code(422);
        return ['error' => 'Нужны дата и название поста'];
    }
    $posts = Store::read('calendar.json');
    $id = (string)($item['id'] ?? '');
    $now = date(DATE_ATOM);
    $base = [
        'accountId' => (string)($item['accountId'] ?? ''),
        'date' => (string)$item['date'],
        'type' => (string)($item['type'] ?? 'post'),
        'title' => trim((string)$item['title']),
        'note' => trim((string)($item['note'] ?? '')),
        'status' => (string)($item['status'] ?? 'idea'),
        'link' => trim((string)($item['link'] ?? '')),
    ];
    if ($id !== '') {
        $found = false;
        foreach ($posts as $i => $p) {
            if ((string)($p['id'] ?? '') === $id) {
                $posts[$i] = array_merge($p, $base, ['updatedAt' => $now]);
                $saved = $posts[$i];
                $found = true;
                break;
            }
        }
        if (!$found) {
            http_response_code(404);
            return ['error' => 'Пост не найден'];
        }
    } else {
        $saved = array_merge($base, [
            'id' => Store::id('post_'),
            'createdBy' => $user['name'],
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);
        $posts[] = $saved;
    }
    Store::write('calendar.json', $posts);
    return ['post' => $saved];
});

$router->post('/api/crm/calendar/delete', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canCalendar($user['role'])) {
        http_response_code(403);
        return ['error' => 'Недостаточно прав'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    Store::write('calendar.json', array_values(array_filter(
        Store::read('calendar.json'),
        static fn ($p) => (string)($p['id'] ?? '') !== $id
    )));
    return ['status' => 'ok'];
});

// ===================== CRM: SMM-ДАШБОРД =====================

function mfpro_smm_default_settings(): array
{
    return [
        'tools' => [
            'autopost'  => ['url' => 'https://smmplanner.com', 'status' => 'Ближайший пост: не запланирован'],
            'design'    => ['url' => 'https://www.canva.com'],
            'analytics' => ['url' => 'https://popsters.ru'],
        ],
        'kpi' => [
            'reach'     => ['current' => 0, 'target' => 100000],
            'followers' => ['current' => 0, 'target' => 1000],
            'er'        => ['current' => 0, 'target' => 5],
        ],
    ];
}

// Доска SMM: задачи текущего пользователя + настройки (инструменты, KPI).
$router->get('/api/crm/smm/board', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canSmm($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа к SMM-дашборду'];
    }
    $all = Store::read('smm-tasks.json');
    // менеджеры видят все, иначе — свои
    $tasks = Crm::isManager($user['role'])
        ? $all
        : array_values(array_filter($all, static fn ($t) => (string)($t['createdBy'] ?? '') === $user['id']));

    $settings = json_decode((string)@file_get_contents(__DIR__ . '/../storage/smm-settings.json'), true);
    if (!is_array($settings) || empty($settings)) {
        $settings = mfpro_smm_default_settings();
    }
    return ['tasks' => $tasks, 'settings' => $settings];
});

$router->post('/api/crm/smm/tasks/save', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canSmm($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $item = is_array($data['item'] ?? null) ? $data['item'] : null;
    if ($item === null || trim((string)($item['title'] ?? '')) === '') {
        http_response_code(422);
        return ['error' => 'Укажите задачу'];
    }
    $periods = ['daily', 'weekly', 'monthly'];
    $period = in_array($item['period'] ?? '', $periods, true) ? $item['period'] : 'daily';

    $tasks = Store::read('smm-tasks.json');
    $id = (string)($item['id'] ?? '');
    $fields = [
        'title' => trim((string)$item['title']),
        'period' => $period,
        'category' => (string)($item['category'] ?? 'Контент'),
        'priority' => (string)($item['priority'] ?? 'medium'),
        'dueDate' => (string)($item['dueDate'] ?? ''),
    ];
    if ($id !== '') {
        $found = false;
        foreach ($tasks as $i => $t) {
            if ((string)($t['id'] ?? '') === $id) {
                $tasks[$i] = array_merge($t, $fields);
                $saved = $tasks[$i];
                $found = true;
                break;
            }
        }
        if (!$found) {
            http_response_code(404);
            return ['error' => 'Задача не найдена'];
        }
    } else {
        $saved = array_merge($fields, [
            'id' => Store::id('smm_'),
            'isCompleted' => false,
            'createdBy' => $user['id'],
            'createdAt' => date(DATE_ATOM),
        ]);
        array_unshift($tasks, $saved);
    }
    Store::write('smm-tasks.json', $tasks);
    return ['task' => $saved];
});

$router->post('/api/crm/smm/tasks/toggle', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canSmm($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    $tasks = Store::read('smm-tasks.json');
    foreach ($tasks as $i => $t) {
        if ((string)($t['id'] ?? '') === $id) {
            $tasks[$i]['isCompleted'] = !($t['isCompleted'] ?? false);
            Store::write('smm-tasks.json', $tasks);
            return ['task' => $tasks[$i]];
        }
    }
    http_response_code(404);
    return ['error' => 'Задача не найдена'];
});

$router->post('/api/crm/smm/tasks/delete', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canSmm($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    Store::write('smm-tasks.json', array_values(array_filter(
        Store::read('smm-tasks.json'),
        static fn ($t) => (string)($t['id'] ?? '') !== $id
    )));
    return ['status' => 'ok'];
});

$router->post('/api/crm/smm/settings', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canSmm($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $settings = is_array($data['settings'] ?? null) ? $data['settings'] : null;
    if ($settings === null) {
        http_response_code(422);
        return ['error' => 'Нет настроек'];
    }
    @file_put_contents(
        __DIR__ . '/../storage/smm-settings.json',
        json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
    );
    return ['settings' => $settings];
});

// ===================== CRM: БУХГАЛТЕРИЯ =====================

function mfpro_acc_default_settings(): array
{
    return [
        'ecpValidUntil' => '',
        'links' => [
            'sti'  => ['name' => 'Кабинет налогоплательщика', 'url' => 'https://cabinet.sti.gov.kg'],
            'esf'  => ['name' => 'ИС ЭСФ (электронные счета-фактуры)', 'url' => 'https://esf.salyk.kg'],
            'ettn' => ['name' => 'ЭТТН (товаро-транспортные)', 'url' => 'https://ettn.salyk.kg'],
            'bank' => ['name' => 'Банк-клиент', 'url' => ''],
        ],
    ];
}

$router->get('/api/crm/acc/board', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа к бухгалтерскому дашборду'];
    }
    $settings = json_decode((string)@file_get_contents(__DIR__ . '/../storage/acc-settings.json'), true);
    if (!is_array($settings) || empty($settings)) {
        $settings = mfpro_acc_default_settings();
    }
    return [
        'tasks' => Store::read('acc-tasks.json'),
        'docs' => Store::read('acc-docs.json'),
        'settings' => $settings,
    ];
});

$router->post('/api/crm/acc/tasks/save', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $item = is_array($data['item'] ?? null) ? $data['item'] : null;
    if ($item === null || trim((string)($item['title'] ?? '')) === '') {
        http_response_code(422);
        return ['error' => 'Укажите название'];
    }
    $periods = ['daily', 'monthly', 'quarterly', 'yearly'];
    $statuses = ['not_started', 'in_progress', 'formed', 'submitted'];
    $fields = [
        'title' => trim((string)$item['title']),
        'period' => in_array($item['period'] ?? '', $periods, true) ? $item['period'] : 'monthly',
        'reportingPeriod' => (string)($item['reportingPeriod'] ?? ''),
        'deadline' => (string)($item['deadline'] ?? ''),
        'status' => in_array($item['status'] ?? '', $statuses, true) ? $item['status'] : 'not_started',
    ];
    $tasks = Store::read('acc-tasks.json');
    $id = (string)($item['id'] ?? '');
    if ($id !== '') {
        $found = false;
        foreach ($tasks as $i => $t) {
            if ((string)($t['id'] ?? '') === $id) {
                $tasks[$i] = array_merge($t, $fields);
                $saved = $tasks[$i];
                $found = true;
                break;
            }
        }
        if (!$found) {
            http_response_code(404);
            return ['error' => 'Задача не найдена'];
        }
    } else {
        $saved = array_merge($fields, [
            'id' => Store::id('acc_'),
            'receiptFile' => '',
            'createdBy' => $user['name'],
            'createdAt' => date(DATE_ATOM),
        ]);
        array_unshift($tasks, $saved);
    }
    Store::write('acc-tasks.json', $tasks);
    return ['task' => $saved];
});

$router->post('/api/crm/acc/tasks/status', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    $status = is_array($data) ? (string)($data['status'] ?? '') : '';
    if (!in_array($status, ['not_started', 'in_progress', 'formed', 'submitted'], true)) {
        http_response_code(422);
        return ['error' => 'Неверный статус'];
    }
    $tasks = Store::read('acc-tasks.json');
    foreach ($tasks as $i => $t) {
        if ((string)($t['id'] ?? '') === $id) {
            $tasks[$i]['status'] = $status;
            Store::write('acc-tasks.json', $tasks);
            return ['task' => $tasks[$i]];
        }
    }
    http_response_code(404);
    return ['error' => 'Задача не найдена'];
});

// Прикрепить квиток (PDF) → статус «Сдано».
$router->post('/api/crm/acc/tasks/receipt', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $id = (string)($_POST['id'] ?? '');
    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        http_response_code(400);
        return ['error' => 'Файл не получен'];
    }
    $ext = strtolower(pathinfo((string)$_FILES['file']['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['pdf', 'png', 'jpg', 'jpeg'], true)) {
        http_response_code(422);
        return ['error' => 'Квиток — PDF или изображение'];
    }
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $safe = preg_replace('/[^\p{L}\p{N}\.\-_]+/u', '_', (string)$_FILES['file']['name']);
    $name = Store::id('kvit_') . '_' . $safe;
    if (!@move_uploaded_file($_FILES['file']['tmp_name'], $dir . '/' . $name)) {
        http_response_code(500);
        return ['error' => 'Не удалось сохранить файл'];
    }
    $url = '/uploads/' . $name;
    $tasks = Store::read('acc-tasks.json');
    foreach ($tasks as $i => $t) {
        if ((string)($t['id'] ?? '') === $id) {
            $tasks[$i]['receiptFile'] = $url;
            $tasks[$i]['status'] = 'submitted';
            Store::write('acc-tasks.json', $tasks);
            return ['task' => $tasks[$i]];
        }
    }
    return ['url' => $url];
});

$router->post('/api/crm/acc/tasks/delete', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    Store::write('acc-tasks.json', array_values(array_filter(
        Store::read('acc-tasks.json'),
        static fn ($t) => (string)($t['id'] ?? '') !== $id
    )));
    return ['status' => 'ok'];
});

// Первичная документация
$router->post('/api/crm/acc/docs/save', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $item = is_array($data['item'] ?? null) ? $data['item'] : null;
    if ($item === null || trim((string)($item['counterparty'] ?? '')) === '') {
        http_response_code(422);
        return ['error' => 'Укажите контрагента'];
    }
    $docs = Store::read('acc-docs.json');
    $id = (string)($item['id'] ?? '');
    $fields = [
        'counterparty' => trim((string)$item['counterparty']),
        'type' => (string)($item['type'] ?? 'Акт сверки'),
        'status' => (string)($item['status'] ?? 'requested'),
    ];
    if ($id !== '') {
        foreach ($docs as $i => $d) {
            if ((string)($d['id'] ?? '') === $id) {
                $docs[$i] = array_merge($d, $fields);
                $saved = $docs[$i];
                break;
            }
        }
    }
    if (!isset($saved)) {
        $saved = array_merge($fields, ['id' => Store::id('doc_')]);
        $docs[] = $saved;
    }
    Store::write('acc-docs.json', $docs);
    return ['doc' => $saved];
});

$router->post('/api/crm/acc/docs/delete', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    Store::write('acc-docs.json', array_values(array_filter(
        Store::read('acc-docs.json'),
        static fn ($d) => (string)($d['id'] ?? '') !== $id
    )));
    return ['status' => 'ok'];
});

$router->post('/api/crm/acc/settings', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $settings = is_array($data['settings'] ?? null) ? $data['settings'] : null;
    if ($settings === null) {
        http_response_code(422);
        return ['error' => 'Нет настроек'];
    }
    @file_put_contents(
        __DIR__ . '/../storage/acc-settings.json',
        json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
    );
    return ['settings' => $settings];
});

/**
 * Стандартные бухгалтерские отчёты КР.
 * day — число месяца сдачи; quarterMonths — в какие месяцы (1-based) сдаётся квартальный.
 */
function mfpro_acc_templates(): array
{
    return [
        // Ежемесячные
        ['title' => 'Подоходный налог + соцотчисления (наёмные сотрудники)', 'day' => 20, 'period' => 'monthly'],
        ['title' => 'НДС (налог на добавленную стоимость)', 'day' => 25, 'period' => 'monthly'],
        ['title' => 'Налог с продаж', 'day' => 25, 'period' => 'monthly'],
        // Квартальные (сдаются в месяц после квартала: апр/июль/окт/янв)
        ['title' => 'Квартальный отчёт (налог на прибыль, аванс)', 'day' => 20, 'period' => 'quarterly', 'quarterMonths' => [4, 7, 10, 1]],
        // Годовой (единый налоговый отчёт за прошлый год — март)
        ['title' => 'Годовая единая налоговая декларация (ЕНД)', 'day' => 1, 'period' => 'yearly', 'yearMonths' => [3]],
    ];
}

// Авто-генерация задач на месяц (идемпотентно). month = 'YYYY-MM' (по умолчанию текущий).
$router->post('/api/crm/acc/generate', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canAccounting($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $month = is_array($data) ? (string)($data['month'] ?? '') : '';
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        $month = date('Y-m');
    }
    [$y, $m] = array_map('intval', explode('-', $month));
    // отчётный период = предыдущий месяц (отчёт сдаётся за прошлый месяц)
    $prevTs = mktime(0, 0, 0, $m - 1, 1, $y);
    $reportingMonth = date('Y-m', $prevTs);

    $tasks = Store::read('acc-tasks.json');
    $exists = static function (array $tasks, string $title, string $deadline): bool {
        foreach ($tasks as $t) {
            if ((string)($t['title'] ?? '') === $title && (string)($t['deadline'] ?? '') === $deadline) {
                return true;
            }
        }
        return false;
    };

    $created = [];
    foreach (mfpro_acc_templates() as $tpl) {
        // фильтр по кварталу/году
        if (($tpl['period'] ?? '') === 'quarterly' && !in_array($m, $tpl['quarterMonths'] ?? [], true)) {
            continue;
        }
        if (($tpl['period'] ?? '') === 'yearly' && !in_array($m, $tpl['yearMonths'] ?? [], true)) {
            continue;
        }
        $deadline = sprintf('%04d-%02d-%02d', $y, $m, (int)$tpl['day']);
        if ($exists($tasks, $tpl['title'], $deadline)) {
            continue;
        }
        $task = [
            'id' => Store::id('acc_'),
            'title' => $tpl['title'],
            'period' => $tpl['period'],
            'reportingPeriod' => $reportingMonth,
            'deadline' => $deadline,
            'status' => 'not_started',
            'receiptFile' => '',
            'createdBy' => 'Авто',
            'createdAt' => date(DATE_ATOM),
        ];
        array_unshift($tasks, $task);
        $created[] = $task;
    }
    Store::write('acc-tasks.json', $tasks);
    return ['created' => count($created), 'tasks' => $created, 'month' => $month];
});

// ===================== CRM: МАРКЕТИНГ =====================

function mfpro_mkt_default_settings(): array
{
    return [
        'links' => [
            'ads'       => ['name' => 'Google Ads', 'url' => ''],
            'meta'      => ['name' => 'Meta Ads (Facebook/Instagram)', 'url' => ''],
            'analytics' => ['name' => 'Аналитика (GA / Яндекс.Метрика)', 'url' => ''],
            'twogis'    => ['name' => '2GIS / Instagram', 'url' => ''],
        ],
        'funnel' => ['qualified' => 0, 'consultation' => 0, 'contract' => 0, 'client' => 0],
        'budgetPlan' => 0,
    ];
}

$router->get('/api/crm/mkt/board', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canMarketing($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа к маркетинговому дашборду'];
    }
    $month = date('Y-m');
    $countMonth = static function (string $file) use ($month): int {
        $n = 0;
        foreach (Store::read($file) as $r) {
            if (str_starts_with((string)($r['createdAt'] ?? ''), $month)) {
                $n++;
            }
        }
        return $n;
    };
    $byType = [
        'leads' => $countMonth('leads.json'),
        'quiz' => $countMonth('quiz-results.json'),
        'turnkey' => $countMonth('turnkey-requests.json'),
    ];
    $byTypeTotal = [
        'leads' => count(Store::read('leads.json')),
        'quiz' => count(Store::read('quiz-results.json')),
        'turnkey' => count(Store::read('turnkey-requests.json')),
    ];

    $settings = json_decode((string)@file_get_contents(__DIR__ . '/../storage/mkt-settings.json'), true);
    if (!is_array($settings) || empty($settings)) {
        $settings = mfpro_mkt_default_settings();
    }
    return [
        'month' => $month,
        'submissionsMonth' => array_sum($byType),
        'submissionsTotal' => array_sum($byTypeTotal),
        'byType' => $byType,
        'byTypeTotal' => $byTypeTotal,
        'campaigns' => Store::read('mkt-campaigns.json'),
        'settings' => $settings,
    ];
});

$router->post('/api/crm/mkt/campaigns/save', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canMarketing($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $item = is_array($data['item'] ?? null) ? $data['item'] : null;
    if ($item === null || trim((string)($item['name'] ?? '')) === '') {
        http_response_code(422);
        return ['error' => 'Укажите название кампании'];
    }
    $statuses = ['active', 'paused', 'done'];
    $fields = [
        'name' => trim((string)$item['name']),
        'channel' => (string)($item['channel'] ?? 'Instagram'),
        'status' => in_array($item['status'] ?? '', $statuses, true) ? $item['status'] : 'active',
        'budget' => (float)($item['budget'] ?? 0),
        'spent' => (float)($item['spent'] ?? 0),
        'leads' => (int)($item['leads'] ?? 0),
    ];
    $campaigns = Store::read('mkt-campaigns.json');
    $id = (string)($item['id'] ?? '');
    if ($id !== '') {
        foreach ($campaigns as $i => $c) {
            if ((string)($c['id'] ?? '') === $id) {
                $campaigns[$i] = array_merge($c, $fields);
                $saved = $campaigns[$i];
                break;
            }
        }
    }
    if (!isset($saved)) {
        $saved = array_merge($fields, ['id' => Store::id('camp_'), 'createdAt' => date(DATE_ATOM)]);
        array_unshift($campaigns, $saved);
    }
    Store::write('mkt-campaigns.json', $campaigns);
    return ['campaign' => $saved];
});

$router->post('/api/crm/mkt/campaigns/delete', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canMarketing($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $id = is_array($data) ? (string)($data['id'] ?? '') : '';
    Store::write('mkt-campaigns.json', array_values(array_filter(
        Store::read('mkt-campaigns.json'),
        static fn ($c) => (string)($c['id'] ?? '') !== $id
    )));
    return ['status' => 'ok'];
});

$router->post('/api/crm/mkt/settings', function () use ($config): array {
    $user = Auth::user($config);
    if ($user === null || !Crm::canMarketing($user['role'])) {
        http_response_code(403);
        return ['error' => 'Нет доступа'];
    }
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $settings = is_array($data['settings'] ?? null) ? $data['settings'] : null;
    if ($settings === null) {
        http_response_code(422);
        return ['error' => 'Нет настроек'];
    }
    @file_put_contents(
        __DIR__ . '/../storage/mkt-settings.json',
        json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
    );
    return ['settings' => $settings];
});

// ===================== CRM: СОТРУДНИКИ =====================

$router->get('/api/crm/users', function () use ($config): array {
    if (!Auth::hasRole($config, ['director', 'manager'])) {
        http_response_code(403);
        return ['error' => 'Недостаточно прав'];
    }
    $users = array_map(static fn ($u) => [
        'login' => $u['login'] ?? '',
        'name' => $u['name'] ?? '',
        'role' => $u['role'] ?? '',
        'roleLabel' => Auth::ROLES[$u['role'] ?? ''] ?? ($u['role'] ?? ''),
    ], is_array($config['users'] ?? null) ? $config['users'] : []);
    return ['users' => $users];
});

$router->dispatch(
    $_SERVER['REQUEST_METHOD'],
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/'
);
