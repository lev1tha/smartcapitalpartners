"""
Документы (база знаний), центр уведомлений, глобальный поиск (Cmd+K),
журнал действий, права на поля, пользовательские свойства, настройки уведомлений.
"""
from datetime import time

from django.db.models import Q
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import roles as R
from ..audit import record
from ..blocks import blocks_text, clean_blocks
from ..models import (
    PIPELINES, AuditLog, Client, Deal, Document, FieldDefinition, FieldPermission, Lead,
    Notification, Profile, QuizResult, TurnkeyRequest,
)
from ..permissions import FIELD_REGISTRY, field_access, require
from ..utils import ApiError, body, iso, item_of, s


# ------------------------------ документы ------------------------------

def _doc_brief(d: Document) -> dict:
    return {'id': d.id, 'title': d.title, 'parentId': d.parent_id or '', 'clientId': d.client_id or '',
            'dealId': d.deal_id or '', 'updatedAt': iso(d.updated_at),
            'updatedBy': d.updated_by.profile.name if d.updated_by_id else ''}


@api_view(['GET'])
@require()
def doc_list(request):
    qs = Document.objects.select_related('updated_by__profile')
    for key, field in (('clientId', 'client_id'), ('dealId', 'deal_id')):
        v = s(request.query_params.get(key))
        if v:
            qs = qs.filter(**{field: v})
    return Response({'documents': [_doc_brief(d) for d in qs]})


@api_view(['GET'])
@require()
def doc_detail(request, doc_id):
    d = Document.objects.select_related('updated_by__profile', 'client', 'deal').filter(pk=doc_id).first()
    if d is None:
        raise ApiError('Документ не найден', 404)
    out = _doc_brief(d)
    out.update({
        'content': d.content or [], 'createdAt': iso(d.created_at),
        'clientName': d.client.name if d.client_id else '', 'dealTitle': d.deal.title if d.deal_id else '',
        'children': [_doc_brief(c) for c in d.children.select_related('updated_by__profile')],
    })
    return Response({'document': out})


@api_view(['POST'])
@require()
def doc_save(request):
    item = item_of(request)
    if item is None:
        raise ApiError('Нет данных документа')
    did = s(item.get('id'))
    d = Document.objects.filter(pk=did).first() if did else None
    is_new = d is None
    if is_new:
        d = Document(created_by=request.user)
    if 'title' in item:
        d.title = s(item['title'])[:300] or 'Без названия'
    if 'content' in item:
        d.content = clean_blocks(item['content'])
        d.plain_text = blocks_text(d.content)
    if 'parentId' in item:
        pid = s(item['parentId'])
        if pid and pid == d.id:
            raise ApiError('Документ не может быть вложен сам в себя')
        d.parent_id = pid or None
    for key, model, attr in (('clientId', Client, 'client_id'), ('dealId', Deal, 'deal_id')):
        if key in item:
            v = s(item[key])
            if v and not model.objects.filter(pk=v).exists():
                raise ApiError('Связанная запись не найдена', 404)
            setattr(d, attr, v or None)
    d.updated_by = request.user
    d.save()
    if is_new:
        record(request.user, 'create', 'document', d.id, f'Создан документ «{d.title}»')
    return Response({'document': {**_doc_brief(d), 'content': d.content}})


@api_view(['POST'])
@require()
def doc_delete(request):
    did = s(body(request).get('id'))
    d = Document.objects.filter(pk=did).first()
    if d is None:
        raise ApiError('Документ не найден', 404)
    if d.created_by_id != request.user.pk and not R.is_manager(request.user.profile.role):
        raise ApiError('Удалять может автор или руководитель', 403)
    title = d.title
    d.delete()
    record(request.user, 'delete', 'document', did, f'Удалён документ «{title}»')
    return Response({'status': 'ok'})


# ------------------------------ уведомления ------------------------------

def _present_notification(n: Notification) -> dict:
    return {'id': n.id, 'title': n.title, 'body': n.body, 'kind': n.kind, 'priority': n.priority,
            'link': {'type': n.link_type, 'id': n.link_id} if n.link_type else None,
            'isRead': n.is_read, 'delivered': n.delivered, 'createdAt': iso(n.created_at)}


@api_view(['GET'])
@require()
def notifications(request):
    qs = Notification.objects.filter(user=request.user)
    unread = qs.filter(is_read=False).count()
    only_unread = s(request.query_params.get('unread')) == '1'
    items = (qs.filter(is_read=False) if only_unread else qs)[:50]
    return Response({'notifications': [_present_notification(n) for n in items], 'unread': unread})


