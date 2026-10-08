"""Публичные эндпоинты сайта: health, заявки (лид / тест / под ключ), карточки контента."""
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import presenters as P
from ..models import ContentItem, Lead, QuizResult, TurnkeyRequest
from ..notify import notify, notify_site_submission, users_with_roles
from ..utils import ApiError, s


def _client_ip(request):
    # За nginx REMOTE_ADDR = 127.0.0.1; настоящий адрес nginx кладёт в X-Real-IP.
    return request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR') or None


def _json_object(request) -> dict:
    if not isinstance(request.data, dict):
        raise ApiError('Invalid JSON body', 400)
    return request.data


def _now_str() -> str:
    return timezone.localtime().strftime('%d.%m.%Y %H:%M')


def _notify_staff(kind: str, title: str, link_id: str) -> None:
    """Новая заявка → центр уведомлений тех, кто видит этот тип заявок."""
    roles = {'leads': ('director', 'manager', 'marketer'),
             'quiz': ('director', 'manager', 'marketer', 'finance'),
             'turnkey': ('director', 'manager', 'marketer')}[kind]
    notify(users_with_roles(*roles), title, kind='lead', priority='high', link=('submission', link_id))


@api_view(['GET'])
def health(request):
    return Response({'status': 'ok', 'service': 'scp-api', 'time': timezone.localtime().isoformat(timespec='seconds')})


@api_view(['POST'])
def lead(request):
    data = _json_object(request)
    name, phone, topic = s(data.get('name')), s(data.get('phone')), s(data.get('topic'))
    if not name or not phone:
        raise ApiError('Поля "name" и "phone" обязательны')
    Lead.objects.create(name=name, phone=phone, topic=topic, ip=_client_ip(request))

    text = '\n'.join([
        'Новая заявка с сайта Smart Capital Partners', '===========================',
        f'Имя:     {name}', f'Телефон: {phone}', f'Тема:    {topic or "—"}', '', f'Дата: {_now_str()}',
    ])
    sent = notify_site_submission(f'Smart Capital Partners — заявка: {name}', text)
    _notify_staff('leads', f'Новая заявка: {name}', 'leads')
    return Response({'status': 'ok', 'sent': sent, 'message': 'Заявка принята'})


@api_view(['POST'])
def quiz(request):
    data = _json_object(request)
    contact = data.get('contact') if isinstance(data.get('contact'), dict) else {}
    name, phone, email = s(contact.get('name')), s(contact.get('phone')), s(contact.get('email'))
    if not name or not phone:
        raise ApiError('Имя и телефон обязательны')

    def to_int(v):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0

    score, max_score = to_int(data.get('score')), to_int(data.get('maxScore'))
    level = s(data.get('level'))
    answers = data.get('answers') if isinstance(data.get('answers'), list) else []
    QuizResult.objects.create(name=name, phone=phone, email=email, score=score, max_score=max_score,
                              level=level, answers=answers, ip=_client_ip(request))

    lines = [
        'Новый результат экспресс-теста Smart Capital Partners', '======================================',
        f'Имя:      {name}', f'Телефон:  {phone}', f'Email:    {email or "—"}',
        f'Результат: {score} из {max_score} — {level}', '', 'Ответы:',
    ]
    for i, a in enumerate(answers, 1):
        a = a if isinstance(a, dict) else {}
        lines += [f'{i}. {s(a.get("question"))}', f'   → {s(a.get("answer"))}']
    lines += ['', f'Дата: {_now_str()}']
    sent = notify_site_submission(f'Smart Capital Partners — заявка с теста: {name}', '\n'.join(lines))
    _notify_staff('quiz', f'Результат теста: {name} ({score}/{max_score})', 'quiz')
    return Response({'status': 'ok', 'sent': sent, 'message': 'Результат сохранён'})


@api_view(['POST'])
def turnkey(request):
    data = _json_object(request)
    name, phone = s(data.get('name')), s(data.get('phone'))
    sphere, budget, city = s(data.get('sphere')), s(data.get('budget')), s(data.get('city'))
    services = data.get('services') if isinstance(data.get('services'), list) else []
    if not name or not phone:
        raise ApiError('Имя и телефон обязательны')
    TurnkeyRequest.objects.create(name=name, phone=phone, sphere=sphere, budget=budget, city=city,
                                  services=services, ip=_client_ip(request))
    text = '\n'.join([
        'Новая заявка «Бизнес под ключ»', '==============================',
        f'Имя:      {name}', f'Телефон:  {phone}', f'Сфера:    {sphere or "—"}',
        f'Бюджет:   {budget or "—"}', f'Город:    {city or "—"}',
        f'Услуги:   {", ".join(map(str, services)) if services else "—"}', '', f'Дата: {_now_str()}',
    ])
    sent = notify_site_submission(f'Smart Capital Partners — бизнес под ключ: {name}', text)
    _notify_staff('turnkey', f'Бизнес под ключ: {name}', 'turnkey')
    return Response({'status': 'ok', 'sent': sent, 'message': 'Заявка принята'})


@api_view(['GET'])
def content_list(request):
    ctype = s(request.query_params.get('type'))
    if ctype not in ContentItem.TYPES:
        raise ApiError('Неизвестный тип контента', 400)
    return Response({'items': [P.content_item(c) for c in ContentItem.objects.filter(type=ctype)]})
