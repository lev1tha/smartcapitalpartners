"""
Форма JSON-ответов прежних разделов. Ключи (camelCase) и
типы совпадают со старым API один-в-один, поэтому фронтенд не меняется.
"""
from __future__ import annotations

from .models import (
    AccDoc, AccTask, CalendarPost, Campaign, ContentItem, Idea, Lead, QuizResult,
    SmmTask, SocialAccount, Task, TurnkeyRequest,
)
from .utils import iso, iso_date, num


def public_user(user) -> dict:
    return {'id': user.username, 'name': user.profile.name, 'role': user.profile.role}


def task(t: Task, events=None) -> dict:
    events = events if events is not None else list(t.events.all())
    return {
        'id': t.id,
        'title': t.title,
        'description': t.description,
        'assignee': t.assignee,
        'startDate': iso_date(t.start_date),
        'dueDate': iso_date(t.due_date),
        'priority': t.priority,
        'status': t.status,
        'result': {'text': t.result_text, 'link': t.result_link},
        'rejectionReason': t.rejection_reason,
        'attachments': t.attachments or [],
        'content': t.content or [],
        'customFields': t.custom_fields or {},
        'clientId': t.client_id or '',
        'clientName': t.client.name if t.client_id else '',
        'dealId': t.deal_id or '',
        'dealTitle': t.deal.title if t.deal_id else '',
        'createdBy': t.created_by_login,
        'createdByName': t.created_by_name,
        'createdByRole': t.created_by_role,
        'createdAt': iso(t.created_at),
        'updatedAt': iso(t.updated_at),
        'history': [
            {'at': iso(e.at), 'by': e.by_name, 'byRole': e.by_role, 'action': e.action, 'note': e.note}
            for e in events
        ],
    }


def idea(i: Idea) -> dict:
    return {'id': i.id, 'text': i.text, 'author': i.author_name, 'authorRole': i.author_role,
            'createdAt': iso(i.created_at)}


def account(a: SocialAccount) -> dict:
    return {'id': a.id, 'name': a.name, 'platform': a.platform}


def post(p: CalendarPost) -> dict:
    return {
        'id': p.id, 'accountId': p.account_id or '', 'date': iso_date(p.date), 'type': p.type,
        'title': p.title, 'note': p.note, 'status': p.status, 'link': p.link,
        'createdBy': p.created_by_name, 'createdAt': iso(p.created_at), 'updatedAt': iso(p.updated_at),
    }


def smm_task(t: SmmTask) -> dict:
    return {
        'id': t.id, 'title': t.title, 'period': t.period, 'category': t.category,
        'priority': t.priority, 'dueDate': t.due_date, 'isCompleted': t.is_completed,
        'createdBy': t.created_by_login, 'createdAt': iso(t.created_at),
    }


def acc_task(t: AccTask) -> dict:
    return {
        'id': t.id, 'title': t.title, 'period': t.period, 'reportingPeriod': t.reporting_period,
        'deadline': iso_date(t.deadline), 'status': t.status, 'receiptFile': t.receipt_file,
        'createdBy': t.created_by_name, 'createdAt': iso(t.created_at),
    }


def acc_doc(d: AccDoc) -> dict:
    return {'id': d.id, 'counterparty': d.counterparty, 'type': d.type, 'status': d.status}


def campaign(c: Campaign) -> dict:
    return {
        'id': c.id, 'name': c.name, 'channel': c.channel, 'status': c.status,
        'budget': num(c.budget), 'spent': num(c.spent), 'leads': c.leads, 'createdAt': iso(c.created_at),
    }


def content_item(c: ContentItem) -> dict:
    return {**(c.data or {}), 'id': c.id}


def lead(r: Lead) -> dict:
    return {'name': r.name, 'phone': r.phone, 'topic': r.topic, 'createdAt': iso(r.created_at), 'ip': r.ip}


def quiz(r: QuizResult) -> dict:
    return {
        'name': r.name, 'phone': r.phone, 'email': r.email, 'score': r.score, 'maxScore': r.max_score,
        'level': r.level, 'answers': r.answers or [], 'createdAt': iso(r.created_at), 'ip': r.ip,
    }


def turnkey(r: TurnkeyRequest) -> dict:
    return {
        'name': r.name, 'phone': r.phone, 'sphere': r.sphere, 'budget': r.budget, 'city': r.city,
        'services': r.services or [], 'createdAt': iso(r.created_at), 'ip': r.ip,
    }
