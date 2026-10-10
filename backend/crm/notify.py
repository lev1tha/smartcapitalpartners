"""
Smart Notification Center: доставка уведомлений по каналам.

  web       — запись в таблицу Notification (центр уведомлений в CRM), всегда;
  telegram  — личный chat_id сотрудника, с учётом приоритета и «Не беспокоить»;
  email/tg  — заявки с сайта (директору).

Внешние каналы отправляются после коммита транзакции и в фоновом потоке,
чтобы медленный Telegram не задерживал ответ API.
"""
from __future__ import annotations

import json
import logging
import threading
import urllib.parse
import urllib.request
from datetime import datetime, time
from typing import Iterable

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import PRIORITY_RANK, Notification, Profile

log = logging.getLogger('crm.notify')
User = get_user_model()


# ------------------------------ каналы ------------------------------

def send_telegram(chat_id: str, text: str, token: str | None = None) -> tuple[bool, str | None]:
    token = token if token is not None else settings.TELEGRAM_BOT_TOKEN
    if not token or not chat_id:
        return False, 'Не указан token или chat_id'
    data = urllib.parse.urlencode({
        'chat_id': chat_id, 'text': text[:4000], 'disable_web_page_preview': 'true',
    }).encode()
    req = urllib.request.Request(f'https://api.telegram.org/bot{token}/sendMessage', data=data)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            ok = json.loads(resp.read() or b'{}').get('ok', False)
            return bool(ok), None if ok else 'Telegram API: ok=false'
    except Exception as e:  # сеть/HTTP-ошибка не должна ронять запрос
        return False, f'Telegram: {e}'


def send_email(subject: str, text: str, to: str | None = None) -> bool:
    to = to or settings.LEADS_EMAIL
    if not (to and settings.EMAIL_HOST_PASSWORD):
        return False
    try:
        return send_mail(subject, text, settings.DEFAULT_FROM_EMAIL, [to]) > 0
    except Exception as e:
        log.warning('email не отправлен: %s', e)
        return False


def _run_later(fn) -> None:
    """После коммита; в фоне, если NOTIFY_ASYNC (в тестах — синхронно)."""

    def start():
        if settings.NOTIFY_ASYNC:
            threading.Thread(target=fn, daemon=True).start()
        else:
            fn()

    transaction.on_commit(start)


# ------------------------------ правила доставки ------------------------------

def in_quiet_hours(profile: Profile, now: datetime | None = None) -> bool:
    """Попадает ли текущее время в окно «Не беспокоить» (окно может переходить через полночь)."""
    if not profile.dnd_enabled:
        return False
    t: time = timezone.localtime(now or timezone.now()).time()
    start, end = profile.dnd_start, profile.dnd_end
    if start == end:
        return True  # окно на весь день
    if start < end:
        return start <= t < end
    return t >= start or t < end


def telegram_allowed(profile: Profile, priority: str, now: datetime | None = None) -> bool:
    if not (profile.notify_telegram and profile.telegram_chat_id):
        return False
    if PRIORITY_RANK.get(priority, 1) < PRIORITY_RANK.get(profile.telegram_min_priority, 1):
        return False
    # Срочное пробивает «Не беспокоить» — это дедлайны и блокеры.
    if priority == 'urgent':
        return True
    return not in_quiet_hours(profile, now)


def _deliver_external(notification_ids: list[int]) -> None:
    for n in Notification.objects.filter(id__in=notification_ids).select_related('user__profile'):
        profile = n.user.profile
        if telegram_allowed(profile, n.priority):
            text = n.title + (f'\n\n{n.body}' if n.body else '')
            ok, err = send_telegram(profile.telegram_chat_id, text)
            if ok:
                n.delivered = [*n.delivered, 'telegram']
                n.save(update_fields=['delivered'])
            elif err:
                log.info('telegram → %s: %s', n.user.username, err)


# ------------------------------ публичный API модуля ------------------------------

def notify(users: Iterable, title: str, body: str = '', *, kind: str = 'system',
           priority: str = 'normal', link: tuple[str, str] | None = None, exclude=None) -> list[Notification]:
    """Создаёт уведомления пользователям (кроме exclude) и планирует внешние каналы."""
    seen: set[int] = set()
    created: list[Notification] = []
    for u in users:
        if u is None or u.pk in seen or (exclude is not None and u.pk == exclude.pk):
            continue
        seen.add(u.pk)
        created.append(Notification(
            user=u, title=title[:300], body=body, kind=kind, priority=priority,
            link_type=link[0] if link else '', link_id=link[1] if link else '', delivered=['web'],
        ))
    if not created:
        return []
    created = Notification.objects.bulk_create(created)
    ids = [n.id for n in created if n.id is not None]
    if not ids:  # бэкенды без RETURNING: перечитываем последние
        ids = list(Notification.objects.filter(title=title[:300]).order_by('-id')
                   .values_list('id', flat=True)[:len(created)])
    _run_later(lambda: _deliver_external(ids))
    return created


def users_with_roles(*roles: str):
    return User.objects.filter(is_active=True, profile__role__in=roles).select_related('profile')


def notify_site_submission(subject: str, text: str) -> dict:
    """Заявка с сайта: email + Telegram директору."""
    result = {'email': False, 'telegram': False}

    def go():
        result['email'] = send_email(subject, text)
        if settings.TELEGRAM_LEADS_CHAT_ID:
            result['telegram'] = send_telegram(settings.TELEGRAM_LEADS_CHAT_ID, f'{subject}\n\n{text}')[0]

    _run_later(go)
    # При фоновой отправке результат ещё неизвестен — сообщаем, какие каналы настроены.
    if settings.NOTIFY_ASYNC:
        return {'email': bool(settings.EMAIL_HOST_PASSWORD), 'telegram': bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_LEADS_CHAT_ID)}
    return result
