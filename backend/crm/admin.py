"""Django-admin (/django-admin/) — запасной интерфейс для данных, основной UI — CRM на React."""
from django.contrib import admin

from . import models as m

admin.site.site_header = 'Smart Capital Partners — данные'


@admin.register(m.Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'display_name', 'telegram_chat_id')
    list_filter = ('role',)


for model in (m.Client, m.Deal, m.Payment, m.Task, m.Document, m.Notification, m.AuditLog,
              m.FieldPermission, m.FieldDefinition, m.Lead, m.QuizResult, m.TurnkeyRequest,
              m.ContentItem, m.Idea, m.SocialAccount, m.CalendarPost, m.SmmTask, m.AccTask,
              m.AccDoc, m.Campaign, m.BoardSettings):
    admin.site.register(model)