@api_view(['POST'])
@require()
def notifications_read(request):
    """{ids: [...]} — отметить прочитанными; {all: true} — всё."""
    data = body(request)
    qs = Notification.objects.filter(user=request.user, is_read=False)
    if data.get('all'):
        qs.update(is_read=True)
    else:
        ids = [i for i in (data.get('ids') or []) if isinstance(i, int)]
        qs.filter(id__in=ids).update(is_read=True)
    return Response({'unread': Notification.objects.filter(user=request.user, is_read=False).count()})


@api_view(['GET', 'POST'])
@require()
def notification_settings(request):
    p: Profile = request.user.profile
    if request.method == 'POST':
        data = body(request)
        if 'telegramChatId' in data:
            p.telegram_chat_id = s(data['telegramChatId'])[:40]
        if 'notifyTelegram' in data:
            p.notify_telegram = bool(data['notifyTelegram'])
        if data.get('telegramMinPriority') in ('low', 'normal', 'high', 'urgent'):
            p.telegram_min_priority = data['telegramMinPriority']
        if 'dndEnabled' in data:
            p.dnd_enabled = bool(data['dndEnabled'])
        for key, attr in (('dndStart', 'dnd_start'), ('dndEnd', 'dnd_end')):
            if key in data:
                try:
                    hh, mm = map(int, s(data[key]).split(':'))
                    setattr(p, attr, time(hh, mm))
                except (ValueError, TypeError):
                    raise ApiError('Время в формате ЧЧ:ММ')
        p.save()
    return Response({'settings': {
        'telegramChatId': p.telegram_chat_id, 'notifyTelegram': p.notify_telegram,
        'telegramMinPriority': p.telegram_min_priority, 'dndEnabled': p.dnd_enabled,
        'dndStart': p.dnd_start.strftime('%H:%M'), 'dndEnd': p.dnd_end.strftime('%H:%M'),
    }})


@api_view(['POST'])
@require()
def notification_test(request):
    """Пробное сообщение в Telegram сотрудника — проверить chat_id."""
    from ..notify import send_telegram
    p = request.user.profile
    if not p.telegram_chat_id:
        raise ApiError('Укажите chat_id')
    ok, err = send_telegram(p.telegram_chat_id, 'Smart Capital Partners CRM: уведомления подключены')
    if not ok:
        raise ApiError(err or 'Не удалось отправить', 502)
    return Response({'status': 'ok'})


# ------------------------------ поиск ------------------------------

@api_view(['GET'])
@require()
def search(request):
    """Cmd+K: задачи, клиенты, сделки, документы, заявки — по правам роли."""
    q = s(request.query_params.get('q'))
    if len(q) < 2:
        return Response({'results': []})
    role = request.user.profile.role
    fa = field_access(request)
    results = []

    from .tasks import visible_tasks
    for t in visible_tasks(request.user).filter(Q(title__icontains=q) | Q(description__icontains=q))[:8]:
        results.append({'type': 'task', 'id': t.id, 'title': t.title,
                        'subtitle': f'{R.TASK_STATUSES.get(t.status, t.status)} · {R.ROLES.get(t.assignee, t.assignee or "без исполнителя")}'})
    if R.can_crm(role):
        cq = Q(name__icontains=q) | Q(company__icontains=q)
        if fa.can_view('client', 'phone'):
            cq |= Q(phone__icontains=q)
        if fa.can_view('client', 'email'):
            cq |= Q(email__icontains=q)
        for c in Client.objects.filter(cq)[:6]:
            results.append({'type': 'client', 'id': c.id, 'title': c.name, 'subtitle': c.company or dict(Client.STATUSES)[c.status]})
        for d in Deal.objects.select_related('client').filter(Q(title__icontains=q) | Q(client__name__icontains=q))[:6]:
            labels = dict(PIPELINES[d.pipeline]['stages'])
            results.append({'type': 'deal', 'id': d.id, 'title': d.title, 'subtitle': f'{d.client.name} · {labels.get(d.stage, d.stage)}'})
    for doc in Document.objects.filter(title__icontains=q)[:6]:
        results.append({'type': 'document', 'id': doc.id, 'title': doc.title, 'subtitle': 'Документ'})
    # Поиск по телу документов: JSON-поле, поэтому ищем по сериализованному тексту
    if len(results) < 20:
        for doc in Document.objects.exclude(title__icontains=q).filter(plain_text__icontains=q)[:4]:
            snippet = next((b['text'] for b in doc.content if q.lower() in b.get('text', '').lower()), '')
            results.append({'type': 'document', 'id': doc.id, 'title': doc.title, 'subtitle': snippet[:80]})
    access = R.submission_access(role)
    if 'leads' in access:
        for r in Lead.objects.filter(Q(name__icontains=q) | Q(phone__icontains=q))[:4]:
            results.append({'type': 'submission', 'id': 'leads', 'title': r.name, 'subtitle': f'Заявка · {r.phone}'})
    if 'quiz' in access:
        for r in QuizResult.objects.filter(Q(name__icontains=q) | Q(phone__icontains=q))[:4]:
            results.append({'type': 'submission', 'id': 'quiz', 'title': r.name, 'subtitle': f'Тест · {r.score}/{r.max_score}'})
    if 'turnkey' in access:
        for r in TurnkeyRequest.objects.filter(Q(name__icontains=q) | Q(phone__icontains=q))[:4]:
            results.append({'type': 'submission', 'id': 'turnkey', 'title': r.name, 'subtitle': f'Под ключ · {r.sphere or r.city}'})
    return Response({'results': results[:30]})


