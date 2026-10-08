from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from crm.utils import json_not_found

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('', include('crm.urls')),
]

# Загруженные файлы. В проде их отдаёт nginx из того же MEDIA_ROOT.
if settings.DEBUG:
    urlpatterns += [
        re_path(r'^uploads/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]

handler404 = json_not_found
