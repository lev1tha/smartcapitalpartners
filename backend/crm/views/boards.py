"""Идеи, контент-календарь, SMM, бухгалтерия, маркетинг — перенос из PHP без изменения API."""
import re
from datetime import date

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import presenters as P
from .. import roles as R
from ..defaults import ACC_TEMPLATES, DEFAULT_SETTINGS
from ..models import (
    AccDoc, AccTask, BoardSettings, CalendarPost, Campaign, Idea, Lead, QuizResult,
    SmmTask, SocialAccount, TurnkeyRequest,
)
from ..permissions import require
from ..utils import ApiError, body, item_of, parse_date, s, to_decimal
from .tasks import save_upload


def _get_settings(key: str) -> dict:
    row = BoardSettings.objects.filter(pk=key).first()
    return row.data if row and row.data else DEFAULT_SETTINGS[key]()


def _put_settings(request, key: str) -> Response:
    settings = body(request).get('settings')
    if not isinstance(settings, dict):
        raise ApiError('Нет настроек')
    BoardSettings.objects.update_or_create(pk=key, defaults={'data': settings})
    return Response({'settings': settings})


def _id(request) -> str:
    return s(body(request).get('id'))


# ============================== Идеи ==============================

@api_view(['GET', 'POST'])
@require()
def ideas(request):
    if request.method == 'GET':
        return Response({'ideas': [P.idea(i) for i in Idea.objects.all()]})
    text = s(body(request).get('text'))
    if not text:
        raise ApiError('Пустая идея')
    u = request.user
    idea = Idea.objects.create(text=text, author=u, author_name=u.profile.name, author_role=u.profile.role)
    return Response({'idea': P.idea(idea)})


@api_view(['POST'])
@require()
def idea_delete(request):
    idea = Idea.objects.filter(pk=_id(request)).first()
    if idea is None:
        raise ApiError('Идея не найдена', 404)
    u = request.user
    own = idea.author_id == u.pk if idea.author_id else idea.author_name == u.profile.name
    if not own and not R.is_manager(u.profile.role):
        raise ApiError('Можно удалять только свои идеи', 403)
    idea.delete()
    return Response({'status': 'ok'})


# ============================== Контент-календарь ==============================

@api_view(['GET'])
@require(R.can_calendar, anon_status=403)
def accounts(request):
    return Response({'accounts': [P.account(a) for a in SocialAccount.objects.all()]})


@api_view(['POST'])
@require(R.can_edit_accounts, 'Добавлять аккаунты может управляющий/маркетолог', anon_status=403)
def account_save(request):
    item = item_of(request)
    if item is None or not s(item.get('name')):
        raise ApiError('Укажите название аккаунта')
    acc_id = s(item.get('id'))
    acc = SocialAccount.objects.filter(pk=acc_id).first() if acc_id else None
    if acc is None:
        last = SocialAccount.objects.count()
        acc = SocialAccount(position=last, **({'id': acc_id} if acc_id else {}))
    acc.name, acc.platform = s(item['name']), s(item.get('platform'))
    acc.save()
    return Response({'account': P.account(acc)})


@api_view(['POST'])
@require(R.is_manager, 'Удалять аккаунты может управляющий/директор', anon_status=403)
def account_delete(request):
    # посты аккаунта удаляются каскадом
    SocialAccount.objects.filter(pk=_id(request)).delete()
    return Response({'status': 'ok'})


@api_view(['GET'])
@require(R.can_calendar, anon_status=403)
def calendar(request):
    qs = CalendarPost.objects.all()
    account_id = s(request.query_params.get('accountId'))
    if account_id:
        qs = qs.filter(account_id=account_id)
    return Response({'posts': [P.post(p) for p in qs]})


@api_view(['POST'])
@require(R.can_calendar, anon_status=403)
def calendar_save(request):
    item = item_of(request)
    if item is None or not s(item.get('title')) or not s(item.get('date')):
        raise ApiError('Нужны дата и название поста')
    account_id = s(item.get('accountId'))
    if account_id and not SocialAccount.objects.filter(pk=account_id).exists():
        raise ApiError('Аккаунт не найден', 404)
    fields = {
        'account_id': account_id or None,
        'date': parse_date(item['date'], 'Дата поста'),
        'type': s(item.get('type')) or 'post',
        'title': s(item['title']),
        'note': s(item.get('note')),
        'status': s(item.get('status')) or 'idea',
        'link': s(item.get('link')),
        'updated_at': timezone.now(),
    }
    post_id = s(item.get('id'))
    if post_id:
        post = CalendarPost.objects.filter(pk=post_id).first()
        if post is None:
            raise ApiError('Пост не найден', 404)
        for k, v in fields.items():
            setattr(post, k, v)
        post.save()
    else:
        post = CalendarPost.objects.create(created_by_name=request.user.profile.name, **fields)
    return Response({'post': P.post(post)})


@api_view(['POST'])
@require(R.can_calendar, anon_status=403)
def calendar_delete(request):
    CalendarPost.objects.filter(pk=_id(request)).delete()
    return Response({'status': 'ok'})


# ============================== SMM ==============================

