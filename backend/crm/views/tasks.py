"""
Задачи (kanban + doc-view). Воркфлоу переходов:
  new/rejected → start → in_progress → submit → review → approve → done
                                               review → reject (причина) → rejected
"""
import os
import re

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import presenters as P
from .. import roles as R
from ..audit import record
from ..blocks import clean_blocks
from ..models import Client, Deal, Task, TaskEvent
from ..notify import notify, users_with_roles
from ..permissions import require
from ..utils import ApiError, body, item_of, new_id, parse_date, s

PRIORITIES = ('low', 'normal', 'high', 'urgent')


def visible_tasks(user):
    """Менеджеры — все; остальные — где исполнитель их роль или они автор."""
    qs = Task.objects.select_related('client', 'deal').prefetch_related('events')
    role = user.profile.role
    if R.is_manager(role):
        return qs
    return qs.filter(Q(assignee=role) | Q(created_by=user))


def _can_touch(user, task: Task) -> bool:
    role = user.profile.role
    return R.is_manager(role) or task.assignee == role or task.created_by_id == user.pk


def _event(task: Task, user, action: str, note: str) -> None:
    TaskEvent.objects.create(task=task, by_name=user.profile.name, by_role=user.profile.role,
                             action=action, note=note)


def _linked(item: dict, task: Task) -> None:
    """Сквозные связи задачи с клиентом/сделкой (необязательные ключи clientId/dealId)."""
    if 'clientId' in item:
        cid = s(item.get('clientId'))
        if cid and not Client.objects.filter(pk=cid).exists():
            raise ApiError('Клиент не найден', 404)
        task.client_id = cid or None
    if 'dealId' in item:
        did = s(item.get('dealId'))
        deal = Deal.objects.filter(pk=did).first() if did else None
        if did and deal is None:
            raise ApiError('Сделка не найдена', 404)
        task.deal = deal
        if deal and not task.client_id:
            task.client_id = deal.client_id


def _notify_assignees(task: Task, actor, title: str, priority: str = 'normal') -> None:
    if task.assignee:
        notify(users_with_roles(task.assignee), title, task.title, kind='task',
               priority=priority, link=('task', task.id), exclude=actor)


@api_view(['GET'])
@require()
def task_list(request):
    tasks = [P.task(t) for t in visible_tasks(request.user)]
    return Response({
        'tasks': tasks,
        'statuses': R.TASK_STATUSES,
        'roles': R.ROLES,
        'me': P.public_user(request.user),
        'isManager': R.is_manager(request.user.profile.role),
    })


@api_view(['POST'])
@require(R.is_manager, 'Ставить задачи может управляющий или директор', anon_status=403)
def task_save(request):
    user = request.user
    item = item_of(request)
    if item is None or not s(item.get('title')):
        raise ApiError('Укажите название задачи')
    priority = s(item.get('priority')) or 'normal'
    if priority not in PRIORITIES:
        priority = 'normal'

    with transaction.atomic():
        task_id = s(item.get('id'))
        if task_id:
            task = Task.objects.select_for_update().filter(pk=task_id).first()
            if task is None:
                raise ApiError('Задача не найдена', 404)
            prev_assignee = task.assignee
            task.title = s(item['title'])
            task.description = s(item.get('description'))
            if 'assignee' in item:
                task.assignee = s(item.get('assignee'))
            if 'dueDate' in item:
                task.due_date = parse_date(item.get('dueDate'), 'Срок')
            if 'startDate' in item:
                task.start_date = parse_date(item.get('startDate'), 'Начало')
            if 'priority' in item:
                task.priority = priority
            if 'content' in item:
                task.content = clean_blocks(item.get('content'))
            if isinstance(item.get('customFields'), dict):
                task.custom_fields = item['customFields']
            _linked(item, task)
            task.updated_at = timezone.now()
            task.save()
            if task.assignee and task.assignee != prev_assignee:
                _notify_assignees(task, user, 'Вам назначена задача', 'high' if priority in ('high', 'urgent') else 'normal')
        else:
            task = Task(
                id=new_id('task_'),
                title=s(item['title']), description=s(item.get('description')),
                assignee=s(item.get('assignee')),
                due_date=parse_date(item.get('dueDate'), 'Срок'),
                start_date=parse_date(item.get('startDate'), 'Начало'),
                priority=priority, status='new',
                content=clean_blocks(item.get('content')),
                custom_fields=item.get('customFields') if isinstance(item.get('customFields'), dict) else {},
                created_by=user, created_by_login=user.username,
                created_by_name=user.profile.name, created_by_role=user.profile.role,
            )
            _linked(item, task)
            task.save()
            _event(task, user, 'create', 'Задача создана')
            record(user, 'create', 'task', task.id, f'Создана задача «{task.title}»')
            _notify_assignees(task, user, 'Новая задача', 'urgent' if priority == 'urgent' else
                              'high' if priority == 'high' else 'normal')
    task = Task.objects.select_related('client', 'deal').get(pk=task.pk)
    return Response({'task': P.task(task)})


