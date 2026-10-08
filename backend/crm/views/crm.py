"""
Smart Capital Pipeline: клиенты, сделки, платежи и P&L.

Финансовые поля (amount, commission, платежи) выдаются по матрице прав:
скрытое поле = null + его имя в `hidden`. Попытка записать скрытое/защищённое
поле → 403.
"""
from collections import defaultdict
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import roles as R
from ..audit import diff, record, snapshot
from ..blocks import clean_blocks
from ..models import CLOSED_STAGES, PIPELINES, Client, Deal, Document, Payment, Task
from ..notify import notify
from ..permissions import field_access, require
from ..utils import ApiError, body, iso, iso_date, item_of, num, parse_date, s, to_decimal

User = get_user_model()

CLIENT_FIELDS = ['name', 'company', 'kind', 'status', 'email', 'phone', 'telegram', 'tags', 'custom_fields']
DEAL_FIELDS = ['title', 'client_id', 'pipeline', 'stage', 'amount', 'commission', 'currency',
               'probability', 'expected_close', 'custom_fields']


# ------------------------------ представление ------------------------------

def _user_brief(u):
    return {'id': u.username, 'name': u.profile.name, 'role': u.profile.role} if u else None


def pnl(payments) -> dict:
    """P&L по списку платежей: поступления, расходы, итог."""
    income = sum((p.amount for p in payments if p.direction == 'in'), Decimal('0'))
    expense = sum((p.amount for p in payments if p.direction == 'out'), Decimal('0'))
    return {'income': num(income), 'expense': num(expense), 'net': num(income - expense)}


def present_payment(p: Payment) -> dict:
    return {
        'id': p.id, 'dealId': p.deal_id, 'date': iso_date(p.date), 'amount': num(p.amount),
        'direction': p.direction, 'kind': p.kind, 'note': p.note,
        'createdBy': _user_brief(p.created_by), 'createdAt': iso(p.created_at),
    }


def present_deal(d: Deal, fa, payments=None, with_notes=False) -> dict:
    out = {
        'id': d.id, 'title': d.title, 'clientId': d.client_id, 'clientName': d.client.name,
        'pipeline': d.pipeline, 'stage': d.stage, 'position': d.position,
        'owner': _user_brief(d.owner), 'currency': d.currency,
        'amount': num(d.amount) if fa.can_view('deal', 'amount') else None,
        'commission': num(d.commission) if fa.can_view('deal', 'commission') else None,
        'probability': d.probability if fa.can_view('deal', 'probability') else None,
        'expectedClose': iso_date(d.expected_close), 'closedAt': iso(d.closed_at),
        'customFields': d.custom_fields or {},
        'createdAt': iso(d.created_at), 'updatedAt': iso(d.updated_at),
        'hidden': fa.hidden('deal'),
        'editable': {f: fa.can_edit('deal', f) for f in ('amount', 'commission', 'probability')},
    }
    if with_notes:
        out['notes'] = d.notes or []
    if payments is not None and fa.can_view('finance', 'payments'):
        out['payments'] = [present_payment(p) for p in payments]
        out['pnl'] = pnl(payments)
    return out


def present_client(c: Client, fa, with_notes=False) -> dict:
    out = {
        'id': c.id, 'name': c.name, 'company': c.company, 'kind': c.kind, 'status': c.status,
        'email': c.email if fa.can_view('client', 'email') else None,
        'phone': c.phone if fa.can_view('client', 'phone') else None,
        'telegram': c.telegram if fa.can_view('client', 'telegram') else None,
        'owner': _user_brief(c.owner), 'tags': c.tags or [], 'customFields': c.custom_fields or {},
        'createdAt': iso(c.created_at), 'updatedAt': iso(c.updated_at),
        'hidden': fa.hidden('client'),
    }
    if with_notes:
        out['notes'] = c.notes or []
    return out


def _owner(item: dict, current):
    """ownerId → User; пустая строка снимает владельца; отсутствие ключа — текущий."""
    if 'ownerId' not in item:
        return current
    login = s(item.get('ownerId'))
    if not login:
        return None
    u = User.objects.filter(username=login, profile__isnull=False).first()
    if u is None:
        raise ApiError('Сотрудник не найден', 404)
    return u


# ------------------------------ клиенты ------------------------------

