"""
Маршруты API. Пути старых разделов совпадают с PHP один-в-один; новые — ниже.
Без завершающих слэшей (APPEND_SLASH=False).
"""
from django.urls import path

from .views import auth, boards, crm, public, tasks, workspace

urlpatterns = [
    # --- публичные ---
    path('api/health', public.health),
    path('api/lead', public.lead),
    path('api/quiz', public.quiz),
    path('api/turnkey', public.turnkey),
    path('api/content', public.content_list),

    # --- авторизация и общее ---
    path('api/admin/login', auth.login),
    path('api/admin/logout', auth.logout),
    path('api/crm/me', auth.me),
    path('api/crm/users', auth.users),
    path('api/admin/submissions', auth.submissions),
    path('api/admin/content/save', auth.content_save),
    path('api/admin/content/delete', auth.content_delete),

    # --- задачи ---
    path('api/crm/tasks', tasks.task_list),
    path('api/crm/tasks/save', tasks.task_save),
    path('api/crm/tasks/transition', tasks.task_transition),
    path('api/crm/tasks/content', tasks.task_content),
    path('api/crm/tasks/delete', tasks.task_delete),
    path('api/crm/upload', tasks.upload),

    # --- идеи ---
    path('api/crm/ideas', boards.ideas),
    path('api/crm/ideas/delete', boards.idea_delete),

    # --- контент-календарь ---
    path('api/crm/accounts', boards.accounts),
    path('api/crm/accounts/save', boards.account_save),
    path('api/crm/accounts/delete', boards.account_delete),
    path('api/crm/calendar', boards.calendar),
    path('api/crm/calendar/save', boards.calendar_save),
    path('api/crm/calendar/delete', boards.calendar_delete),

    # --- SMM ---
    path('api/crm/smm/board', boards.smm_board),
    path('api/crm/smm/tasks/save', boards.smm_task_save),
    path('api/crm/smm/tasks/toggle', boards.smm_task_toggle),
    path('api/crm/smm/tasks/delete', boards.smm_task_delete),
    path('api/crm/smm/settings', boards.smm_settings),

    # --- бухгалтерия ---
    path('api/crm/acc/board', boards.acc_board),
    path('api/crm/acc/tasks/save', boards.acc_task_save),
    path('api/crm/acc/tasks/status', boards.acc_task_status),
    path('api/crm/acc/tasks/receipt', boards.acc_task_receipt),
    path('api/crm/acc/tasks/delete', boards.acc_task_delete),
    path('api/crm/acc/docs/save', boards.acc_doc_save),
    path('api/crm/acc/docs/delete', boards.acc_doc_delete),
    path('api/crm/acc/settings', boards.acc_settings),
    path('api/crm/acc/generate', boards.acc_generate),

    # --- маркетинг ---
    path('api/crm/mkt/board', boards.mkt_board),
    path('api/crm/mkt/campaigns/save', boards.mkt_campaign_save),
    path('api/crm/mkt/campaigns/delete', boards.mkt_campaign_delete),
    path('api/crm/mkt/settings', boards.mkt_settings),

    # ===== новое =====
    # --- дашборд ---
    path('api/crm/dashboard', crm.dashboard),

    # --- клиенты ---
    path('api/crm/clients', crm.client_list),
    path('api/crm/clients/save', crm.client_save),
    path('api/crm/clients/delete', crm.client_delete),
    path('api/crm/clients/<str:client_id>', crm.client_detail),

    # --- сделки и платежи ---
    path('api/crm/deals', crm.deal_list),
    path('api/crm/deals/save', crm.deal_save),
    path('api/crm/deals/move', crm.deal_move),
    path('api/crm/deals/delete', crm.deal_delete),
    path('api/crm/deals/<str:deal_id>', crm.deal_detail),
    path('api/crm/payments/save', crm.payment_save),
    path('api/crm/payments/delete', crm.payment_delete),

    # --- документы ---
    path('api/crm/docs', workspace.doc_list),
    path('api/crm/docs/save', workspace.doc_save),
    path('api/crm/docs/delete', workspace.doc_delete),
    path('api/crm/docs/<str:doc_id>', workspace.doc_detail),

    # --- уведомления ---
    path('api/crm/notifications', workspace.notifications),
    path('api/crm/notifications/read', workspace.notifications_read),
    path('api/crm/notifications/settings', workspace.notification_settings),
    path('api/crm/notifications/test', workspace.notification_test),

    # --- поиск, журнал, права, свойства ---
    path('api/crm/search', workspace.search),
    path('api/crm/logs', workspace.logs),
    path('api/crm/permissions/fields', workspace.field_permissions),
    path('api/crm/fields', workspace.field_definitions),
    path('api/crm/fields/save', workspace.field_definition_save),
    path('api/crm/fields/delete', workspace.field_definition_delete),
]
