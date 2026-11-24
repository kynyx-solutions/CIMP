# CIMP-BIIF Incubation Portal

The incubation management portal for CIMP-BIIF (CIMP Business Incubation and Innovation Foundation, Patna). Founders apply and track their application, the office reviews it through four approval stages, and mentors and investors connect with approved startups. Around that sit progress reports, mentoring, investment, ID cards, a public website and, for the office itself, finance approvals, partner CRM, HR and an AI assistant.

The requirements are in [docs/prd.md](docs/prd.md); the demo script is in [docs/demo-walkthrough.md](docs/demo-walkthrough.md); production setup is in [docs/deployment.md](docs/deployment.md).

## Stack

- Next.js 14 (App Router) with TypeScript and Tailwind CSS
- PostgreSQL with Prisma (migrations committed in `prisma/migrations`)
- JWT sessions in an `HttpOnly` cookie, checked against the database on every request
- Nodemailer (SMTP or Gmail), pdf-lib for PDFs, ExcelJS for exports
- Claude (Anthropic API) for the optional AI assistant
- Local disk or any S3-compatible store for uploaded files
- Vitest for tests; Docker and GitHub Actions for deployment and CI

## Run it locally

Requirements: Node.js 20 or newer, PostgreSQL 14 or newer.

```bash
npm install
cp .env.example .env.local        # fill in JWT_SECRET and COMPANY_EMAIL_DOMAINS
# put DATABASE_URL in .env as well, so the Prisma CLI can read it
npm run db:deploy                 # create the tables
npm run seed                      # demo data (refuses to run in production)
npm run dev                       # http://localhost:3000
```

Demo sign-ins are listed in [docs/demo-walkthrough.md](docs/demo-walkthrough.md#demo-accounts). Without a mail account, emails and sign-up codes are printed in the dev-server terminal.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (`tests/unit`) |
| `npm run test:e2e` | API tests against a running server: set `E2E_BASE_URL`, use a test database |
| `npm run db:migrate` | Create a migration after changing `prisma/schema.prisma` (development) |
| `npm run db:deploy` | Apply committed migrations |
| `npm run seed` | Load demo data |
| `npm run db:reset` | Wipe the database and reload demo data (development only) |
| `npm run create-ceo -- --name … --email … --password …` | Create the single owner account |
| `npm run backup` | Back up the database and uploads (docker-compose installation) |

## Project layout

```
src/app/            pages and API routes (src/app/api/**/route.ts)
src/components/     shared React components (admin panel tabs in components/admin)
src/lib/            domain logic: workflow, finance, hr, crm, ai, integrations, storage, auth, env
prisma/             schema and committed migrations
scripts/            seed, create-ceo, backup
tests/              unit tests and API tests
deploy/             Caddy configuration for docker-compose
docs/               demo walkthrough and deployment guide
```

## Roles

Founders and mentors or investors register themselves (email code or Google). Office users are created by the CEO and sign in only with a company email:

| Role | Main work |
| --- | --- |
| CEO | Final approval, fast-track, publishing, office team, finance above ₹1 lakh |
| Senior Manager | Approval and signature, mentor routing, investors, finance approval, staff leave |
| Incubation Manager | Due diligence, mentors, connection requests, partners |
| Executive | First check of applications, progress reports |
| Office Staff | Application corrections, messages |
| Admin IT | Forms, website content, ID cards, scheduled jobs, email, AI and integrations |
| Accounts Officer | Verifies finance requests, records payments, seed-fund register |
| Social Media Manager | Social media calendar |

## Deployment

`docker compose --env-file .env.production up -d --build` runs Caddy (HTTPS), the app and PostgreSQL on one server. See [docs/deployment.md](docs/deployment.md) for settings, backups, updates and security.