@api_view(['GET'])
@require(R.can_crm, 'Нет доступа к клиентам', anon_status=403)
def client_list(request):
    fa = field_access(request)
    qs = Client.objects.select_related('owner__profile').annotate(
        deals_count=Count('deals', distinct=True),
        open_deals=Count('deals', filter=~Q(deals__stage__in=CLOSED_STAGES), distinct=True),
    )
    q = s(request.query_params.get('q'))
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(company__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q))
    status = s(request.query_params.get('status'))
    if status:
        qs = qs.filter(status=status)
    items = []
    for c in qs:
        item = present_client(c, fa)
        item['dealsCount'], item['openDeals'] = c.deals_count, c.open_deals
        items.append(item)
    return Response({'clients': items, 'statuses': dict(Client.STATUSES), 'kinds': dict(Client.KINDS)})


@api_view(['GET'])
@require(R.can_crm, 'Нет доступа к клиентам', anon_status=403)
def client_detail(request, client_id):
    """Профиль клиента: карточка + сделки + платежи/P&L + задачи + документы — одним запросом."""
    fa = field_access(request)
    c = Client.objects.select_related('owner__profile').filter(pk=client_id).first()
    if c is None:
        raise ApiError('Клиент не найден', 404)
    deals = list(c.deals.select_related('client', 'owner__profile'))
    payments_by_deal = defaultdict(list)
    all_payments = []
    if fa.can_view('finance', 'payments'):
        for p in Payment.objects.filter(deal__client=c).select_related('created_by__profile'):
            payments_by_deal[p.deal_id].append(p)
            all_payments.append(p)
    out = present_client(c, fa, with_notes=True)
    out['deals'] = [present_deal(d, fa, payments_by_deal.get(d.id, [])) for d in deals]
    if fa.can_view('finance', 'payments'):
        out['pnl'] = pnl(all_payments)
        out['payments'] = [present_payment(p) for p in sorted(all_payments, key=lambda p: (p.date, p.created_at), reverse=True)]
        total = sum((d.amount for d in deals if d.stage == 'won'), Decimal('0'))
        out['wonAmount'] = num(total) if fa.can_view('deal', 'amount') else None
    out['tasks'] = [{'id': t.id, 'title': t.title, 'status': t.status, 'dueDate': iso_date(t.due_date),
                     'assignee': t.assignee, 'priority': t.priority}
                    for t in Task.objects.filter(Q(client=c) | Q(deal__client=c)).distinct()]
    out['documents'] = [{'id': d.id, 'title': d.title, 'updatedAt': iso(d.updated_at)}
                        for d in Document.objects.filter(Q(client=c) | Q(deal__client=c)).distinct()]
    return Response({'client': out})


@api_view(['POST'])
@require(R.can_edit_crm, 'Нет прав на редактирование клиентов', anon_status=403)
def client_save(request):
    fa = field_access(request)
    item = item_of(request)
    if item is None or not s(item.get('name')):
        raise ApiError('Укажите имя клиента')
    fa.assert_editable('client', item, ['email', 'phone', 'telegram'])

    with transaction.atomic():
        cid = s(item.get('id'))
        c = Client.objects.select_for_update().filter(pk=cid).first() if cid else None
        before = snapshot(c, CLIENT_FIELDS) if c else {}
        if c is None:
            c = Client(owner=request.user)
        c.name = s(item['name'])
        for key, attr in (('company', 'company'), ('email', 'email'), ('phone', 'phone'), ('telegram', 'telegram')):
            if key in item:
                setattr(c, attr, s(item[key]))
        if item.get('kind') in dict(Client.KINDS):
            c.kind = item['kind']
        if item.get('status') in dict(Client.STATUSES):
            c.status = item['status']
        if isinstance(item.get('tags'), list):
            c.tags = [s(t) for t in item['tags'] if s(t)][:30]
        if isinstance(item.get('customFields'), dict):
            c.custom_fields = item['customFields']
        if 'notes' in item:
            c.notes = clean_blocks(item['notes'])
        c.owner = _owner(item, c.owner)
        c.save()
        changes = diff(before, snapshot(c, CLIENT_FIELDS))
        record(request.user, 'update' if before else 'create', 'client', c.id,
               f'{"Изменён" if before else "Создан"} клиент «{c.name}»', changes)
    c = Client.objects.select_related('owner__profile').get(pk=c.pk)
    return Response({'client': present_client(c, fa, with_notes=True)})


@api_view(['POST'])
@require(R.is_manager, anon_status=403)
def client_delete(request):
    cid = s(body(request).get('id'))
    c = Client.objects.filter(pk=cid).first()
    if c is None:
        raise ApiError('Клиент не найден', 404)
    name = c.name
    c.delete()
    record(request.user, 'delete', 'client', cid, f'Удалён клиент «{name}»')
    return Response({'status': 'ok'})


