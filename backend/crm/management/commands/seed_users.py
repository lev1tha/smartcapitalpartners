"""
Создаёт/обновляет сотрудников CRM.

  python manage.py seed_users                      # 6 ролей с паролями по умолчанию (dev)
  python manage.py seed_users --from-php ../backend-php/config.php   # логины/пароли из старого конфига

Пароли по умолчанию такие же, как были в PHP (login + '123'). Перед публикацией
смените их: python manage.py changepassword <login>.
"""
import re
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from crm.models import Profile
from crm.roles import ROLES

User = get_user_model()

DEFAULT_USERS = [
    ('director', 'director123', 'Элдос Маткеримов', 'director'),
    ('manager', 'manager123', 'Управляющий', 'manager'),
    ('marketer', 'marketer123', 'Маркетолог', 'marketer'),
    ('smm', 'smm123', 'СММ-специалист', 'smm'),
    ('accountant', 'accountant123', 'Бухгалтер', 'accountant'),
    ('finance', 'finance123', 'Финансист', 'finance'),
]

_PHP_USER = re.compile(
    r"\['login'\s*=>\s*'([^']*)',\s*'password'\s*=>\s*'([^']*)',\s*'name'\s*=>\s*'([^']*)',\s*'role'\s*=>\s*'([^']*)'\]"
)


class Command(BaseCommand):
    help = 'Создать сотрудников CRM (роли из crm/roles.py)'

    def add_arguments(self, parser):
        parser.add_argument('--from-php', help='путь к backend-php/config.php с массивом users')

    def handle(self, *args, **opts):
        users = DEFAULT_USERS
        if opts['from_php']:
            text = Path(opts['from_php']).read_text(encoding='utf-8')
            users = _PHP_USER.findall(text) or users
        for login, password, name, role in users:
            if role not in ROLES:
                self.stderr.write(f'  пропуск {login}: неизвестная роль {role}')
                continue
            user, created = User.objects.get_or_create(username=login, defaults={'first_name': name})
            user.set_password(password)
            user.is_staff = role == 'director'
            user.is_superuser = role == 'director'
            user.save()
            Profile.objects.update_or_create(user=user, defaults={'role': role, 'display_name': name})
            self.stdout.write(f'  {"создан" if created else "обновлён"}: {login} ({ROLES[role]})')