def _smm_qs(user):
    if R.is_manager(user.profile.role):
        return SmmTask.objects.all()
    return SmmTask.objects.filter(created_by=user)


@api_view(['GET'])
@require(R.can_smm, 'Нет доступа к SMM-дашборду', anon_status=403)
def smm_board(request):
    return Response({'tasks': [P.smm_task(t) for t in _smm_qs(request.user)], 'settings': _get_settings('smm')})


@api_view(['POST'])
@require(R.can_smm, 'Нет доступа', anon_status=403)
def smm_task_save(request):
    item = item_of(request)
    if item is None or not s(item.get('title')):
        raise ApiError('Укажите задачу')
    period = item.get('period') if item.get('period') in ('daily', 'weekly', 'monthly') else 'daily'
    fields = {
        'title': s(item['title']), 'period': period,
        'category': s(item.get('category')) or 'Контент',
        'priority': s(item.get('priority')) or 'medium',
        'due_date': s(item.get('dueDate')),
    }
    task_id = s(item.get('id'))
    if task_id:
        task = _smm_qs(request.user).filter(pk=task_id).first()
        if task is None:
            raise ApiError('Задача не найдена', 404)
        for k, v in fields.items():
            setattr(task, k, v)
        task.save()
    else:
        task = SmmTask.objects.create(created_by=request.user, created_by_login=request.user.username, **fields)
    return Response({'task': P.smm_task(task)})


@api_view(['POST'])
@require(R.can_smm, 'Нет доступа', anon_status=403)
def smm_task_toggle(request):
    task = _smm_qs(request.user).filter(pk=_id(request)).first()
    if task is None:
        raise ApiError('Задача не найдена', 404)
    task.is_completed = not task.is_completed
    task.save(update_fields=['is_completed'])
    return Response({'task': P.smm_task(task)})


@api_view(['POST'])
@require(R.can_smm, 'Нет доступа', anon_status=403)
def smm_task_delete(request):
    _smm_qs(request.user).filter(pk=_id(request)).delete()
    return Response({'status': 'ok'})


@api_view(['POST'])
@require(R.can_smm, 'Нет доступа', anon_status=403)
def smm_settings(request):
    return _put_settings(request, 'smm')


# ============================== Бухгалтерия ==============================

ACC_PERIODS = ('daily', 'monthly', 'quarterly', 'yearly')
ACC_STATUSES = ('not_started', 'in_progress', 'formed', 'submitted')


@api_view(['GET'])
@require(R.can_accounting, 'Нет доступа к бухгалтерскому дашборду', anon_status=403)
def acc_board(request):
    return Response({
        'tasks': [P.acc_task(t) for t in AccTask.objects.all()],
        'docs': [P.acc_doc(d) for d in AccDoc.objects.all()],
        'settings': _get_settings('acc'),
    })


@api_view(['POST'])
@require(R.can_accounting, 'Нет доступа', anon_status=403)
def acc_task_save(request):
    item = item_of(request)
    if item is None or not s(item.get('title')):
        raise ApiError('Укажите название')
    fields = {
        'title': s(item['title']),
        'period': item.get('period') if item.get('period') in ACC_PERIODS else 'monthly',
        'reporting_period': s(item.get('reportingPeriod')),
        'deadline': parse_date(item.get('deadline'), 'Дедлайн'),
        'status': item.get('status') if item.get('status') in ACC_STATUSES else 'not_started',
    }
    task_id = s(item.get('id'))
    if task_id:
        task = AccTask.objects.filter(pk=task_id).first()
        if task is None:
            raise ApiError('Задача не найдена', 404)
        for k, v in fields.items():
            setattr(task, k, v)
        task.save()
    else:
        task = AccTask.objects.create(created_by_name=request.user.profile.name, **fields)
    return Response({'task': P.acc_task(task)})


@api_view(['POST'])
@require(R.can_accounting, 'Нет доступа', anon_status=403)
def acc_task_status(request):
    data = body(request)
    status = s(data.get('status'))
    if status not in ACC_STATUSES:
        raise ApiError('Неверный статус')
    task = AccTask.objects.filter(pk=s(data.get('id'))).first()
    if task is None:
        raise ApiError('Задача не найдена', 404)
    task.status = status
    task.save(update_fields=['status'])
    return Response({'task': P.acc_task(task)})


@api_view(['POST'])
@require(R.can_accounting, 'Нет доступа', anon_status=403)
def acc_task_receipt(request):
    """Квиток (PDF/изображение) → статус «Сдано»."""
    f = request.FILES.get('file')
    if f is None:
        raise ApiError('Файл не получен', 400)
    url = save_upload(f, 'kvit_', {'pdf', 'png', 'jpg', 'jpeg'}, 'Квиток — PDF или изображение')
    task = AccTask.objects.filter(pk=s(request.data.get('id'))).first()
    if task is None:
        return Response({'url': url})
    task.receipt_file, task.status = url, 'submitted'
    task.save(update_fields=['receipt_file', 'status'])
    return Response({'task': P.acc_task(task)})


