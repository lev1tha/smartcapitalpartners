<?php

declare(strict_types=1);

namespace MFPro;

/**
 * Хранилище контента сайта (карточки) в JSON-файлах backend/content/.
 */
final class Content
{
    private const TYPES = ['models', 'franchises', 'investments', 'ready'];

    public static function isValidType(string $type): bool
    {
        return in_array($type, self::TYPES, true);
    }

    private static function path(string $type): string
    {
        return __DIR__ . '/../content/' . basename($type) . '.json';
    }

    /** @return array<int,array<string,mixed>> */
    public static function all(string $type): array
    {
        $d = json_decode((string)@file_get_contents(self::path($type)), true);
        return is_array($d) ? $d : [];
    }

    /**
     * Создаёт или обновляет карточку (по id). Новые — в начало списка.
     * @param array<string,mixed> $item
     * @return array<string,mixed>
     */
    public static function save(string $type, array $item): array
    {
        if (empty($item['id'])) {
            $item['id'] = 'c' . substr(md5(uniqid('', true)), 0, 9);
        }
        $id = (string)$item['id'];

        $items = self::all($type);
        $found = false;
        foreach ($items as $i => $it) {
            if ((string)($it['id'] ?? '') === $id) {
                $items[$i] = $item;
                $found = true;
                break;
            }
        }
        if (!$found) {
            array_unshift($items, $item);
        }
        self::write($type, $items);
        return $item;
    }

    public static function delete(string $type, string $id): void
    {
        $items = array_values(array_filter(
            self::all($type),
            static fn (array $it): bool => (string)($it['id'] ?? '') !== $id
        ));
        self::write($type, $items);
    }

    /** @param array<int,array<string,mixed>> $items */
    private static function write(string $type, array $items): void
    {
        @file_put_contents(
            self::path($type),
            json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n"
        );
    }
}
