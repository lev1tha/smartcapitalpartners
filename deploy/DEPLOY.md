# Деплой на VPS — kpioshsu.com

```
Интернет ──443──> nginx ──┬─ /                    → /srv/scp/frontend/dist (SSG-статика)
                          ├─ /api, /django-admin  → 127.0.0.1:8000 (gunicorn, systemd scp-backend)
                          ├─ /static/             → /srv/scp/backend/staticfiles/
                          └─ /uploads/            → /srv/scp/backend/uploads/
PostgreSQL 16 (apt), база scp
www.kpioshsu.com ─301─> kpioshsu.com
```

Все команды — на сервере от root. Перед началом: A-записи `@` и `www` домена kpioshsu.com → IP сервера
(проверка: `dig +short kpioshsu.com`).

## 0. Погасить старый проект qrcard

Его домен отключён, но сервисы работают и **занимают порт 8000** (Docker `web`) и 5173 (Vite).
Данные не удаляем — только останавливаем, предварительно сняв бэкап базы.

```bash
# что сейчас слушает порты и что включено
ss -tlnp | grep -E ':(80|443|5173|8000|5432)\b'
ls -l /etc/nginx/sites-enabled/
systemctl list-units --type=service | grep -i qrcard

# бэкап базы qrcard (на всякий случай)
cd /srv/qrcard/backend
set -a; . ./.env; set +a
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /root/qrcard_backup_$(date +%F).sql
ls -lh /root/qrcard_backup_*.sql            # файл не пустой

# остановить
docker compose down                          # контейнеры; том pgdata остаётся
systemctl disable --now qrcard-frontend
rm /etc/nginx/sites-enabled/qrcard.conf      # сам файл остаётся в sites-available
nginx -t && systemctl reload nginx

# старый сертификат больше не продлится (домена нет) — убрать, чтобы certbot не сыпал ошибками
certbot certificates
certbot delete --cert-name balday.net        # имя — из вывода выше

ss -tlnp | grep -E ':(5173|8000)\b'          # должно быть пусто
```

Полностью удалить qrcard позже (необратимо): `docker compose down -v` в `/srv/qrcard/backend`,
`rm -rf /srv/qrcard /etc/nginx/sites-available/qrcard.conf /etc/systemd/system/qrcard-frontend.service`.

## 1. Пакеты

```bash
apt update
apt install -y python3-venv python3-dev postgresql nginx certbot python3-certbot-nginx git
node -v      # нужен Node ≥ 20.19 (Vite 8). Если старее:
# curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
```

## 2. Код

```bash
git clone https://github.com/lev1tha/smartcapitalpartners.git /srv/scp
```

## 3. База

```bash
DB_PASS=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))"); echo "$DB_PASS"
sudo -u postgres psql -c "CREATE USER scp WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE scp OWNER scp;"
```

## 4. Backend

```bash
cd /srv/scp/backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
```

В `.env`:

```
DJANGO_SECRET_KEY=<python3 -c "import secrets;print(secrets.token_urlsafe(50))">
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=kpioshsu.com,www.kpioshsu.com
DATABASE_URL=postgres://scp:<DB_PASS>@127.0.0.1:5432/scp
CORS_ALLOWED_ORIGINS=https://kpioshsu.com
CSRF_TRUSTED_ORIGINS=https://kpioshsu.com,https://www.kpioshsu.com
TELEGRAM_BOT_TOKEN=...      TELEGRAM_LEADS_CHAT_ID=...
EMAIL_HOST_USER=...         EMAIL_HOST_PASSWORD=...
```

```bash
chmod 600 .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py seed_users
.venv/bin/python manage.py import_legacy ../backend-php   # только если нужны старые данные
for u in director manager marketer smm accountant finance; do .venv/bin/python manage.py changepassword $u; done
.venv/bin/python manage.py check --deploy

mkdir -p uploads && chown -R www-data:www-data uploads
chown www-data:www-data .env

cp /srv/scp/deploy/systemd/scp-backend.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now scp-backend
curl -s http://127.0.0.1:8000/api/health     # {"status":"ok",...}
```

## 5. Frontend

```bash
cd /srv/scp/frontend
npm ci
npm run build                                # → dist/
```

## 6. nginx + HTTPS

```bash
cp /srv/scp/deploy/nginx/scp.conf /etc/nginx/sites-available/scp.conf
ln -s /etc/nginx/sites-available/scp.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d kpioshsu.com -d www.kpioshsu.com -m <email> --agree-tos --redirect -n
```

## 7. Проверка

```bash
curl -I https://kpioshsu.com                 # 200
curl -I https://www.kpioshsu.com             # 301 → https://kpioshsu.com/
curl -s https://kpioshsu.com/api/health
```

В браузере: сайт, форма заявки внизу главной, `https://kpioshsu.com/admin` — вход в CRM.

## Обновление

```bash
cd /srv/scp && git pull
cd backend && .venv/bin/pip install -r requirements.txt && .venv/bin/python manage.py migrate \
  && .venv/bin/python manage.py collectstatic --noinput && systemctl restart scp-backend
cd ../frontend && npm ci && npm run build
```

## Бэкап

```bash
sudo -u postgres pg_dump scp > /root/scp_$(date +%F).sql
tar czf /root/scp_uploads_$(date +%F).tgz -C /srv/scp/backend uploads
```

Автогенерация бухгалтерских задач 1-го числа — cron с токеном директора:
`0 9 1 * * curl -s -X POST https://kpioshsu.com/api/crm/acc/generate -H "Authorization: Bearer <токен>"`
(токен живёт `AUTH_TOKEN_TTL_DAYS` = 30 дней, поэтому такой cron со временем перестанет работать;
пока проще нажимать «Сгенерировать» в разделе «Бухгалтерия»).