# ------------------------------ сделки ------------------------------

def _stage_ok(pipeline: str, stage: str) -> bool:
    return pipeline in PIPELINES and stage in dict(PIPELINES[pipeline]['stages'])


@api_view(['GET'])
@require(R.can_crm, 'Нет доступа к сделкам', anon_status=403)
def deal_list(request):
    """Все сделки воронки (или всех воронок) + агрегаты по этапам для доски."""
    fa = field_access(request)
    qs = Deal.objects.select_related('client', 'owner__profile')
    pipeline = s(request.query_params.get('pipeline'))
    if pipeline:
        if pipeline not in PIPELINES:
            raise ApiError('Неизвестная воронка', 400)
        qs = qs.filter(pipeline=pipeline)
    q = s(request.query_params.get('q'))
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(client__name__icontains=q))
    deals = list(qs)
    totals = {}
    if fa.can_view('deal', 'amount'):
        for d in deals:
            key = f'{d.pipeline}:{d.stage}'
            totals[key] = totals.get(key, Decimal('0')) + d.amount
    return Response({
        'deals': [present_deal(d, fa) for d in deals],
        'pipelines': {k: {'label': v['label'], 'stages': [{'id': i, 'label': l} for i, l in v['stages']]}
                      for k, v in PIPELINES.items()},
        'stageTotals': {k: num(v) for k, v in totals.items()} if totals else None,
        'currencies': dict(Deal.CURRENCIES),
        'hidden': fa.hidden('deal'),
    })


@api_view(['GET'])
@require(R.can_crm, 'Нет доступа к сделкам', anon_status=403)
def deal_detail(request, deal_id):
    fa = field_access(request)
    d = Deal.objects.select_related('client', 'owner__profile').filter(pk=deal_id).first()
    if d is None:
        raise ApiError('Сделка не найдена', 404)
    payments = list(d.payments.select_related('created_by__profile')) if fa.can_view('finance', 'payments') else None
    out = present_deal(d, fa, payments, with_notes=True)
    out['tasks'] = [{'id': t.id, 'title': t.title, 'status': t.status, 'dueDate': iso_date(t.due_date),
                     'assignee': t.assignee, 'priority': t.priority} for t in d.tasks.all()]
    out['documents'] = [{'id': doc.id, 'title': doc.title, 'updatedAt': iso(doc.updated_at)} for doc in d.documents.all()]
    out['paymentKinds'] = dict(Payment.KINDS)
    out['canEditPayments'] = fa.can_edit('finance', 'payments')
    return Response({'deal': out})


@api_view(['POST'])
@require(R.can_edit_crm, 'Нет прав на редактирование сделок', anon_status=403)
def deal_save(request):
    fa = field_access(request)
    item = item_of(request)
    if item is None or not s(item.get('title')):
        raise ApiError('Укажите название сделки')
    fa.assert_editable('deal', item, ['amount', 'commission', 'probability'])

    with transaction.atomic():
        did = s(item.get('id'))
        d = Deal.objects.select_for_update().filter(pk=did).first() if did else None
        before = snapshot(d, DEAL_FIELDS) if d else {}
        is_new = d is None
        if is_new:
            cid = s(item.get('clientId'))
            client = Client.objects.filter(pk=cid).first()
            if client is None:
                raise ApiError('Выберите клиента', 422 if not cid else 404)
            pipeline = s(item.get('pipeline')) or 'sales'
            if pipeline not in PIPELINES:
                raise ApiError('Неизвестная воронка')
            d = Deal(client=client, pipeline=pipeline, stage=PIPELINES[pipeline]['stages'][0][0], owner=request.user)
            last = Deal.objects.filter(pipeline=pipeline, stage=d.stage).aggregate(m=Max('position'))['m']
            d.position = (last or 0) + 1
        elif 'clientId' in item and s(item['clientId']) != d.client_id:
            client = Client.objects.filter(pk=s(item['clientId'])).first()
            if client is None:
                raise ApiError('Клиент не найден', 404)
            d.client = client

        d.title = s(item['title'])
        if 'amount' in item:
            d.amount = to_decimal(item['amount'], 'Сумма')
        if 'commission' in item:
            d.commission = to_decimal(item['commission'], 'Комиссия')
        if item.get('currency') in dict(Deal.CURRENCIES):
            d.currency = item['currency']
        if 'probability' in item:
            try:
                d.probability = max(0, min(100, int(float(item['probability'] or 0))))
            except (TypeError, ValueError):
                raise ApiError('Вероятность: число 0–100')
        if 'expectedClose' in item:
            d.expected_close = parse_date(item['expectedClose'], 'Ожидаемое закрытие')
        if isinstance(item.get('customFields'), dict):
            d.custom_fields = item['customFields']
        if 'notes' in item:
            d.notes = clean_blocks(item['notes'])
        if 'stage' in item and not is_new:
            stage = s(item['stage'])
            if not _stage_ok(d.pipeline, stage):
                raise ApiError('Неизвестный этап')
            _set_stage(d, stage)
        d.owner = _owner(item, d.owner)
        d.save()

        changes = diff(before, snapshot(d, DEAL_FIELDS))
        record(request.user, 'create' if is_new else 'update', 'deal', d.id,
               f'{"Создана" if is_new else "Изменена"} сделка «{d.title}»', changes)
        if is_new:
            notify([u for u in User.objects.filter(profile__role__in=R.MANAGERS)], 'Новая сделка',
                   f'{d.title} — {d.client.name}', kind='deal', link=('deal', d.id), exclude=request.user)
    d = Deal.objects.select_related('client', 'owner__profile').get(pk=d.pk)
    return Response({'deal': present_deal(d, fa, with_notes=True)})


