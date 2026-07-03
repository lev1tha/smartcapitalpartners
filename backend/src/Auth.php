<?php

declare(strict_types=1);

namespace MFPro;

/**
 * Авторизация сотрудников CRM: логин/пароль → подписанный токен (login.hmac).
 * Токен stateless: на каждом запросе проверяем подпись и берём роль из конфига.
 */
final class Auth
{
    public const ROLES = [
        'director'   => 'Директор',
        'manager'    => 'Управляющий',
        'marketer'   => 'Маркетолог',
        'smm'        => 'СММ-специалист',
        'accountant' => 'Бухгалтер',
        'finance'    => 'Финансист',
    ];

    /** @param array<string,mixed> $config @return array<int,array<string,mixed>> */
    private static function users(array $config): array
    {
        return is_array($config['users'] ?? null) ? $config['users'] : [];
    }

    /** @param array<string,mixed> $config */
    private static function secret(array $config): string
    {
        return (string)($config['auth_secret'] ?? 'mfpro-secret');
    }

    /** @param array<string,mixed> $u @return array{id:string,name:string,role:string} */
    private static function publicUser(array $u): array
    {
        return [
            'id' => (string)($u['login'] ?? ''),
            'name' => (string)($u['name'] ?? ($u['login'] ?? '')),
            'role' => (string)($u['role'] ?? ''),
        ];
    }

    /**
     * @param array<string,mixed> $config
     * @return array{id:string,name:string,role:string}|null
     */
    public static function login(array $config, string $login, string $password): ?array
    {
        foreach (self::users($config) as $u) {
            if ((string)($u['login'] ?? '') === $login
                && hash_equals((string)($u['password'] ?? ''), $password)
            ) {
                return self::publicUser($u);
            }
        }
        return null;
    }

    /** @param array<string,mixed> $config */
    public static function tokenFor(string $userId, array $config): string
    {
        return $userId . '.' . hash_hmac('sha256', $userId, self::secret($config));
    }

    /**
     * Текущий пользователь по токену из заголовка Authorization.
     * @param array<string,mixed> $config
     * @return array{id:string,name:string,role:string}|null
     */
    public static function user(array $config): ?array
    {
        $raw = self::authHeader();
        if (stripos($raw, 'Bearer ') === 0) {
            $raw = substr($raw, 7);
        }
        $raw = trim($raw);
        $dot = strrpos($raw, '.');
        if ($dot === false) {
            return null;
        }
        $userId = substr($raw, 0, $dot);
        $sig = substr($raw, $dot + 1);
        $expected = hash_hmac('sha256', $userId, self::secret($config));
        if (!hash_equals($expected, $sig)) {
            return null;
        }
        foreach (self::users($config) as $u) {
            if ((string)($u['login'] ?? '') === $userId) {
                return self::publicUser($u);
            }
        }
        return null;
    }

    /** @param array<string,mixed> $config */
    public static function check(array $config): bool
    {
        return self::user($config) !== null;
    }

    /**
     * Проверка роли. $roles — список разрешённых ролей.
     * @param array<string,mixed> $config
     * @param array<int,string> $roles
     */
    public static function hasRole(array $config, array $roles): bool
    {
        $u = self::user($config);
        return $u !== null && in_array($u['role'], $roles, true);
    }

    private static function authHeader(): string
    {
        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $key => $value) {
                if (strtolower($key) === 'authorization') {
                    return (string)$value;
                }
            }
        }
        return (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    }
}
