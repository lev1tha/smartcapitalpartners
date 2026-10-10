"""
Схема данных CRM Smart Capital Partners.

Модели первой части повторяют структуры прежнего JSON-хранилища
(storage/*.json) — id сохраняются при импорте, поэтому ссылки не ломаются.
Вторая часть — новые модули: клиенты, сделки и финансы, документы,
уведомления, журнал действий, права на поля и пользовательские свойства.
"""
from datetime import time

from django.conf import settings
from django.db import models
from django.utils import timezone

from .roles import ROLE_CHOICES, TASK_STATUSES
from .utils import new_id

User = settings.AUTH_USER_MODEL


# Генераторы id: отдельные функции, потому что миграции не умеют сериализовать лямбды.
def _task_id(): return new_id('task_')
def _idea_id(): return new_id('idea_')
def _account_id(): return new_id('acc_')
def _post_id(): return new_id('post_')
def _smm_id(): return new_id('smm_')
def _acc_task_id(): return new_id('acc_')
def _acc_doc_id(): return new_id('doc_')
def _campaign_id(): return new_id('camp_')
def _content_id(): return 'c' + new_id('')[:9]
def _client_id(): return new_id('cl_')
def _deal_id(): return new_id('deal_')
def _payment_id(): return new_id('pay_')
def _page_id(): return new_id('page_')
def _field_def_id(): return new_id('fld_')


PRIORITIES = [('low', 'Низкий'), ('normal', 'Обычный'), ('high', 'Высокий'), ('urgent', 'Срочный')]
PRIORITY_RANK = {'low': 0, 'normal': 1, 'medium': 1, 'high': 2, 'urgent': 3}


# ============================== Сотрудники ==============================

