<?php

declare(strict_types=1);

namespace SmartCapitalPartners;

/**
 * Отправка уведомлений в Telegram через Bot API.
 * Токен — у @BotFather, chat_id — у @userinfobot.
 *
 * @param array{token:string,chat_id:string} $cfg
 * @return array{ok:bool,error:?string}
 */
final class Telegram
{
    public static function send(array $cfg, string $text): array
    {
        $token = (string)($cfg['token'] ?? '');
        $chatId = (string)($cfg['chat_id'] ?? '');
        if ($token === '' || $chatId === '') {
            return ['ok' => false, 'error' => 'Не указан token или chat_id'];
        }

        $url = "https://api.telegram.org/bot{$token}/sendMessage";
        $payload = http_build_query([
            'chat_id' => $chatId,
            'text' => $text,
            'disable_web_page_preview' => 'true',
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        // curl_close() не нужен с PHP 8.0+ (ресурс закрывается автоматически)

        if ($res === false) {
            return ['ok' => false, 'error' => "cURL: {$err}"];
        }
        if ($code !== 200) {
            return ['ok' => false, 'error' => 'Telegram API: ' . (is_string($res) ? $res : '')];
        }
        return ['ok' => true, 'error' => null];
    }
}
