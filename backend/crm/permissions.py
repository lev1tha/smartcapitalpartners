"""
Права доступа.

1. Разделы (модули) — по ролям, см. crm/roles.py и декоратор `require`.
2. Поля внутри записи — матрица FIELD_REGISTRY (значения по умолчанию)
   + переопределения в таблице FieldPermission, которые директор меняет в UI.

Скрытое поле приходит на фронтенд как null и перечисляется в `hidden`.
Попытка изменить поле без права на редактирование → 403 (а не молчаливое
игнорирование), поэтому менеджер не может «вслепую» перезаписать сумму сделки.
"""
from __future__ import annotations

from functools import wraps

from .roles import ROLES
from .utils import ApiError

ALL = tuple(ROLES)
CRM_VIEW = ('director', 'manager', 'marketer', 'finance', 'accountant')
CRM_EDIT = ('director', 'manager', 'marketer', 'finance')
FIN_VIEW = ('director', 'manager', 'finance', 'accountant')
FIN_EDIT = ('director', 'manager', 'finance')

# resource → field → (подпись, кто видит по умолчанию, кто редактирует по умолчанию)
FIELD_REGISTRY: dict[str, dict[str, tuple[str, tuple[str, ...], tuple[str, ...]]]] = {
    'client': {
        'email': ('Email', CRM_VIEW, CRM_EDIT),
        'phone': ('Телефон', CRM_VIEW, CRM_EDIT),
        'telegram': ('Telegram', CRM_VIEW, CRM_EDIT),
    },
    'deal': {
        'amount': ('Сумма сделки', FIN_VIEW, FIN_EDIT),
        'commission': ('Комиссия', FIN_VIEW, FIN_EDIT),
        'probability': ('Вероятность', CRM_VIEW, CRM_EDIT),
    },
    'finance': {
        'payments': ('Платежи и P&L', FIN_VIEW, ('director', 'finance', 'accountant')),
    },
}


class FieldAccess:
    """Матрица прав на поля для одного пользователя. Создаётся раз на запрос."""

    def __init__(self, role: str):
        self.role = role
        self._overrides: dict[tuple[str, str], tuple[bool, bool]] = {}
        if role != 'director':
            from .models import FieldPermission

            for fp in FieldPermission.objects.filter(role=role):
                self._overrides[(fp.resource, fp.field)] = (fp.can_view, fp.can_edit)

    def _get(self, resource: str, field: str) -> tuple[bool, bool]:
        spec = FIELD_REGISTRY.get(resource, {}).get(field)
        if spec is None:
            return True, True  # поле не регулируется матрицей
        if self.role == 'director':
            return True, True  # директор всегда видит всё — нельзя «запереть» себя
        if (resource, field) in self._overrides:
            view, edit = self._overrides[(resource, field)]
            return view, edit and view
        _, viewers, editors = spec
        view = self.role in viewers
        return view, view and self.role in editors

    def can_view(self, resource: str, field: str) -> bool:
        return self._get(resource, field)[0]

    def can_edit(self, resource: str, field: str) -> bool:
        return self._get(resource, field)[1]

    def hidden(self, resource: str) -> list[str]:
        return [f for f in FIELD_REGISTRY.get(resource, {}) if not self.can_view(resource, f)]

    def assert_editable(self, resource: str, incoming: dict, fields: list[str]) -> None:
        """403, если во входящих данных есть поле, которое роли нельзя менять."""
        for f in fields:
            if f in incoming and not self.can_edit(resource, f):
                label = FIELD_REGISTRY[resource][f][0]
                raise ApiError(f'Нет прав на изменение поля «{label}»', 403)

    def matrix(self) -> dict:
        return {
            res: {f: {'view': self.can_view(res, f), 'edit': self.can_edit(res, f)} for f in fields}
            for res, fields in FIELD_REGISTRY.items()
        }


def field_access(request) -> FieldAccess:
    """Кэш FieldAccess на объекте запроса."""
    fa = getattr(request, '_field_access', None)
    if fa is None:
        fa = FieldAccess(request.user.profile.role)
        request._field_access = fa
    return fa


def role_of(request) -> str | None:
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    return user.profile.role


def require(check=None, message: str = 'Недостаточно прав', anon_status: int = 401, deny_status: int = 403):
    """
    Декоратор вьюхи: нужен вошедший сотрудник и (опционально) check(role) == True.

    anon_status: часть эндпоинтов отвечает анониму 401,
    часть — сразу 403 («Недостаточно прав»).
    """

    def deco(fn):
        @wraps(fn)
        def wrapper(request, *args, **kwargs):
            role = role_of(request)
            if role is None:
                raise ApiError('Требуется авторизация' if anon_status == 401 else message, anon_status)
            if check is not None and not check(role):
                raise ApiError(message, deny_status)
            return fn(request, *args, **kwargs)

        return wrapper

    return deco