class Profile(models.Model):
    """Роль сотрудника и настройки уведомлений. Логин/пароль — в django.contrib.auth.User."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    display_name = models.CharField(max_length=120, blank=True)

    # Каналы уведомлений
    telegram_chat_id = models.CharField(max_length=40, blank=True)
    notify_telegram = models.BooleanField(default=True)
    # Ниже этого приоритета в Telegram не шлём — только в центр уведомлений.
    telegram_min_priority = models.CharField(max_length=10, choices=PRIORITIES, default='normal')
    # «Не беспокоить»: в это окно внешние каналы молчат, кроме urgent.
    dnd_enabled = models.BooleanField(default=False)
    dnd_start = models.TimeField(default=time(22, 0))
    dnd_end = models.TimeField(default=time(8, 0))

    class Meta:
        verbose_name = 'Профиль сотрудника'
        verbose_name_plural = 'Профили сотрудников'

    def __str__(self) -> str:
        return f'{self.name} ({self.role})'

    @property
    def name(self) -> str:
        return self.display_name or self.user.get_full_name() or self.user.username


# ============================== Заявки с сайта ==============================

class Lead(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=60)
    topic = models.CharField(max_length=300, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']


class QuizResult(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=60)
    email = models.CharField(max_length=200, blank=True)
    score = models.IntegerField(default=0)
    max_score = models.IntegerField(default=0)
    level = models.CharField(max_length=200, blank=True)
    answers = models.JSONField(default=list, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']


class TurnkeyRequest(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=60)
    sphere = models.CharField(max_length=200, blank=True)
    budget = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=200, blank=True)
    services = models.JSONField(default=list, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']


# ============================== Контент сайта ==============================

class ContentItem(models.Model):
    """Карточка сайта (бизнес-модель, франшиза, инвестиция, готовый бизнес).
    Поля карточек свободные, поэтому храним их как JSON."""

    TYPES = ('models', 'franchises', 'investments', 'ready')

    id = models.CharField(primary_key=True, max_length=40, default=_content_id)
    type = models.CharField(max_length=20, db_index=True)
    position = models.IntegerField(default=0)
    data = models.JSONField(default=dict)

    class Meta:
        ordering = ['type', 'position']


# ============================== Клиенты, сделки, финансы ==============================

class Client(models.Model):
    KINDS = [('company', 'Компания'), ('person', 'Физлицо')]
    STATUSES = [('lead', 'Потенциальный'), ('active', 'Активный'), ('paused', 'На паузе'), ('archived', 'Архив')]

    id = models.CharField(primary_key=True, max_length=40, default=_client_id)
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    kind = models.CharField(max_length=10, choices=KINDS, default='company')
    status = models.CharField(max_length=10, choices=STATUSES, default='lead')
    # Контакты — тоже могут быть скрыты матрицей прав (FieldPermission).
    email = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=60, blank=True)
    telegram = models.CharField(max_length=100, blank=True)
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='owned_clients')
    tags = models.JSONField(default=list, blank=True)
    notes = models.JSONField(default=list, blank=True)  # документ-заметка: блоки как в Notion
    custom_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self) -> str:
        return self.name


PIPELINES: dict[str, dict] = {
    'sales': {
        'label': 'Продажи',
        'stages': [
            ('lead', 'Лид'), ('qualification', 'Квалификация'), ('proposal', 'Предложение'),
            ('negotiation', 'Переговоры'), ('won', 'Сделка закрыта'), ('lost', 'Отказ'),
        ],
    },
    'investment': {
        'label': 'Инвестиции',
        'stages': [
            ('sourcing', 'Поиск'), ('due_diligence', 'Due diligence'), ('term_sheet', 'Term sheet'),
            ('closing', 'Закрытие'), ('won', 'Проинвестировано'), ('lost', 'Отклонено'),
        ],
    },
    'partnership': {
        'label': 'Партнёрства',
        'stages': [
            ('contact', 'Контакт'), ('discussion', 'Обсуждение'), ('agreement', 'Соглашение'),
            ('won', 'Активное партнёрство'), ('lost', 'Не сложилось'),
        ],
    },
}
CLOSED_STAGES = ('won', 'lost')


class Deal(models.Model):
    CURRENCIES = [('KGS', 'сом'), ('USD', '$'), ('EUR', '€'), ('RUB', '₽'), ('KZT', '₸')]

    id = models.CharField(primary_key=True, max_length=40, default=_deal_id)
    title = models.CharField(max_length=200)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='deals')
    pipeline = models.CharField(max_length=20, default='sales')
    stage = models.CharField(max_length=30, default='lead')
    position = models.IntegerField(default=0)  # порядок карточек в колонке
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='owned_deals')

    # Финансовые поля — видимость/редактирование по матрице FieldPermission.
    amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    commission = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, choices=CURRENCIES, default='KGS')

    probability = models.PositiveSmallIntegerField(default=20)
    expected_close = models.DateField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.JSONField(default=list, blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', '-updated_at']
        indexes = [models.Index(fields=['pipeline', 'stage'])]

    def __str__(self) -> str:
        return self.title


class Payment(models.Model):
    """Движение денег по сделке. Из них считается P&L сделки и клиента."""

    DIRECTIONS = [('in', 'Поступление'), ('out', 'Расход')]
    KINDS = [
        ('payment', 'Оплата клиента'), ('commission', 'Комиссия'), ('investment', 'Инвестиция'),
        ('payout', 'Выплата'), ('expense', 'Расход'), ('refund', 'Возврат'),
    ]

    id = models.CharField(primary_key=True, max_length=40, default=_payment_id)
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='payments')
    date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    direction = models.CharField(max_length=3, choices=DIRECTIONS, default='in')
    kind = models.CharField(max_length=12, choices=KINDS, default='payment')
    note = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-date', '-created_at']


# ============================== Задачи ==============================

class Task(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=_task_id)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    # Исполнитель — роль: задачу видят все сотрудники этой роли.
    assignee = models.CharField(max_length=20, blank=True, db_index=True)
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=10, default='normal')
    status = models.CharField(max_length=20, choices=list(TASK_STATUSES.items()), default='new')
    result_text = models.TextField(blank=True)
    result_link = models.CharField(max_length=500, blank=True)
    rejection_reason = models.TextField(blank=True)
    attachments = models.JSONField(default=list, blank=True)

    # Doc-view: тело задачи в виде блоков (заголовки, чек-листы, цитаты…).
    content = models.JSONField(default=list, blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    # Сквозные связи: задача ↔ клиент ↔ сделка.
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL, related_name='tasks')
    deal = models.ForeignKey(Deal, null=True, blank=True, on_delete=models.SET_NULL, related_name='tasks')

    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_tasks')
    created_by_login = models.CharField(max_length=150, blank=True)
    created_by_name = models.CharField(max_length=150, blank=True)
    created_by_role = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class TaskEvent(models.Model):
    """История задачи (ранее — массив history внутри задачи)."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='events')
    at = models.DateTimeField(default=timezone.now)
    by_name = models.CharField(max_length=150)
    by_role = models.CharField(max_length=20, blank=True)
    action = models.CharField(max_length=20)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ['at', 'id']


# ============================== Идеи ==============================

class Idea(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=_idea_id)
    text = models.TextField()
    author = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    author_name = models.CharField(max_length=150)
    author_role = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


# ============================== Контент-календарь ==============================

class SocialAccount(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=_account_id)
    name = models.CharField(max_length=200)
    platform = models.CharField(max_length=60, blank=True)
    position = models.IntegerField(default=0)

    class Meta:
        ordering = ['position', 'name']


