<?php

declare(strict_types=1);

namespace MFPro;

/**
 * Бизнес-логика CRM: задачи, воркфлоу, ролевой доступ.
 */
final class Crm
{
    public const STATUSES = [
        'new'         => 'Новая',
        'in_progress' => 'В работе',
        'review'      => 'На проверке',
        'done'        => 'Выполнена',
        'rejected'    => 'Отклонена',
    ];

    /** Кто управляет задачами (создание, проверка, отклонение). */
    public static function isManager(string $role): bool
    {
        return in_array($role, ['director', 'manager'], true);
    }

    /** Кто работает с контент-календарём. */
    public static function canCalendar(string $role): bool
    {
        return in_array($role, ['director', 'manager', 'marketer', 'smm'], true);
    }

    /** У кого есть SMM-дашборд. */
    public static function canSmm(string $role): bool
    {
        return in_array($role, ['director', 'manager', 'smm'], true);
    }

    /** У кого есть бухгалтерский дашборд. */
    public static function canAccounting(string $role): bool
    {
        return in_array($role, ['director', 'manager', 'accountant', 'finance'], true);
    }

    /** У кого есть маркетинговый дашборд. */
    public static function canMarketing(string $role): bool
    {
        return in_array($role, ['director', 'manager', 'marketer'], true);
    }

    /** Кто видит какие заявки (по ролям). */
    public static function submissionAccess(string $role): array
    {
        $all = ['leads', 'quiz', 'turnkey'];
        return match ($role) {
            'director', 'manager' => $all,
            'marketer' => ['leads', 'quiz', 'turnkey'],
            'finance' => ['quiz'],
            default => [], // smm, accountant — нет доступа к заявкам
        };
    }

    /**
     * Задачи, видимые пользователю.
     * Менеджеры — все; остальные — где они исполнитель (по роли) или автор.
     * @param array<int,array<string,mixed>> $tasks
     * @param array{id:string,role:string} $user
     * @return array<int,array<string,mixed>>
     */
    public static function visibleTasks(array $tasks, array $user): array
    {
        if (self::isManager($user['role'])) {
            return $tasks;
        }
        return array_values(array_filter($tasks, static function (array $t) use ($user): bool {
            return ($t['assignee'] ?? '') === $user['role']
                || ($t['createdBy'] ?? '') === $user['id'];
        }));
    }

    /**
     * Применяет переход статуса. Возвращает [updatedTask|null, error|null].
     * @param array<string,mixed> $task
     * @param array{id:string,name:string,role:string} $user
     * @param array<string,mixed> $payload
     * @return array{0: ?array<string,mixed>, 1: ?string}
     */
    public static function transition(array $task, string $action, array $user, array $payload): array
    {
        $status = (string)($task['status'] ?? 'new');
        $isAssignee = ($task['assignee'] ?? '') === $user['role'];
        $isManager = self::isManager($user['role']);
        $note = '';

        switch ($action) {
            case 'start': // взять в работу
                if (!in_array($status, ['new', 'rejected'], true)) {
                    return [null, 'Нельзя взять в работу из текущего статуса'];
                }
                if (!$isAssignee && !$isManager) {
                    return [null, 'Только исполнитель может взять задачу'];
                }
                $task['status'] = 'in_progress';
                $note = 'Взято в работу';
                break;

            case 'submit': // сдать на проверку с результатом
                if ($status !== 'in_progress') {
                    return [null, 'Сдать можно только задачу в работе'];
                }
                if (!$isAssignee && !$isManager) {
                    return [null, 'Только исполнитель может сдать задачу'];
                }
                $task['result'] = [
                    'text' => trim((string)($payload['resultText'] ?? '')),
                    'link' => trim((string)($payload['resultLink'] ?? '')),
                ];
                if (is_array($payload['attachments'] ?? null)) {
                    $task['attachments'] = array_merge($task['attachments'] ?? [], $payload['attachments']);
                }
                $task['status'] = 'review';
                $note = 'Сдано на проверку'
                    . ($task['result']['link'] !== '' ? ' · ссылка: ' . $task['result']['link'] : '');
                break;

            case 'approve': // принять
                if ($status !== 'review') {
                    return [null, 'Принять можно только задачу на проверке'];
                }
                if (!$isManager) {
                    return [null, 'Принимать может только управляющий/директор'];
                }
                $task['status'] = 'done';
                $note = 'Задача принята';
                break;

            case 'reject': // отклонить с причиной
                if ($status !== 'review') {
                    return [null, 'Отклонить можно только задачу на проверке'];
                }
                if (!$isManager) {
                    return [null, 'Отклонять может только управляющий/директор'];
                }
                $reason = trim((string)($payload['reason'] ?? ''));
                if ($reason === '') {
                    return [null, 'Укажите причину отклонения'];
                }
                $task['status'] = 'rejected';
                $task['rejectionReason'] = $reason;
                $note = 'Отклонено: ' . $reason;
                break;

            default:
                return [null, 'Неизвестное действие'];
        }

        $task['updatedAt'] = date(DATE_ATOM);
        $task['history'][] = [
            'at' => date(DATE_ATOM),
            'by' => $user['name'],
            'byRole' => $user['role'],
            'action' => $action,
            'note' => $note,
        ];
        return [$task, null];
    }
}
