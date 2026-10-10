"""
Начальные данные CRM и сайта из JSON (backend/legacy/{content,storage}).

  python manage.py import_legacy              # из backend/legacy
  python manage.py import_legacy /path/root   # из другой папки с content/ и storage/

Идемпотентно: записи с существующим id обновляются, без id (заявки) —
пропускаются при совпадении createdAt+phone. Файлы из <root>/uploads
копируются в MEDIA_ROOT, ссылки /uploads/... остаются прежними.
"""
import json
import shutil
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from crm import models as m

User = get_user_model()


def _dt(value) -> datetime:
    if not value:
        return timezone.now()
    try:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return timezone.now()
    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt


def _date(value) -> date | None:
    v = str(value or '').strip()
    if not v:
        return None
    try:
        return date.fromisoformat(v[:10])
    except ValueError:
        return None


def _dec(value) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal('0.01'))
    except InvalidOperation:
        return Decimal('0')


class Command(BaseCommand):
    help = 'Импорт начальных данных из JSON (backend/legacy по умолчанию)'

    def add_arguments(self, parser):
        parser.add_argument('root', nargs='?', default=str(settings.BASE_DIR / 'legacy'),
                            help='папка с content/ и storage/ (по умолчанию backend/legacy)')

    def _load(self, name: str, folder: str = 'storage'):
        path = self.root / folder / name
        if not path.exists():
            return []
        data = json.loads(path.read_text(encoding='utf-8') or 'null')
        return data if data is not None else []

    @transaction.atomic
    def handle(self, *args, **opts):
        self.root = Path(opts['root'])
        if not (self.root / 'storage').is_dir():
            raise CommandError(f'{self.root}/storage не найден')
        users = {u.username: u for u in User.objects.filter(profile__isnull=False).select_related('profile')}
        n = {}

        # --- заявки ---
        for key, model, fields in (
            ('leads.json', m.Lead, ('name', 'phone', 'topic')),
            ('quiz-results.json', m.QuizResult, ('name', 'phone', 'email', 'level')),
            ('turnkey-requests.json', m.TurnkeyRequest, ('name', 'phone', 'sphere', 'budget', 'city')),
        ):
            for r in self._load(key):
                created_at = _dt(r.get('createdAt'))
                if model.objects.filter(phone=r.get('phone', ''), created_at=created_at).exists():
                    continue
                obj = model(created_at=created_at, ip=r.get('ip') or None, **{f: r.get(f) or '' for f in fields})
                if model is m.QuizResult:
                    obj.score, obj.max_score = int(r.get('score') or 0), int(r.get('maxScore') or 0)
                    obj.answers = r.get('answers') or []
                if model is m.TurnkeyRequest:
                    obj.services = r.get('services') or []
                obj.save()
                n[key] = n.get(key, 0) + 1

        # --- контент сайта ---
        for ctype in m.ContentItem.TYPES:
            for pos, item in enumerate(self._load(f'{ctype}.json', 'content')):
                cid = str(item.get('id') or '')
                data = {k: v for k, v in item.items() if k != 'id'}
                if cid:
                    m.ContentItem.objects.update_or_create(pk=cid, defaults={'type': ctype, 'position': pos, 'data': data})
                else:
                    m.ContentItem.objects.create(type=ctype, position=pos, data=data)
                n['content'] = n.get('content', 0) + 1

        # --- задачи ---
        for t in self._load('tasks.json'):
            if not t.get('id'):
                continue
            author = users.get(t.get('createdBy', ''))
            task, _ = m.Task.objects.update_or_create(pk=t['id'], defaults={
                'title': t.get('title', ''), 'description': t.get('description', ''),
                'assignee': t.get('assignee', ''), 'due_date': _date(t.get('dueDate')),
                'priority': t.get('priority') or 'normal', 'status': t.get('status') or 'new',
                'result_text': (t.get('result') or {}).get('text', ''),
                'result_link': (t.get('result') or {}).get('link', ''),
                'rejection_reason': t.get('rejectionReason', ''), 'attachments': t.get('attachments') or [],
                'created_by': author, 'created_by_login': t.get('createdBy', ''),
                'created_by_name': t.get('createdByName', ''), 'created_by_role': t.get('createdByRole', ''),
                'created_at': _dt(t.get('createdAt')), 'updated_at': _dt(t.get('updatedAt')),
            })
            task.events.all().delete()
            m.TaskEvent.objects.bulk_create([
                m.TaskEvent(task=task, at=_dt(h.get('at')), by_name=h.get('by', ''), by_role=h.get('byRole', ''),
                            action=h.get('action', ''), note=h.get('note', ''))
                for h in t.get('history') or []
            ])
            n['tasks'] = n.get('tasks', 0) + 1

        # --- идеи ---
        for i in self._load('ideas.json'):
            if not i.get('id'):
                continue
            author = next((u for u in users.values() if u.profile.name == i.get('author')), None)
            m.Idea.objects.update_or_create(pk=i['id'], defaults={
                'text': i.get('text', ''), 'author': author, 'author_name': i.get('author', ''),
                'author_role': i.get('authorRole', ''), 'created_at': _dt(i.get('createdAt')),
            })
            n['ideas'] = n.get('ideas', 0) + 1

        # --- календарь ---
        for pos, a in enumerate(self._load('accounts.json')):
            if a.get('id'):
                m.SocialAccount.objects.update_or_create(pk=a['id'], defaults={
                    'name': a.get('name', ''), 'platform': a.get('platform', ''), 'position': pos})
                n['accounts'] = n.get('accounts', 0) + 1
        for p in self._load('calendar.json'):
            d = _date(p.get('date'))
            if not p.get('id') or d is None:
                continue
            acc_id = p.get('accountId') or None
            if acc_id and not m.SocialAccount.objects.filter(pk=acc_id).exists():
                acc_id = None
            m.CalendarPost.objects.update_or_create(pk=p['id'], defaults={
                'account_id': acc_id, 'date': d, 'type': p.get('type') or 'post', 'title': p.get('title', ''),
                'note': p.get('note', ''), 'status': p.get('status') or 'idea', 'link': p.get('link', ''),
                'created_by_name': p.get('createdBy', ''), 'created_at': _dt(p.get('createdAt')),
                'updated_at': _dt(p.get('updatedAt')),
            })
            n['posts'] = n.get('posts', 0) + 1

        # --- SMM / бухгалтерия / маркетинг ---
        for t in self._load('smm-tasks.json'):
            if t.get('id'):
                m.SmmTask.objects.update_or_create(pk=t['id'], defaults={
                    'title': t.get('title', ''), 'period': t.get('period') or 'daily',
                    'category': t.get('category') or 'Контент', 'priority': t.get('priority') or 'medium',
                    'due_date': t.get('dueDate', ''), 'is_completed': bool(t.get('isCompleted')),
                    'created_by': users.get(t.get('createdBy', '')), 'created_by_login': t.get('createdBy', ''),
                    'created_at': _dt(t.get('createdAt')),
                })
                n['smm'] = n.get('smm', 0) + 1
        for t in self._load('acc-tasks.json'):
            if t.get('id'):
                m.AccTask.objects.update_or_create(pk=t['id'], defaults={
                    'title': t.get('title', ''), 'period': t.get('period') or 'monthly',
                    'reporting_period': t.get('reportingPeriod', ''), 'deadline': _date(t.get('deadline')),
                    'status': t.get('status') or 'not_started', 'receipt_file': t.get('receiptFile', ''),
                    'created_by_name': t.get('createdBy', ''), 'created_at': _dt(t.get('createdAt')),
                })
                n['acc'] = n.get('acc', 0) + 1
        for d in self._load('acc-docs.json'):
            if d.get('id'):
                m.AccDoc.objects.update_or_create(pk=d['id'], defaults={
                    'counterparty': d.get('counterparty', ''), 'type': d.get('type') or 'Акт сверки',
                    'status': d.get('status') or 'requested'})
                n['docs'] = n.get('docs', 0) + 1
        for c in self._load('mkt-campaigns.json'):
            if c.get('id'):
                m.Campaign.objects.update_or_create(pk=c['id'], defaults={
                    'name': c.get('name', ''), 'channel': c.get('channel') or 'Instagram',
                    'status': c.get('status') or 'active', 'budget': _dec(c.get('budget')),
                    'spent': _dec(c.get('spent')), 'leads': int(c.get('leads') or 0),
                    'created_at': _dt(c.get('createdAt'))})
                n['campaigns'] = n.get('campaigns', 0) + 1
        for key, fname in (('smm', 'smm-settings.json'), ('acc', 'acc-settings.json'), ('mkt', 'mkt-settings.json')):
            data = self._load(fname)
            if isinstance(data, dict) and data:
                m.BoardSettings.objects.update_or_create(pk=key, defaults={'data': data})

        # --- файлы ---
        src = self.root / 'uploads'
        if src.is_dir():
            Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
            for f in src.iterdir():
                if f.is_file() and not f.name.startswith('.'):
                    shutil.copy2(f, Path(settings.MEDIA_ROOT) / f.name)
                    n['files'] = n.get('files', 0) + 1

        self.stdout.write('Импортировано: ' + ', '.join(f'{k}={v}' for k, v in sorted(n.items())))
