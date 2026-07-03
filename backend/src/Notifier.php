<?php

declare(strict_types=1);

namespace MFPro;

/**
 * Единая точка отправки уведомлений по всем каналам.
 * Email: SMTP (если настроен) → иначе fallback на mail().
 * Telegram: если настроен.
 */
final class Notifier
{
    /** @var array<string,mixed> */
    private static array $config = [];

    /** @param array<string,mixed> $config */
    public static function configure(array $config): void
    {
        self::$config = $config;
    }

    /**
     * @return array{email:bool,telegram:bool}
     */
    public static function send(string $subject, string $body): array
    {
        $cfg = self::$config;
        $to = (string)($cfg['recipient'] ?? Mailer::recipient());
        $result = ['email' => false, 'telegram' => false];

        // --- Email ---
        $smtp = is_array($cfg['smtp'] ?? null) ? $cfg['smtp'] : [];
        if (!empty($smtp['enabled']) && !empty($smtp['password'])) {
            $r = SmtpMailer::send($smtp, $to, $subject, $body);
            $result['email'] = $r['ok'];
        } else {
            // Fallback: встроенный mail() (на проде с MTA может работать)
            $result['email'] = Mailer::send($subject, $body);
        }

        // --- Telegram ---
        $tg = is_array($cfg['telegram'] ?? null) ? $cfg['telegram'] : [];
        if (!empty($tg['enabled']) && !empty($tg['token']) && !empty($tg['chat_id'])) {
            $text = "📥 {$subject}\n\n{$body}";
            $r = Telegram::send($tg, $text);
            $result['telegram'] = $r['ok'];
        }

        return $result;
    }
}
