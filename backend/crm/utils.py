"""Общие хелперы API: ошибки в формате {"error": ...}, id, даты, разбор тела."""
from __future__ import annotations

import re
import secrets
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from django.http import JsonResponse
from django.utils import timezone
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class ApiError(exceptions.APIException):
    """Бросается из вьюх: превращается в {"error": message} с нужным кодом."""

    def __init__(self, message: str, code: int = status.HTTP_422_UNPROCESSABLE_ENTITY):
        super().__init__(message)
        self.status_code = code
        self.message = message


def exception_handler(exc, context):
    """Все ошибки API — в едином формате {"error": "..."}."""
    if isinstance(exc, ApiError):
        return Response({'error': exc.message}, status=exc.status_code)
    if isinstance(exc, exceptions.ParseError):
        return Response({'error': 'Invalid JSON body'}, status=400)
    if isinstance(exc, exceptions.NotAuthenticated):
        return Response({'error': 'Требуется авторизация'}, status=401)
    if isinstance(exc, exceptions.AuthenticationFailed):
        return Response({'error': 'Сессия истекла, войдите снова'}, status=401)
    if isinstance(exc, exceptions.PermissionDenied):
        return Response({'error': str(exc.detail) or 'Недостаточно прав'}, status=403)
    if isinstance(exc, exceptions.MethodNotAllowed):
        return Response({'error': 'Метод не поддерживается'}, status=405)
    response = drf_exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict) and 'error' not in response.data:
        detail = response.data.get('detail')
        if detail is None:
            # ошибки валидации сериализатора: берём первое сообщение
            first = next(iter(response.data.values()), '')
            detail = first[0] if isinstance(first, list) and first else first
        response.data = {'error': str(detail), 'fields': response.data}
    return response


def json_not_found(request, exception=None):
    return JsonResponse({'error': 'Not Found', 'path': request.path}, status=404,
                        json_dumps_params={'ensure_ascii': False})


def new_id(prefix: str) -> str:
    """Короткий id с префиксом: task_3f9a1c0b2d."""
    return prefix + secrets.token_hex(5)


def iso(dt: datetime | None) -> str:
    """Дата-время в формате ISO 8601 (DATE_ATOM) в часовом поясе проекта."""
    if dt is None:
        return ''
    return timezone.localtime(dt).isoformat(timespec='seconds')


def iso_date(d: date | None) -> str:
    return d.isoformat() if d else ''


def body(request) -> dict[str, Any]:
    """Тело запроса как dict (не-объект JSON → пустой dict)."""
    data = request.data
    return data if isinstance(data, dict) else {}


def item_of(request) -> dict[str, Any] | None:
    item = body(request).get('item')
    return item if isinstance(item, dict) else None


def s(value: Any) -> str:
    """Строка из любого значения + trim."""
    if value is None:
        return ''
    if isinstance(value, bool):
        return '1' if value else ''
    return str(value).strip()


_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}')


_RU_DATE_RE = re.compile(r'^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$')


def parse_date(value: Any, field: str = 'Дата') -> date | None:
    """'' / None → None; 'ГГГГ-ММ-ДД' (можно с временем) или 'ДД.ММ[.ГГГГ]' → date; иначе 422.
    Русский формат поддержан, потому что старая форма задач принимала «20.06» текстом."""
    raw = s(value)
    if not raw:
        return None
    try:
        if _DATE_RE.match(raw):
            return date.fromisoformat(raw[:10])
        m = _RU_DATE_RE.match(raw)
        if m:
            day, month, year = int(m[1]), int(m[2]), m[3]
            y = int(year) + (2000 if year and len(year) == 2 else 0) if year else timezone.localdate().year
            return date(y, month, day)
    except ValueError as e:
        raise ApiError(f'{field}: некорректная дата') from e
    raise ApiError(f'{field}: ожидается формат ГГГГ-ММ-ДД или ДД.ММ')


def parse_datetime_loose(value: Any) -> datetime | None:
    raw = s(value)
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
    except ValueError:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


def to_decimal(value: Any, field: str = 'Сумма') -> Decimal:
    if value in (None, ''):
        return Decimal('0')
    try:
        d = Decimal(str(value).replace(' ', '').replace(',', '.'))
    except InvalidOperation as e:
        raise ApiError(f'{field}: ожидается число') from e
    if not d.is_finite():
        raise ApiError(f'{field}: ожидается число')
    return d.quantize(Decimal('0.01'))


def num(d: Decimal | None) -> float | int | None:
    """Decimal → число для JSON (целые без .0)."""
    if d is None:
        return None
    return int(d) if d == d.to_integral_value() else float(d)
