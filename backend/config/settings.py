"""
Настройки Django для API Smart Capital Partners.

Все секреты и окружение-зависимые значения читаются из backend/.env
(шаблон — .env.example). Без .env проект запускается в dev-режиме на SQLite.
"""
from pathlib import Path
import os

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_list(name: str, default: str = '') -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(',') if v.strip()]


DEBUG = os.getenv('DJANGO_DEBUG', '1') == '1'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY') or ('dev-insecure-key' if DEBUG else '')
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY обязателен при DJANGO_DEBUG=0')

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'crm',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Пустой DATABASE_URL → SQLite для локальной разработки, в проде — PostgreSQL.
DATABASES = {
    'default': dj_database_url.parse(
        os.getenv('DATABASE_URL') or f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=60,
    )
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
]

LANGUAGE_CODE = 'ru'
TIME_ZONE = 'Asia/Bishkek'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Вложения задач и квитки. URL совпадает со старым PHP (/uploads/...),
# поэтому ссылки из перенесённых данных продолжают работать.
MEDIA_URL = '/uploads/'
MEDIA_ROOT = BASE_DIR / 'uploads'
UPLOAD_MAX_BYTES = 15 * 1024 * 1024

# API не использует trailing slash — как и старый PHP-роутер.
APPEND_SLASH = False

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['crm.auth.BearerTokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
    'EXCEPTION_HANDLER': 'crm.utils.exception_handler',
    'UNAUTHENTICATED_USER': None,
}

AUTH_TOKEN_TTL_DAYS = int(os.getenv('AUTH_TOKEN_TTL_DAYS', '30'))

# CORS: веб-фронтенд + нативные оболочки Capacitor
# (Android: https://localhost, iOS: capacitor://localhost).
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', 'http://localhost:5173') + [
    'https://localhost',
    'capacitor://localhost',
]
CORS_ALLOW_HEADERS = ['authorization', 'content-type']
# Django-admin по HTTPS за nginx: https://домен должен быть в списке.
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')

# --- Уведомления ---
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_LEADS_CHAT_ID = os.getenv('TELEGRAM_LEADS_CHAT_ID', '')
# Внешние каналы (Telegram/email) уходят в фоновом потоке, чтобы не тормозить ответ API.
# В тестах выключается — отправка становится синхронной.
NOTIFY_ASYNC = os.getenv('NOTIFY_ASYNC', '1') == '1'

LEADS_EMAIL = os.getenv('LEADS_EMAIL', '')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '465'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_SSL = EMAIL_PORT == 465
EMAIL_USE_TLS = EMAIL_PORT == 587
EMAIL_TIMEOUT = 15
DEFAULT_FROM_EMAIL = f"{os.getenv('EMAIL_FROM_NAME', 'Smart Capital Partners')} <{EMAIL_HOST_USER or 'noreply@smartcapitalpartners.kg'}>"

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'loggers': {'crm': {'handlers': ['console'], 'level': 'INFO'}},
}