class CalendarPost(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=_post_id)
    account = models.ForeignKey(SocialAccount, null=True, blank=True, on_delete=models.CASCADE, related_name='posts')
    date = models.DateField()
    type = models.CharField(max_length=30, default='post')
    title = models.CharField(max_length=300)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=30, default='idea')
    link = models.CharField(max_length=500, blank=True)
    created_by_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['date', 'created_at']


# ============================== SMM / Бухгалтерия / Маркетинг ==============================

class SmmTask(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=_smm_id)
    title = models.CharField(max_length=300)
    period = models.CharField(max_length=10, default='daily')
    category = models.CharField(max_length=60, default='Контент')
    priority = models.CharField(max_length=10, default='medium')
    due_date = models.CharField(max_length=30, blank=True)
    is_completed = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_by_login = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class AccTask(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=_acc_task_id)
    title = models.CharField(max_length=300)
    period = models.CharField(max_length=10, default='monthly')
    reporting_period = models.CharField(max_length=20, blank=True)
    deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='not_started')
    receipt_file = models.CharField(max_length=500, blank=True)
    created_by_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class AccDoc(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=_acc_doc_id)
    counterparty = models.CharField(max_length=300)
    type = models.CharField(max_length=100, default='Акт сверки')
    status = models.CharField(max_length=30, default='requested')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['created_at']


class Campaign(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=_campaign_id)
    name = models.CharField(max_length=300)
    channel = models.CharField(max_length=60, default='Instagram')
    status = models.CharField(max_length=10, default='active')
    budget = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    spent = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    leads = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']


class BoardSettings(models.Model):
    """Настройки дашбордов (smm/acc/mkt) — свободный JSON, как smm-settings.json и т.п."""

    key = models.CharField(primary_key=True, max_length=20)
    data = models.JSONField(default=dict)


# ============================== Документы (база знаний) ==============================

class Document(models.Model):
    """Страница в стиле Notion: блоки контента, вложенность, привязка к клиенту/сделке."""

    id = models.CharField(primary_key=True, max_length=40, default=_page_id)
    title = models.CharField(max_length=300, default='Без названия')
    content = models.JSONField(default=list, blank=True)
    # Плоский текст блоков для поиска: JSON в SQLite хранится с \uXXXX-экранированием,
    # поэтому icontains по content не находит кириллицу.
    plain_text = models.TextField(blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL, related_name='documents')
    deal = models.ForeignKey(Deal, null=True, blank=True, on_delete=models.SET_NULL, related_name='documents')
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']


# ============================== Уведомления и журнал ==============================

class Notification(models.Model):
    KINDS = [('task', 'Задача'), ('deal', 'Сделка'), ('lead', 'Заявка'), ('mention', 'Упоминание'), ('system', 'Система')]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=300)
    body = models.TextField(blank=True)
    kind = models.CharField(max_length=10, choices=KINDS, default='system')
    priority = models.CharField(max_length=10, choices=PRIORITIES, default='normal')
    # Куда вести по клику: {type: 'task'|'deal'|'client'|'submission', id: '...'}
    link_type = models.CharField(max_length=20, blank=True)
    link_id = models.CharField(max_length=60, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    # Куда фактически доставлено: ['web', 'telegram'] — для отладки «почему не пришло».
    delivered = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']


class AuditLog(models.Model):
    actor = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    actor_name = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=20)  # create / update / delete / stage / transition
    entity_type = models.CharField(max_length=20, db_index=True)
    entity_id = models.CharField(max_length=60, db_index=True)
    summary = models.CharField(max_length=300, blank=True)
    # {field: [old, new]} — при выдаче скрытые поля маскируются по матрице прав.
    changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']


# ============================== Права на поля и свойства ==============================

class FieldPermission(models.Model):
    """Переопределение видимости/редактирования поля для роли.
    Значения по умолчанию — в crm/permissions.py (FIELD_REGISTRY)."""

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    resource = models.CharField(max_length=20)
    field = models.CharField(max_length=40)
    can_view = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=False)

    class Meta:
        unique_together = [('role', 'resource', 'field')]


class FieldDefinition(models.Model):
    """Пользовательское свойство, которое добавляют «на лету» (как в Notion)."""

    TYPES = [('text', 'Текст'), ('number', 'Число'), ('date', 'Дата'), ('select', 'Список'),
             ('checkbox', 'Флажок'), ('url', 'Ссылка')]
    RESOURCES = [('task', 'Задачи'), ('client', 'Клиенты'), ('deal', 'Сделки')]

    id = models.CharField(primary_key=True, max_length=40, default=_field_def_id)
    resource = models.CharField(max_length=10, choices=RESOURCES)
    label = models.CharField(max_length=80)
    type = models.CharField(max_length=10, choices=TYPES, default='text')
    options = models.JSONField(default=list, blank=True)  # для select
    position = models.IntegerField(default=0)

    class Meta:
        ordering = ['resource', 'position', 'label']