# ------------------------------ журнал ------------------------------

@api_view(['GET'])
@require(R.can_view_logs, anon_status=403)
def logs(request):
    fa = field_access(request)
    qs = AuditLog.objects.select_related('actor__profile')
    et, eid = s(request.query_params.get('entityType')), s(request.query_params.get('entityId'))
    if et:
        qs = qs.filter(entity_type=et)
    if eid:
        qs = qs.filter(entity_id=eid)
    items = []
    for l in qs[:200]:
        changes = l.changes or {}
        # скрытые для роли финансовые поля не показываем даже в журнале
        resource = 'deal' if l.entity_type == 'deal' else 'client' if l.entity_type == 'client' else None
        if resource:
            changes = {k: (v if fa.can_view(resource, k) else ['•••', '•••']) for k, v in changes.items()}
        items.append({'id': l.id, 'actor': l.actor_name, 'action': l.action, 'entityType': l.entity_type,
                      'entityId': l.entity_id, 'summary': l.summary, 'changes': changes, 'createdAt': iso(l.created_at)})
    return Response({'logs': items})


# ------------------------------ права на поля ------------------------------

@api_view(['GET', 'POST'])
@require(lambda r: r == 'director', 'Матрицу прав меняет только директор', anon_status=403)
def field_permissions(request):
    """GET — матрица для всех ролей; POST {role, resource, field, canView, canEdit}."""
    if request.method == 'POST':
        data = body(request)
        role, resource, field = s(data.get('role')), s(data.get('resource')), s(data.get('field'))
        if role not in R.ROLES or role == 'director':
            raise ApiError('Неверная роль')
        if field not in FIELD_REGISTRY.get(resource, {}):
            raise ApiError('Неизвестное поле')
        can_view = bool(data.get('canView', True))
        FieldPermission.objects.update_or_create(
            role=role, resource=resource, field=field,
            defaults={'can_view': can_view, 'can_edit': can_view and bool(data.get('canEdit', False))},
        )
        record(request.user, 'update', 'permissions', f'{role}:{resource}.{field}',
               f'Права {R.ROLES[role]} на {FIELD_REGISTRY[resource][field][0]}')
    from ..permissions import FieldAccess
    return Response({
        'fields': {res: [{'id': f, 'label': spec[0]} for f, spec in fields.items()] for res, fields in FIELD_REGISTRY.items()},
        'roles': {role: FieldAccess(role).matrix() for role in R.ROLES},
        'roleLabels': R.ROLES,
    })


# ------------------------------ пользовательские свойства ------------------------------

def _present_field(f: FieldDefinition) -> dict:
    return {'id': f.id, 'resource': f.resource, 'label': f.label, 'type': f.type, 'options': f.options or [], 'position': f.position}


@api_view(['GET'])
@require()
def field_definitions(request):
    resource = s(request.query_params.get('resource'))
    qs = FieldDefinition.objects.all()
    if resource:
        qs = qs.filter(resource=resource)
    return Response({'fields': [_present_field(f) for f in qs], 'types': dict(FieldDefinition.TYPES)})


@api_view(['POST'])
@require(R.is_manager, 'Свойства добавляет управляющий или директор', anon_status=403)
def field_definition_save(request):
    item = item_of(request)
    if item is None or not s(item.get('label')):
        raise ApiError('Укажите название свойства')
    fid = s(item.get('id'))
    f = FieldDefinition.objects.filter(pk=fid).first() if fid else None
    if f is None:
        resource = s(item.get('resource'))
        if resource not in dict(FieldDefinition.RESOURCES):
            raise ApiError('Неизвестный раздел')
        f = FieldDefinition(resource=resource, position=FieldDefinition.objects.filter(resource=resource).count())
    f.label = s(item['label'])[:80]
    if item.get('type') in dict(FieldDefinition.TYPES):
        f.type = item['type']
    if isinstance(item.get('options'), list):
        f.options = [s(o) for o in item['options'] if s(o)][:50]
    f.save()
    return Response({'field': _present_field(f)})


@api_view(['POST'])
@require(R.is_manager, anon_status=403)
def field_definition_delete(request):
    FieldDefinition.objects.filter(pk=s(body(request).get('id'))).delete()
    return Response({'status': 'ok'})

