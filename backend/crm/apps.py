from django.apps import AppConfig


class CrmConfig(AppConfig):
    name = 'crm'
    verbose_name = 'CRM Smart Capital Partners'

    def ready(self) -> None:
        from . import signals  # noqa: F401  регистрирует обработчики
