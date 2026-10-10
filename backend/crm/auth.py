"""
Аутентификация по заголовку `Authorization: Bearer <token>`.

Токен хранится в БД:
его можно отозвать (выход, смена пароля), и он истекает через AUTH_TOKEN_TTL_DAYS.
"""
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token


class BearerTokenAuthentication(TokenAuthentication):
    keyword = 'Bearer'

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        ttl = timedelta(days=settings.AUTH_TOKEN_TTL_DAYS)
        if token.created < timezone.now() - ttl:
            token.delete()
            raise exceptions.AuthenticationFailed('Token expired')
        if not hasattr(user, 'profile'):
            raise exceptions.AuthenticationFailed('No CRM profile')
        return user, token


def issue_token(user) -> str:
    """Выдаёт действующий токен (просроченный пересоздаётся)."""
    token, created = Token.objects.get_or_create(user=user)
    ttl = timedelta(days=settings.AUTH_TOKEN_TTL_DAYS)
    if not created and token.created < timezone.now() - ttl:
        token.delete()
        token = Token.objects.create(user=user)
    return token.key
