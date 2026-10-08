"""
Блочный формат документов (Doc-view задач, заметки клиентов/сделок, база знаний).

Блок: {"id": "b1", "type": "p", "text": "...", "checked": false}
Типы как в Notion: абзац, заголовки, списки, чек-лист, цитата, выноска, код, разделитель.
"""
from __future__ import annotations

from typing import Any

from .utils import ApiError

BLOCK_TYPES = {'p', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'todo', 'quote', 'callout', 'code', 'divider'}
MAX_BLOCKS = 2000
MAX_TEXT = 20000


def clean_blocks(value: Any) -> list[dict]:
    """Проверяет и нормализует список блоков. Неизвестные ключи отбрасываются."""
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise ApiError('content: ожидается список блоков')
    if len(value) > MAX_BLOCKS:
        raise ApiError(f'Документ слишком большой (больше {MAX_BLOCKS} блоков)')
    out = []
    for i, b in enumerate(value):
        if not isinstance(b, dict):
            raise ApiError('content: каждый блок — объект')
        btype = b.get('type', 'p')
        if btype not in BLOCK_TYPES:
            raise ApiError(f'content: неизвестный тип блока «{btype}»')
        text = str(b.get('text', ''))
        if len(text) > MAX_TEXT:
            raise ApiError('content: блок слишком длинный')
        block = {'id': str(b.get('id') or f'b{i}')[:40], 'type': btype, 'text': text}
        if btype == 'todo':
            block['checked'] = bool(b.get('checked'))
        out.append(block)
    return out


def blocks_text(blocks: list[dict] | None) -> str:
    """Плоский текст документа — для поиска и превью."""
    return '\n'.join(b.get('text', '') for b in (blocks or []) if b.get('text'))
