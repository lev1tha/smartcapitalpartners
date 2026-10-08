"""Значения по умолчанию для дашбордов и шаблоны бухгалтерских отчётов КР (из PHP)."""


def smm_settings() -> dict:
    return {
        'tools': {
            'autopost': {'url': 'https://smmplanner.com', 'status': 'Ближайший пост: не запланирован'},
            'design': {'url': 'https://www.canva.com'},
            'analytics': {'url': 'https://popsters.ru'},
        },
        'kpi': {
            'reach': {'current': 0, 'target': 100000},
            'followers': {'current': 0, 'target': 1000},
            'er': {'current': 0, 'target': 5},
        },
    }


def acc_settings() -> dict:
    return {
        'ecpValidUntil': '',
        'links': {
            'sti': {'name': 'Кабинет налогоплательщика', 'url': 'https://cabinet.sti.gov.kg'},
            'esf': {'name': 'ИС ЭСФ (электронные счета-фактуры)', 'url': 'https://esf.salyk.kg'},
            'ettn': {'name': 'ЭТТН (товаро-транспортные)', 'url': 'https://ettn.salyk.kg'},
            'bank': {'name': 'Банк-клиент', 'url': ''},
        },
    }


def mkt_settings() -> dict:
    return {
        'links': {
            'ads': {'name': 'Google Ads', 'url': ''},
            'meta': {'name': 'Meta Ads (Facebook/Instagram)', 'url': ''},
            'analytics': {'name': 'Аналитика (GA / Яндекс.Метрика)', 'url': ''},
            'twogis': {'name': '2GIS / Instagram', 'url': ''},
        },
        'funnel': {'qualified': 0, 'consultation': 0, 'contract': 0, 'client': 0},
        'budgetPlan': 0,
    }


DEFAULT_SETTINGS = {'smm': smm_settings, 'acc': acc_settings, 'mkt': mkt_settings}

# day — число месяца сдачи; quarter_months / year_months — в какие месяцы сдаётся.
ACC_TEMPLATES = [
    {'title': 'Подоходный налог + соцотчисления (наёмные сотрудники)', 'day': 20, 'period': 'monthly'},
    {'title': 'НДС (налог на добавленную стоимость)', 'day': 25, 'period': 'monthly'},
    {'title': 'Налог с продаж', 'day': 25, 'period': 'monthly'},
    {'title': 'Квартальный отчёт (налог на прибыль, аванс)', 'day': 20, 'period': 'quarterly',
     'months': [4, 7, 10, 1]},
    {'title': 'Годовая единая налоговая декларация (ЕНД)', 'day': 1, 'period': 'yearly', 'months': [3]},
]
