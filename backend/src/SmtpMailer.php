<?php

declare(strict_types=1);

namespace MFPro;

/**
 * Нативный SMTP-клиент поверх SSL (без сторонних библиотек).
 * Для Gmail: host smtp.gmail.com, port 465, пароль — «App Password».
 *
 * @param array{host:string,port:int,username:string,password:string,from:string,from_name:string} $cfg
 * @return array{ok:bool,error:?string}
 */
final class SmtpMailer
{
    public static function send(array $cfg, string $to, string $subject, string $body): array
    {
        $host = (string)($cfg['host'] ?? 'smtp.gmail.com');
        $port = (int)($cfg['port'] ?? 465);

        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $fp = @stream_socket_client("ssl://{$host}:{$port}", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) {
            return ['ok' => false, 'error' => "Не удалось подключиться к SMTP: {$errstr}"];
        }
        stream_set_timeout($fp, 15);

        $read = static function () use ($fp): string {
            $data = '';
            while (($line = fgets($fp, 515)) !== false) {
                $data .= $line;
                // последняя строка многострочного ответа: 4-й символ — пробел
                if (strlen($line) < 4 || $line[3] === ' ') {
                    break;
                }
            }
            return $data;
        };
        $cmd = static function (string $c) use ($fp): void {
            fwrite($fp, $c . "\r\n");
        };
        $is = static fn (string $resp, string $code): bool => str_starts_with($resp, $code);

        $fail = static function (string $msg) use ($fp): array {
            @fclose($fp);
            return ['ok' => false, 'error' => $msg];
        };

        $read(); // приветствие 220
        $cmd('EHLO mfpro.local');
        $read();
        $cmd('AUTH LOGIN');
        $read(); // 334
        $cmd(base64_encode((string)$cfg['username']));
        $read(); // 334
        $cmd(base64_encode((string)$cfg['password']));
        $r = $read(); // 235 — успех аутентификации
        if (!$is($r, '235')) {
            return $fail('Ошибка авторизации SMTP: ' . trim($r));
        }

        $from = (string)($cfg['from'] ?? $cfg['username']);
        $fromName = (string)($cfg['from_name'] ?? 'MF PRO');

        $cmd("MAIL FROM:<{$from}>");
        $read();
        $cmd("RCPT TO:<{$to}>");
        $r = $read();
        if (!$is($r, '250')) {
            return $fail('SMTP отклонил получателя: ' . trim($r));
        }

        $cmd('DATA');
        $read(); // 354

        $headers =
            'From: =?UTF-8?B?' . base64_encode($fromName) . "?= <{$from}>\r\n" .
            "To: <{$to}>\r\n" .
            'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n" .
            "MIME-Version: 1.0\r\n" .
            "Content-Type: text/plain; charset=utf-8\r\n" .
            "Content-Transfer-Encoding: base64\r\n";
        // base64-тело исключает проблемы с точками в начале строк и кодировкой
        $message = $headers . "\r\n" . chunk_split(base64_encode($body));

        $cmd($message . "\r\n.");
        $r = $read(); // 250 — принято
        $cmd('QUIT');
        @fclose($fp);

        return $is($r, '250')
            ? ['ok' => true, 'error' => null]
            : ['ok' => false, 'error' => 'SMTP не принял письмо: ' . trim($r)];
    }
}