def _set_stage(d: Deal, stage: str) -> None:
    if stage == d.stage:
        return
    d.stage = stage
    d.closed_at = timezone.now() if stage in CLOSED_STAGES else None
    if stage == 'won':
        d.probability = 100
    elif stage == 'lost':
        d.probability = 0


@api_view(['POST'])
@require(R.can_edit_crm, 'Нет прав на редактирование сделок', anon_status=403)
def deal_move(request):
    """Drag-and-drop по доске: {id, stage, position?}. Пересчитывает порядок в колонке."""
    fa = field_access(request)
    data = body(request)
    stage = s(data.get('stage'))
    with transaction.atomic():
        d = Deal.objects.select_for_update().select_related('client').filter(pk=s(data.get('id'))).first()
        if d is None:
            raise ApiError('Сделка не найдена', 404)
        if not _stage_ok(d.pipeline, stage):
            raise ApiError('Неизвестный этап')
        old = d.stage
        _set_stage(d, stage)
        siblings = list(Deal.objects.filter(pipeline=d.pipeline, stage=stage).exclude(pk=d.pk).order_by('position', '-updated_at'))
        try:
            pos = int(data.get('position'))
        except (TypeError, ValueError):
            pos = len(siblings)
        siblings.insert(max(0, min(pos, len(siblings))), d)
        for i, x in enumerate(siblings):
            if x.position != i or x.pk == d.pk:
                x.position = i
                x.save(update_fields=['position'] if x.pk != d.pk else ['position', 'stage', 'closed_at', 'probability', 'updated_at'])
        if old != stage:
            labels = dict(PIPELINES[d.pipeline]['stages'])
            record(request.user, 'stage', 'deal', d.id, f'«{d.title}»: {labels[old]} → {labels[stage]}', {'stage': (old, stage)})
            if stage in CLOSED_STAGES:
                notify(User.objects.filter(profile__role__in=R.MANAGERS),
                       'Сделка закрыта' if stage == 'won' else 'Сделка потеряна',
                       f'{d.title} — {d.client.name}', kind='deal', priority='high',
                       link=('deal', d.id), exclude=request.user)
    d = Deal.objects.select_related('client', 'owner__profile').get(pk=d.pk)
    return Response({'deal': present_deal(d, fa)})


@api_view(['POST'])
@require(R.is_manager, anon_status=403)
def deal_delete(request):
    did = s(body(request).get('id'))
    d = Deal.objects.filter(pk=did).first()
    if d is None:
        raise ApiError('Сделка не найдена', 404)
    title = d.title
    d.delete()
    record(request.user, 'delete', 'deal', did, f'Удалена сделка «{title}»')
    return Response({'status': 'ok'})


# ------------------------------ платежи ------------------------------

def _payments_access(request):
    fa = field_access(request)
    if not fa.can_edit('finance', 'payments'):
        raise ApiError('Нет прав на изменение платежей', 403)
    return fa


