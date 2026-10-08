"""
SQLite (dev) сравнивает LIKE без учёта регистра только для латиницы, поэтому
поиск «клиент» не находил «Клиент». Подменяем LIKE на Unicode-версию.
На PostgreSQL Django использует UPPER(...) LIKE, там это уже работает.
"""
import re

from django.db.backends.signals import connection_created
from django.dispatch import receiver


def _like(pattern, value, escape='\\'):
    if pattern is None or value is None:
        return None
    rx, i = [], 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == escape and i + 1 < len(pattern):
            rx.append(re.escape(pattern[i + 1]))
            i += 2
            continue
        rx.append('.*' if ch == '%' else '.' if ch == '_' else re.escape(ch))
        i += 1
    return re.fullmatch(''.join(rx), str(value), re.S | re.IGNORECASE) is not None


@receiver(connection_created)
def unicode_like(sender, connection, **kwargs):
    if connection.vendor == 'sqlite':
        connection.connection.create_function('like', 2, lambda p, v: _like(p, v), deterministic=True)
        connection.connection.create_function('like', 3, _like, deterministic=True)