@api_view(['POST'])
@require(R.can_accounting, 'Нет доступа', anon_status=403)
def acc_task_delete(request):
    AccTask.objects.filter(pk=_id(request)).delete()
    return Response({'status': 'ok'})


@api_view(['POST'])
@require(R.can_accounting, 'Нет доступа', anon_status=403)
def acc_doc_save(request):
    item = item_of(request)
    if item is None or not s(item.get('counterparty')):
        raise ApiError('Укажите контрагента')
    fields = {'counterparty': s(item['counterparty']), 'type': s(item.get('type')) or 'Акт сверки',
              'status': s(item.get('status')) or 'requested'}
    doc_id = s(item.get('id'))
    doc = AccDoc.objects.filter(pk=doc_id).first() if doc_id else None
    if doc:
        for k, v in fields.items():
            setattr(doc, k, v)
        doc.save()
    else:
        doc = AccDoc.objects.create(**fields)
    return Response({'doc': P.acc_doc(doc)})


@api_view(['POST'])
@require(R.can_accounting, 'Нет доступа', anon_status=403)
def acc_doc_delete(request):
    AccDoc.objects.filter(pk=_id(request)).delete()
    return Response({'status': 'ok'})


@api_view(['POST'])
@require(R.can_accounting, 'Нет доступа', anon_status=403)
def acc_settings(request):
    return _put_settings(request, 'acc')


@api_view(['POST'])
@require(R.can_accounting, 'Нет доступа', anon_status=403)
def acc_generate(request):
    """Стандартные отчёты КР на месяц. Идемпотентно: (title, deadline) не дублируются."""
    month = s(body(request).get('month'))
    if not re.fullmatch(r'\d{4}-\d{2}', month):
        month = timezone.localdate().strftime('%Y-%m')
    y, m = map(int, month.split('-'))
    if not 1 <= m <= 12:
        raise ApiError('Неверный месяц')
    prev_y, prev_m = (y - 1, 12) if m == 1 else (y, m - 1)
    reporting = f'{prev_y:04d}-{prev_m:02d}'

    created = []
    with transaction.atomic():
        for tpl in ACC_TEMPLATES:
            if tpl['period'] in ('quarterly', 'yearly') and m not in tpl['months']:
                continue
            deadline = date(y, m, tpl['day'])
            if AccTask.objects.filter(title=tpl['title'], deadline=deadline).exists():
                continue
            created.append(AccTask.objects.create(
                title=tpl['title'], period=tpl['period'], reporting_period=reporting,
                deadline=deadline, status='not_started', created_by_name='Авто',
            ))
    return Response({'created': len(created), 'tasks': [P.acc_task(t) for t in created], 'month': month})


# ============================== Маркетинг ==============================

@api_view(['GET'])
@require(R.can_marketing, 'Нет доступа к маркетинговому дашборду', anon_status=403)
def mkt_board(request):
    today = timezone.localdate()
    month_start = timezone.make_aware(timezone.datetime(today.year, today.month, 1))
    sources = {'leads': Lead, 'quiz': QuizResult, 'turnkey': TurnkeyRequest}
    by_type, by_type_total = {}, {}
    for key, model in sources.items():
        agg = model.objects.aggregate(total=Count('id'), month=Count('id', filter=Q(created_at__gte=month_start)))
        by_type[key], by_type_total[key] = agg['month'], agg['total']
    return Response({
        'month': today.strftime('%Y-%m'),
        'submissionsMonth': sum(by_type.values()),
        'submissionsTotal': sum(by_type_total.values()),
        'byType': by_type,
        'byTypeTotal': by_type_total,
        'campaigns': [P.campaign(c) for c in Campaign.objects.all()],
        'settings': _get_settings('mkt'),
    })


@api_view(['POST'])
@require(R.can_marketing, 'Нет доступа', anon_status=403)
def mkt_campaign_save(request):
    item = item_of(request)
    if item is None or not s(item.get('name')):
        raise ApiError('Укажите название кампании')
    try:
        leads = int(float(item.get('leads') or 0))
    except (TypeError, ValueError):
        leads = 0
    fields = {
        'name': s(item['name']), 'channel': s(item.get('channel')) or 'Instagram',
        'status': item.get('status') if item.get('status') in ('active', 'paused', 'done') else 'active',
        'budget': to_decimal(item.get('budget'), 'Бюджет'), 'spent': to_decimal(item.get('spent'), 'Потрачено'),
        'leads': leads,
    }
    camp_id = s(item.get('id'))
    camp = Campaign.objects.filter(pk=camp_id).first() if camp_id else None
    if camp:
        for k, v in fields.items():
            setattr(camp, k, v)
        camp.save()
    else:
        camp = Campaign.objects.create(**fields)
    return Response({'campaign': P.campaign(camp)})


@api_view(['POST'])
@require(R.can_marketing, 'Нет доступа', anon_status=403)
def mkt_campaign_delete(request):
    Campaign.objects.filter(pk=_id(request)).delete()
    return Response({'status': 'ok'})


@api_view(['POST'])
@require(R.can_marketing, 'Нет доступа', anon_status=403)
def mkt_settings(request):
    return _put_settings(request, 'mkt')
