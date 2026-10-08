"""Журнал действий: кто, что и когда изменил (клиенты, сделки, платежи, задачи)."""
from __future__ import annotations

from decimal import Decimal
from datetime import date, datetime

from .models import AuditLog


def _plain(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return v


def diff(before: dict, after: dict) -> dict:
    """{field: [old, new]} только по изменившимся полям."""
    return {k: [_plain(before.get(k)), _plain(v)] for k, v in after.items() if before.get(k) != v}


def snapshot(obj, fields: list[str]) -> dict:
    return {f: getattr(obj, f) for f in fields}


def record(user, action: str, entity_type: str, entity_id: str, summary: str = '', changes: dict | None = None) -> None:
    AuditLog.objects.create(
        actor=user, actor_name=user.profile.name if user is not None else 'Система',
        action=action, entity_type=entity_type, entity_id=str(entity_id),
        summary=summary[:300], changes={k: [_plain(a), _plain(b)] for k, (a, b) in (changes or {}).items()},
    )
