<?php

declare(strict_types=1);

namespace SmartCapitalPartners;

/**
 * Простое JSON-хранилище списков в backend/storage/.
 */
final class Store
{
    private static function path(string $file): string
    {
        return __DIR__ . '/../storage/' . basename($file);
    }

    /** @return array<int,array<string,mixed>> */
    public static function read(string $file): array
    {
        $d = json_decode((string)@file_get_contents(self::path($file)), true);
        return is_array($d) ? $d : [];
    }

    /** @param array<int,array<string,mixed>> $data */
    public static function write(string $file, array $data): void
    {
        @file_put_contents(
            self::path($file),
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n"
        );
    }

    public static function id(string $prefix = 't'): string
    {
        return $prefix . substr(md5(uniqid('', true)), 0, 10);
    }
}
