<?php

declare(strict_types=1);

namespace MFPro;

/**
 * Простая отправка писем через PHP mail().
 * Получатель настраивается переменной окружения MFPRO_LEADS_EMAIL.
 *
 * ВАЖНО: для реальной доставки на localhost нужен настроенный MTA
 * (sendmail/postfix) или SMTP. На проде обычно работает из коробки.
 * Если письмо не ушло — заявка всё равно сохраняется в storage/.
 */
final class Mailer
{
    public static function recipient(): string
    {
        $env = getenv('MFPRO_LEADS_EMAIL');
        return is_string($env) && $env !== '' ? $env : 'eldimamaev@gmail.com';
    }

    public static function send(string $subject, string $body): bool
    {
        $to = self::recipient();
        $headers = implode("\r\n", [
            'From: MF PRO <noreply@mfpro.kg>',
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
        ]);
        // mail() может вернуть false без настроенного MTA — это не критично.
        return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
    }
}
