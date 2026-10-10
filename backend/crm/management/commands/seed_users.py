"""
Создаёт/обновляет сотрудников CRM.

  python manage.py seed_users      # 6 ролей с паролями по умолчанию (dev)

Пароли по умолчанию — login + '123'. Перед публикацией
смените их: python manage.py changepassword <login>.
"""
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

class Command(BaseCommand):
    help = 'Создать сотрудников CRM (роли из crm/roles.py)'

    def handle(self, *args, **opts):
        for login, password, name, role in DEFAULT_USERS:
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
