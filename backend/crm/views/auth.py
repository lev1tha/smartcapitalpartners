"""Вход сотрудников, текущий пользователь, выход, список сотрудников, заявки, контент."""
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Min
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import presenters as P
from .. import roles as R
from ..auth import issue_token
from ..models import ContentItem, Lead, Notification, QuizResult, TurnkeyRequest
from ..permissions import field_access, require
from ..utils import ApiError, body, s

User = get_user_model()


@api_view(['POST'])
def login(request):
    data = body(request)
    user = authenticate(request, username=s(data.get('login')), password=str(data.get('password') or ''))
    if user is None or not hasattr(user, 'profile') or not user.is_active:
        raise ApiError('Неверный логин или пароль', 401)
    return Response({
        'token': issue_token(user),
        'user': P.public_user(user),
        'roleLabel': R.ROLES.get(user.profile.role, user.profile.role),
    })


@api_view(['POST'])
@require()
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response({'status': 'ok'})


@api_view(['GET'])
@require()
def me(request):
    role = request.user.profile.role
    return Response({
        'user': P.public_user(request.user),
        'roleLabel': R.ROLES.get(role, role),
        'isManager': R.is_manager(role),
        'access': R.submission_access(role),
        # новое: разделы и права на поля — фронтенд строит меню и прячет поля по ним
        'sections': R.section_access(role),
        'fields': field_access(request).matrix(),
        'unreadNotifications': Notification.objects.filter(user=request.user, is_read=False).count(),
    })


@api_view(['GET'])
@require(R.is_manager, anon_status=403)
def users(request):
    qs = User.objects.filter(is_active=True, profile__isnull=False).select_related('profile').order_by('id')
    return Response({'users': [{
        'login': u.username, 'name': u.profile.name, 'role': u.profile.role,
        'roleLabel': R.ROLES.get(u.profile.role, u.profile.role),
    } for u in qs]})


@api_view(['GET'])
@require()
def submissions(request):
    access = R.submission_access(request.user.profile.role)
    out = {'counts': {}, 'leads': [], 'quiz': [], 'turnkey': [], 'access': access}
    sources = {'leads': (Lead, P.lead), 'quiz': (QuizResult, P.quiz), 'turnkey': (TurnkeyRequest, P.turnkey)}
    for key, (model, present) in sources.items():
        if key in access:
            items = [present(r) for r in model.objects.all()]
            out[key] = items
            out['counts'][key] = len(items)
    return Response(out)


@api_view(['POST'])
@require(R.can_content, anon_status=403)
def content_save(request):
    data = body(request)
    ctype, item = s(data.get('type')), data.get('item')
    if ctype not in ContentItem.TYPES or not isinstance(item, dict):
        raise ApiError('Нужны type и item', 400)
    if not s(item.get('title') or item.get('brand')):
        raise ApiError('Название обязательно')
    item_id = s(item.get('id'))
    payload = {k: v for k, v in item.items() if k != 'id'}
    with transaction.atomic():
        obj = ContentItem.objects.filter(pk=item_id, type=ctype).first() if item_id else None
        if obj:
            obj.data = payload
            obj.save(update_fields=['data'])
        else:
            # новые карточки — в начало списка, как в PHP
            first = ContentItem.objects.filter(type=ctype).aggregate(m=Min('position'))['m']
            obj = ContentItem(type=ctype, data=payload, position=(first or 0) - 1)
            if item_id:
                obj.id = item_id
            obj.save()
    return Response({'item': P.content_item(obj)})


@api_view(['POST'])
@require(R.can_content, anon_status=403)
def content_delete(request):
    data = body(request)
    ctype, item_id = s(data.get('type')), s(data.get('id'))
    if ctype not in ContentItem.TYPES or not item_id:
        raise ApiError('Нужны type и id', 400)
    ContentItem.objects.filter(pk=item_id, type=ctype).delete()
    return Response({'status': 'ok'})

