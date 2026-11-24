# Deploying the CIMP-BIIF portal

This guide puts the portal on one Linux server with Docker: Caddy for HTTPS, the Next.js app, and PostgreSQL. It also covers backups, updates and the security settings that production enforces.

## What you need

- A Linux server (2 vCPU, 4 GB RAM, 40 GB disk is enough to start) with Docker Engine and the Compose plugin.
- A domain name (for example `portal.cimp.ac.in`) whose DNS A record points to the server, and ports 80 and 443 open.
- A mail account for sending email: any SMTP server (Amazon SES, Zoho, the institute's mail server) or a Google account with an app password. Sign-up codes go by email, so production will not start without one.
- Optional: an S3-compatible bucket for uploaded files, and an Anthropic API key for the AI assistant.

## First deployment

```bash
git clone <repository> /srv/cimp && cd /srv/cimp
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production            # fill in every required value
docker compose --env-file .env.production up -d --build
```

Compose then:

1. starts PostgreSQL 16 and waits until it accepts connections;
2. runs `prisma migrate deploy` once (the `migrate` service) to create or update the tables;
3. starts the app, which checks its settings first (below);
4. starts Caddy, which gets a Let's Encrypt certificate for `DOMAIN` and forwards HTTPS traffic to the app.

Create the owner account (only the CEO is made this way; the CEO then adds office users in the portal):

```bash
docker compose --env-file .env.production run --rm migrate \
  node scripts/create-ceo.js --name "Full Name" --email ceo@cimp.ac.in --password "a-long-password"
```

Then open `https://<DOMAIN>`, sign in as the CEO, and in **Admin** load CIMP's real content. Never run the demo seed (`npm run seed`) in production; it refuses to run there.

### Settings checked at start-up

The app will not start in production when one of these is missing or weak; `docker compose logs app` shows each problem on an `[env]` line.

| Setting | Rule |
| --- | --- |
| `DATABASE_URL` | Set by docker-compose from `POSTGRES_PASSWORD` |
| `JWT_SECRET` | At least 32 random characters (`openssl rand -base64 48`). Changing it signs everyone out |
| `COMPANY_EMAIL_DOMAINS` | Office email domain(s); office users can sign in only with these |
| `NEXT_PUBLIC_APP_URL` | `https://` address of the portal, used in emails |
| Mail | `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`, or `GMAIL_USER`/`GMAIL_APP_PASSWORD` |
| `CRON_SECRET` | 24+ characters, only when `SCHEDULER_ENABLED=false` |
| `S3_*` | Bucket, region and keys, only when `STORAGE_DRIVER=s3` |

`ANTHROPIC_API_KEY` is optional: without it the AI buttons explain that the assistant is not set up.

### Health check

`GET /api/health` returns `{"status":"ok","db":"up",...}` with HTTP 200, or 503 when the database cannot be reached. Docker uses it to mark the container healthy; point an uptime monitor (UptimeRobot, Better Stack) at `https://<DOMAIN>/api/health` too.

## Updating

```bash
cd /srv/cimp
scripts/backup.sh                                   # always back up first
git pull
docker compose --env-file .env.production up -d --build
```

The `migrate` service applies new migrations before the new app starts. Migrations are committed with the code (`prisma/migrations`) and CI checks that they match the schema; nobody edits the production schema by hand.

## Backups and restore

`scripts/backup.sh` writes a compressed PostgreSQL dump, plus a tarball of uploaded files when they are stored locally, to `backups/`, and keeps 14 days.

```bash
# daily at 01:30, as the user that runs docker
30 1 * * *  cd /srv/cimp && scripts/backup.sh >> backups/backup.log 2>&1
```

Copy `backups/` off the server every day (for example `aws s3 sync backups s3://cimp-backups/`, or rsync to another machine). A backup on the same disk does not survive a lost server.

Restore:

```bash
docker compose --env-file .env.production stop app
docker compose --env-file .env.production exec -T db pg_restore -U cimp -d cimp --clean --if-exists < backups/cimp-<timestamp>.dump
# uploaded files (local storage only)
docker compose --env-file .env.production run --rm -v "$PWD/backups:/b" app sh -c "cd /data && tar -xzf /b/uploads-<timestamp>.tar.gz"
docker compose --env-file .env.production start app
```

Test a restore on a spare machine once a quarter. A backup that has never been restored is not known to work.

## File storage

| `STORAGE_DRIVER` | Where files go | Back up with |
| --- | --- | --- |
| `local` (default) | The `uploads` Docker volume (`/data/uploads`) | `scripts/backup.sh` |
| `s3` | An S3-compatible bucket: AWS S3 (Mumbai `ap-south-1`), Cloudflare R2, MinIO, DigitalOcean Spaces | Bucket versioning and a lifecycle rule |

For S3, create a private bucket (block all public access) and an access key that can only `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on that bucket. For a non-AWS store also set `S3_ENDPOINT`, and `S3_FORCE_PATH_STYLE=true` for MinIO and Supabase. Files are never public: every download goes through the portal, which checks who is asking and records it.

With S3, files do not pass through the app:

- **Upload:** the browser asks `/api/uploads` for a signed URL (valid 10 minutes, for that exact size and type), PUTs the file to the bucket, then hands the upload ticket to the usual route. That route checks access, the size and the file's first bytes in the bucket, and deletes the file if anything is wrong.
- **Download:** after the access check the portal redirects to a signed URL valid for 10 minutes.
- The bucket must allow the portal's origin to `PUT` (CORS). Supabase Storage allows it already. On AWS, add a CORS rule for `PUT` and `GET` from `https://<your portal>` with the `Content-Type` header.
- Limits: pitch deck 10 MB, ID proof and registration certificate 5 MB, logo 1 MB, mentor document requests and invoices 10 MB (`src/lib/documents.ts`). With local storage the web server's request limit also applies.

Switching an existing installation from `local` to `s3` needs the existing files copied into the bucket under the `uploads/` prefix (for example `aws s3 sync`), keeping their names.

## Security in production

What the portal does:

- **HTTPS only.** Caddy redirects HTTP to HTTPS and renews certificates. The app sends `Strict-Transport-Security`, and session cookies are `Secure`, `HttpOnly` and `SameSite=Lax`.
- **Security headers** on every page: Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and Permissions-Policy. API responses are `Cache-Control: no-store`.
- **Revocable sessions.** Every request checks the session against the database (cached for 15 seconds). Removing an office user, changing a role, changing a password, or **Settings → Sign out on all devices** ends the affected sessions at once.
- **Short-lived sign-ins.** The access token lasts 15 minutes. The browser renews it with a refresh token that works once and lasts 7 days; a sign-in ends 30 days after it started, however active. If a used refresh token is presented again, it was copied, so every session of the account is signed out and the event is audited. The **Expired sign-in cleanup** job deletes old tokens daily at 3:00 AM.
- **Brute-force limits.** 10 sign-in attempts per account and 30 per network address in 15 minutes; 5 wrong email codes cancel the code; limits on sign-ups and code resends; 30 AI requests per user per hour; 60 partner-API requests per key per minute. The limits count in memory, which is correct for one app container. With several, move them to Redis.
- **Audit log** of every change, append-only, in **Admin → Audit log**.

What the operator must do:

- Keep `.env.production` readable only by the deploy user, and out of git.
- Keep the server updated (`unattended-upgrades`), allow only ports 22, 80 and 443, and use SSH keys, not passwords.
- Rotate `JWT_SECRET` if it may have leaked (everyone signs in again), and API keys in **Admin → Integrations**.
- Watch `docker compose logs app` and the health check.

## Scaling beyond one server

The app is stateless apart from three things to change before running more than one container:

1. **Scheduler:** keep `SCHEDULER_ENABLED=true` on one container only, or set it to `false` everywhere and call `POST /api/cron/<job>` with the `x-cron-secret` header from an external scheduler.
2. **Rate limits and session cache:** in memory per container. Move the counters to Redis (PRD §8).
3. **Files:** use `STORAGE_DRIVER=s3`, so every container sees the same files.

## Vercel

The app also runs on Vercel (serverless) with a hosted PostgreSQL such as Supabase. `vercel.json` pins the functions to Mumbai (`bom1`) and schedules the jobs with Vercel Cron.

- **Database:** `DATABASE_URL` is the pooled address (Supabase: transaction pooler, port 6543, ending `?pgbouncer=true&connection_limit=1`). Run `prisma migrate deploy` from your machine against the session pooler (port 5432).
- **Files:** `STORAGE_DRIVER=s3` is required; the function file system is read-only. Supabase Storage works with `S3_ENDPOINT=https://<project>.storage.supabase.co/storage/v1/s3` and `S3_FORCE_PATH_STYLE=true`.
- **Scheduler:** set `SCHEDULER_ENABLED=false` and `CRON_SECRET` (24+ characters). Vercel Cron calls `GET /api/cron/<job>` with `Authorization: Bearer $CRON_SECRET`; each job runs at most once per IST day. Schedules in `vercel.json` are UTC (IST − 5:30).
- **Email rate:** broadcasts send at `MAIL_RATE_PER_SEC` emails per second (default 2, Resend's default limit), so one broadcast emails at most 500 people within the 5-minute function limit. Raise it on a paid mail plan.
- **Excel exports** run inside the request on Vercel (the function is frozen after it replies); exports stuck for 10 minutes are marked failed when the export list is loaded.
- Environment variables take effect only after a redeploy.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request. It runs the type-check and unit tests, applies the migrations to an empty PostgreSQL and checks they match the schema, loads the demo seed, builds, starts the production server, and runs the API tests (`tests/e2e`) against it. Run the same locally:

```bash
npm run typecheck
npm test                                            # unit tests
E2E_BASE_URL=http://localhost:3000 npm run test:e2e # against a running server with the demo seed
```

Run the API tests against a test database only: they sign in, sign out everywhere and create throwaway accounts.
