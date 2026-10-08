"""
Роли и ролевые правила CRM. Перенесено из PHP (Auth::ROLES, Crm.php) без изменений
поведения, плюс правила для новых модулей (клиенты, сделки, финансы).
"""

ROLES: dict[str, str] = {
    'director': 'Директор',
    'manager': 'Управляющий',
    'marketer': 'Маркетолог',
    'smm': 'СММ-специалист',
    'accountant': 'Бухгалтер',
    'finance': 'Финансист',
}
ROLE_CHOICES = list(ROLES.items())

TASK_STATUSES: dict[str, str] = {
    'new': 'Новая',
    'in_progress': 'В работе',
    'review': 'На проверке',
    'done': 'Выполнена',
    'rejected': 'Отклонена',
}

MANAGERS = ('director', 'manager')


def is_manager(role: str) -> bool:
    """Кто управляет задачами (создание, проверка, отклонение)."""
    return role in MANAGERS


def can_calendar(role: str) -> bool:
    return role in ('director', 'manager', 'marketer', 'smm')


def can_edit_accounts(role: str) -> bool:
    return role in ('director', 'manager', 'marketer')


def can_smm(role: str) -> bool:
    return role in ('director', 'manager', 'smm')


def can_accounting(role: str) -> bool:
    return role in ('director', 'manager', 'accountant', 'finance')


def can_marketing(role: str) -> bool:
    return role in ('director', 'manager', 'marketer')


def can_content(role: str) -> bool:
    """Редактирование карточек сайта."""
    return role in ('director', 'manager', 'marketer')


def submission_access(role: str) -> list[str]:
    """Какие типы заявок видит роль."""
    if role in ('director', 'manager', 'marketer'):
        return ['leads', 'quiz', 'turnkey']
    if role == 'finance':
        return ['quiz']
    return []  # smm, accountant


# --- Новые модули ---

def can_crm(role: str) -> bool:
    """Клиенты и сделки: просмотр. Что именно видно внутри — решает матрица полей."""
    return role in ('director', 'manager', 'marketer', 'finance', 'accountant')


def can_edit_crm(role: str) -> bool:
    """Создание/редактирование клиентов и сделок."""
    return role in ('director', 'manager', 'marketer', 'finance')


def can_view_logs(role: str) -> bool:
    return is_manager(role)


def section_access(role: str) -> dict[str, bool]:
    """Карта разделов для фронтенда — чтобы не дублировать правила в TS."""
    return {
        'tasks': True,
        'clients': can_crm(role),
        'deals': can_crm(role),
        'docs': True,
        'marketing': can_marketing(role),
        'smm': can_smm(role),
        'accounting': can_accounting(role),
        'calendar': can_calendar(role),
        'submissions': bool(submission_access(role)),
        'catalog': can_content(role),
        'ideas': True,
        'users': is_manager(role),
        'logs': can_view_logs(role),
        'fieldAccess': role == 'director',
    }