@api_view(['POST'])
@require(R.can_crm, anon_status=403)
def payment_save(request):
    fa = _payments_access(request)
    item = item_of(request)
    if item is None:
        raise ApiError('Нет данных платежа')
    amount = to_decimal(item.get('amount'), 'Сумма')
    if amount <= 0:
        raise ApiError('Сумма платежа должна быть больше нуля')
    with transaction.atomic():
        pid = s(item.get('id'))
        p = Payment.objects.select_for_update().filter(pk=pid).first() if pid else None
        if p is None:
            deal = Deal.objects.filter(pk=s(item.get('dealId'))).first()
            if deal is None:
                raise ApiError('Сделка не найдена', 404)
            p = Payment(deal=deal, created_by=request.user)
        p.amount = amount
        p.direction = item.get('direction') if item.get('direction') in ('in', 'out') else p.direction
        p.kind = item.get('kind') if item.get('kind') in dict(Payment.KINDS) else p.kind
        p.note = s(item.get('note'))[:300]
        if 'date' in item:
            p.date = parse_date(item['date'], 'Дата платежа') or timezone.localdate()
        p.save()
        record(request.user, 'update' if pid else 'create', 'payment', p.id,
               f'Платёж {num(p.amount)} {p.deal.currency} по «{p.deal.title}»')
    payments = list(p.deal.payments.select_related('created_by__profile'))
    return Response({'payment': present_payment(p), 'pnl': pnl(payments), 'payments': [present_payment(x) for x in payments]})


@api_view(['POST'])
@require(R.can_crm, anon_status=403)
def payment_delete(request):
    _payments_access(request)
    pid = s(body(request).get('id'))
    p = Payment.objects.select_related('deal').filter(pk=pid).first()
    if p is None:
        raise ApiError('Платёж не найден', 404)
    deal = p.deal
    p.delete()
    record(request.user, 'delete', 'payment', pid, f'Удалён платёж по «{deal.title}»')
    payments = list(deal.payments.all())
    return Response({'status': 'ok', 'pnl': pnl(payments), 'payments': [present_payment(x) for x in payments]})


# ------------------------------ сводка для дашборда ------------------------------

@api_view(['GET'])
@require()
def dashboard(request):
    """Главный экран: мои задачи, дедлайны, воронка, P&L месяца — с учётом прав на поля."""
    fa = field_access(request)
    user = request.user
    role = user.profile.role
    today = timezone.localdate()
    month_start = today.replace(day=1)

    from .tasks import visible_tasks
    tasks = visible_tasks(user).exclude(status__in=('done', 'rejected'))
    overdue = [t for t in tasks if t.due_date and t.due_date < today]
    soon = [t for t in tasks if t.due_date and today <= t.due_date <= today.fromordinal(today.toordinal() + 7)]
    present = lambda t: {'id': t.id, 'title': t.title, 'status': t.status, 'dueDate': iso_date(t.due_date),
                         'priority': t.priority, 'assignee': t.assignee,
                         'clientName': t.client.name if t.client_id else ''}

    out = {
        'today': iso_date(today),
        'tasks': {
            'open': tasks.count(),
            'review': tasks.filter(status='review').count(),
            'overdue': [present(t) for t in sorted(overdue, key=lambda t: t.due_date)[:10]],
            'soon': [present(t) for t in sorted(soon, key=lambda t: t.due_date)[:10]],
        },
        'sections': R.section_access(role),
    }
    if R.can_crm(role):
        open_deals = Deal.objects.exclude(stage__in=CLOSED_STAGES)
        funnel = []
        for pid, p in PIPELINES.items():
            stages = []
            for sid, label in p['stages']:
                agg = Deal.objects.filter(pipeline=pid, stage=sid).aggregate(n=Count('id'), total=Sum('amount'))
                stages.append({'id': sid, 'label': label, 'count': agg['n'],
                               'amount': num(agg['total'] or Decimal('0')) if fa.can_view('deal', 'amount') else None})
            funnel.append({'id': pid, 'label': p['label'], 'stages': stages})
        out['pipeline'] = {
            'open': open_deals.count(),
            'wonMonth': Deal.objects.filter(stage='won', closed_at__date__gte=month_start).count(),
            'openAmount': num(open_deals.aggregate(t=Sum('amount'))['t'] or Decimal('0')) if fa.can_view('deal', 'amount') else None,
            'funnel': funnel,
            'recent': [present_deal(d, fa) for d in Deal.objects.select_related('client', 'owner__profile').order_by('-updated_at')[:6]],
        }
        out['clients'] = {'total': Client.objects.count(), 'active': Client.objects.filter(status='active').count()}
    if fa.can_view('finance', 'payments'):
        month = list(Payment.objects.filter(date__gte=month_start))
        out['finance'] = {'month': pnl(month), 'all': pnl(list(Payment.objects.all()))}
    return Response(out)