def apply_transition(task: Task, action: str, user, payload: dict) -> str:
    """Меняет task на месте и возвращает заметку для истории. Ошибка → ApiError(422)."""
    role = user.profile.role
    is_assignee = task.assignee == role
    is_manager = R.is_manager(role)

    if action == 'start':
        if task.status not in ('new', 'rejected'):
            raise ApiError('Нельзя взять в работу из текущего статуса')
        if not (is_assignee or is_manager):
            raise ApiError('Только исполнитель может взять задачу')
        task.status = 'in_progress'
        return 'Взято в работу'

    if action == 'submit':
        if task.status != 'in_progress':
            raise ApiError('Сдать можно только задачу в работе')
        if not (is_assignee or is_manager):
            raise ApiError('Только исполнитель может сдать задачу')
        task.result_text = s(payload.get('resultText'))
        task.result_link = s(payload.get('resultLink'))
        if isinstance(payload.get('attachments'), list):
            task.attachments = [*(task.attachments or []), *payload['attachments']]
        task.status = 'review'
        return 'Сдано на проверку' + (f' · ссылка: {task.result_link}' if task.result_link else '')

    if action == 'approve':
        if task.status != 'review':
            raise ApiError('Принять можно только задачу на проверке')
        if not is_manager:
            raise ApiError('Принимать может только управляющий/директор')
        task.status = 'done'
        return 'Задача принята'

    if action == 'reject':
        if task.status != 'review':
            raise ApiError('Отклонить можно только задачу на проверке')
        if not is_manager:
            raise ApiError('Отклонять может только управляющий/директор')
        reason = s(payload.get('reason'))
        if not reason:
            raise ApiError('Укажите причину отклонения')
        task.status = 'rejected'
        task.rejection_reason = reason
        return f'Отклонено: {reason}'

    raise ApiError('Неизвестное действие')


@api_view(['POST'])
@require()
def task_transition(request):
    data = body(request)
    task_id, action = s(data.get('id')), s(data.get('action'))
    payload = data.get('payload') if isinstance(data.get('payload'), dict) else {}
    user = request.user
    with transaction.atomic():
        task = Task.objects.select_for_update().filter(pk=task_id).first()
        if task is None:
            raise ApiError('Задача не найдена', 404)
        note = apply_transition(task, action, user, payload)
        task.updated_at = timezone.now()
        task.save()
        _event(task, user, action, note)

        # Уведомления по шагам воркфлоу
        if action == 'submit':
            notify(users_with_roles(*R.MANAGERS), 'Задача ждёт проверки', task.title, kind='task',
                   priority='high', link=('task', task.id), exclude=user)
        elif action == 'approve':
            _notify_assignees(task, user, 'Задача принята')
        elif action == 'reject':
            _notify_assignees(task, user, 'Задача отклонена', 'high')
    task = Task.objects.select_related('client', 'deal').get(pk=task.pk)
    return Response({'task': P.task(task)})


@api_view(['POST'])
@require()
def task_content(request):
    """Doc-view: тело задачи и свойства. Может править исполнитель, автор или руководитель."""
    data = body(request)
    task = Task.objects.filter(pk=s(data.get('id'))).first()
    if task is None:
        raise ApiError('Задача не найдена', 404)
    if not _can_touch(request.user, task):
        raise ApiError('Нет доступа к задаче', 403)
    fields = ['updated_at']
    if 'content' in data:
        task.content = clean_blocks(data.get('content'))
        fields.append('content')
    if isinstance(data.get('customFields'), dict):
        task.custom_fields = data['customFields']
        fields.append('custom_fields')
    if R.is_manager(request.user.profile.role):
        for key, attr, label in (('startDate', 'start_date', 'Начало'), ('dueDate', 'due_date', 'Срок')):
            if key in data:
                setattr(task, attr, parse_date(data.get(key), label))
                fields.append(attr)
    task.updated_at = timezone.now()
    task.save(update_fields=fields)
    task = Task.objects.select_related('client', 'deal').get(pk=task.pk)
    return Response({'task': P.task(task)})


@api_view(['POST'])
@require(R.is_manager, anon_status=403)
def task_delete(request):
    task_id = s(body(request).get('id'))
    deleted, _ = Task.objects.filter(pk=task_id).delete()
    if deleted:
        record(request.user, 'delete', 'task', task_id, 'Задача удалена')
    return Response({'status': 'ok'})


ALLOWED_UPLOADS = {'xlsx', 'xls', 'csv', 'docx', 'doc', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt'}
_UNSAFE = re.compile(r'[^\w.\-]+', re.UNICODE)


def save_upload(f, prefix: str, allowed: set[str], bad_type_msg: str) -> str:
    """Сохраняет файл в MEDIA_ROOT и возвращает публичный URL /uploads/<name>."""
    ext = os.path.splitext(f.name)[1].lower().lstrip('.')
    if ext not in allowed:
        raise ApiError(bad_type_msg)
    if f.size > settings.UPLOAD_MAX_BYTES:
        raise ApiError('Файл больше 15 МБ')
    safe = _UNSAFE.sub('_', os.path.basename(f.name))
    name = default_storage.save(f'{new_id(prefix)}_{safe}', f)
    return settings.MEDIA_URL + name


@api_view(['POST'])
@require()
def upload(request):
    f = request.FILES.get('file')
    if f is None:
        raise ApiError('Файл не получен', 400)
    url = save_upload(f, 'f_', ALLOWED_UPLOADS, 'Недопустимый тип файла')
    return Response({'attachment': {'name': f.name, 'url': url, 'size': f.size}})
