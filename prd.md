# PRD — CIMP-BIIF 1.0 Incubation Management Platform

| | |
|---|---|
| **Client** | CIMP-BIIF: CIMP Business Incubation and Innovation Foundation, a Section 8 company of Chandragupt Institute of Management Patna (CIMP). Note: the client's overview document expands the name as "Centre for Innovation, Management & Policy – Business Incubation & Innovation Fund"; confirm the official name with CIMP (Q14). |
| **Vendor** | Homeasy Automation Pvt. Ltd. |
| **Status** | Draft v0.4: revised line by line against CIMP's overview document (see the traceability matrix in §14); ready for the requirement-alignment meeting |
| **Last updated** | 2026-11-20 |
| **Sources** | CIMP-BIIF 1.0 High-Level Overview (CIMP, v1.0, 2025) · CIMP-BIIF Proposal (Homeasy, 15-04-2026) |
| **Owner** | TBD |

> Items marked **[OPEN Qn]** need a decision from CIMP (see §13). Items marked **[DECIDED]** are agreed internally and will be presented to CIMP for confirmation.

---

## 1. Summary

CIMP-BIIF is a web portal that digitises the whole incubation lifecycle at CIMP:

- startup registration and due diligence
- a multi-stage office approval workflow with digital signatures
- mentor and investor connections
- quarterly progress reporting (QPR)
- reports, PDFs and ID cards
- a public directory of approved startups, mentors and investors

It replaces paper forms, email threads and spreadsheets with one system that keeps an audit trail. It is also meant to be the foundation for **BIIF 2.0** (accounts, CRM, AI tools).

Delivery is split into two phases:

- **Phase 1 (8 weeks)** covers the client's **Primary Goals**.
- **Phase 2** covers the **Secondary Goals**. It is scoped and priced separately, as the proposal's Terms & Conditions allow ("Additional features to be scoped separately").

## 2. Problem

Today CIMP runs incubation through disconnected tools. That causes:

- slow, opaque approvals with no audit trail
- trouble matching startups with the right mentors and investors
- no central tracking of startup progress or QPR submissions
- inconsistent data across applications, reports and records
- heavy manual work for office staff collecting data and producing reports

## 3. Goals

These goals and their priorities come from the client's overview.

| # | Goal | Priority | Phase |
|---|---|---|---|
| G1 | Digitise incubatee registration, application and approval | Primary | 1 |
| G2 | Role-based office management with granular permissions | Primary | 1 |
| G3 | Structured mentor and investor connections with due diligence | Primary | 1 (core) / 2 (meetings, proposals) |
| G4 | Automated notifications, reminders and QPR tracking | Secondary | 1 (notifications) / 2 (reminders, QPR) |
| G5 | Signed PDFs, Excel reports and virtual ID cards | Secondary | 2 |
| G6 | Public directory of approved startups, mentors and investors | Secondary | 1 (directory) / 2 (blogs) |
| G7 | Scalable foundation for BIIF 2.0 | Future | Architecture only |

### Out of scope

These exclusions come from the proposal:

- mobile apps (the web UI must still be responsive)
- advanced analytics and AI modules
- external integrations beyond the agreed scope
- on-site deployment or support
- BIIF 2.0 modules (CIMP overview §6.4): accounts department with financial-document approvals, social media manager dashboard, CRM, attendance tracker, leave management, external API integrations with partner portals, and custom GPT / AI tools for office users. Phase 1 keeps the architecture ready for them (G7) but does not build them.

## 4. Users & roles

### 4.1 External users (they register themselves)

| User type | Description | Registration |
|---|---|---|
| **Incubatee** | Startup founder applying for incubation | Email + OTP verification, or Google OAuth (Apple: **[OPEN Q4]**) |
| **Mentor** | Expert who guides incubatees | Email + OTP, or Google OAuth. The profile needs office approval. |
| **Investor** | A mentor who also registers as an investor | Extra investor profile with its own approval. Stored in the same user record (`userType[]`). |
| **Public visitor** | Anyone | No account |

### 4.2 Office roles (staff)

| Role | Responsibilities (from the client's overview) |
|---|---|
| **Admin (IT)** | Full configuration: form fields, site config, public visibility, blog approvals, ID card templates, audit logs |
| **CEO** | Final approval and digital signature. Can fast-track any application. Sees all statistics. |
| **Senior Manager** | Approval with digital signature. Routes connection requests upward. |
| **Incubation Manager** | Due diligence with remarks. Routes connections. Messages mentors and investors. |
| **Executive / Sr. Executive** | Accepts submissions. Sends custom notifications. Downloads reports and Excel data. |
| **Office Staff** | View-only access. Can edit application fields (each edit is flagged). Messages incubatees. Writes blog posts. |

### 4.3 Staff account rules (hard requirements)

| ID | Rule |
|---|---|
| ACC-1 | Office staff can never sign up themselves. Public registration only creates external users (incubatee, mentor, investor). |
| ACC-2 | The first owner account (CEO) is created only through a server-side CLI script, never through the UI. |
| ACC-3 | Other office accounts are created from inside the platform by an authorised office user. **[DECIDED]** The CEO creates all office accounts and can delegate this to Admin IT. Whether CIMP wants Admin IT to have this by default: **[OPEN Q3]** |
| ACC-4 | Staff emails must be on a CIMP company domain, set in configuration. Free email providers are rejected. |
| ACC-5 | Staff sign in with company email and password only. Google, Apple and other social logins are for external users only. |
| ACC-6 | Company-domain emails cannot be used for public registration. |
| ACC-7 | Social-login identity is verified on the server from the provider's signed token. The server never trusts an email sent by the client. |
| ACC-8 | Deactivating a staff account ends access immediately by revoking its refresh tokens. |

## 5. Permissions matrix (Phase 1)

✅ = allowed · ◐ = limited · blank = not allowed

| Capability | Inc. | Mentor/Inv. | Staff | Exec | Mgr | Sr Mgr | CEO | Admin IT |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Submit / edit own profile & application | ✅ | ✅ | | | | | | |
| View applications & profiles | own | own | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit application fields (flagged in audit) | | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Accept submission (Executive stage) | | | | ✅ | ✅ | ✅ | ✅ | |
| Due diligence remarks (Manager stage) | | | | | ✅ | ✅ | ✅ | |
| Approve + sign (Sr Manager stage) | | | | | | ✅ | ✅ | |
| Final approve + sign | | | | | | | ✅ | |
| Fast-track / approve at any lower stage | | | | | ◐ | ◐ | ✅ | |
| Reject / send back with remark | | | | ✅ | ✅ | ✅ | ✅ | |
| Route connection requests | | | | | ✅ | ✅ | ✅ | |
| Accept / decline mentee connection | | ✅ | | | | | | |
| Messaging | office + mentor | mentees + office | incubatees | ✅ | ✅ | ✅ | ✅ | |
| Custom notification blast | | | | ✅ | ✅ | | ✅ | ✅ |
| Configure form fields, site config, public visibility | | | | | | | | ✅ |
| View audit logs | | | | | | | ✅ | ✅ |
| Manage office accounts | | | | | | | ✅ | ◐ [OPEN Q3] |

"Higher roles can approve or fast-track at any stage" (client's overview). ◐ means a role can act only on stages below its own.

## 6. Workflows

### 6.1 Incubatee application approval

```
Draft ─submit─▶ Executive Review ─accept─▶ Manager Due Diligence ─recommend─▶ Sr. Manager Approval ─sign─▶ CEO Final Approval ─sign─▶ APPROVED
                      │                         │                                  │                             │
                      └──── reject / send back with remark (any stage) ───────────┴─────────────────────────────┘

Fast-track: CEO (and a higher role over lower stages) can approve directly from any earlier stage.
```

- **WF-1.** Each step records the actor, role, timestamp, decision and remark. Steps are stored inside the approval document (`approvals.steps[]`).
- **WF-2.** A digital signature is required at the Sr. Manager and CEO stages. Its type is **[OPEN Q1]**.
- **WF-3.** "Send back" returns the application to the applicant for edits, with a remark the applicant can see. The applicant can't edit the profile while it is under review; after a send-back they edit and resubmit, and the application returns to the stage that sent it back. *(Built in the demo.)*
- **WF-4.** On final approval the incubatee's profile can appear in the public directory, depending on the visibility settings Admin IT controls.
- **WF-5.** Every transition notifies the applicant and the next stage's reviewers.
- **WF-6.** Stage-guarding: an action is only valid for the application's current stage. Closed applications cannot be acted on again.

> ⚠️ The client's overview contradicts itself. §2.4 says the Senior Manager is the "first approval level", but §2.5 gives the order Executive → Manager → Sr. Manager → CEO. This PRD follows §2.5. **[OPEN Q2]**

### 6.2 Mentor / investor profile approval
Registration → profile submission → office approval → public listing (if made visible). Investor status is a separate approval on top of an approved mentor profile. The number of approval stages is **[OPEN Q6]**.

### 6.3 Connection requests (separate track)
```
Incubatee requests mentor/investor ─▶ Incubation Manager review ─▶ Sr. Manager routing/approval ─▶ Mentor accepts / declines ─▶ ACTIVE connection
```
Exact routing rules are **[OPEN Q7]**.

## 7. Functional requirements

### Phase 1 (8 weeks)

#### 7.1 Authentication & accounts
| ID | Requirement |
|---|---|
| AUTH-1 | Email registration with OTP or email verification. Unverified accounts cannot sign in. |
| AUTH-2 | Google OAuth for external users. Apple OAuth depends on **[OPEN Q4]**. |
| AUTH-3 | Two-token model: a JWT access token (15 min) plus an opaque refresh token (7 days) in an httpOnly, Secure, SameSite=Strict cookie, stored in Redis and rotated on every refresh. Reusing an old refresh token invalidates the session. |
| AUTH-4 | Password reset by email. |
| AUTH-5 | Staff account rules ACC-1 to ACC-8 (§4.3). |
| AUTH-6 | Rate limiting on login, OTP and reset endpoints (Redis). |

#### 7.2 Office users & RBAC
| ID | Requirement |
|---|---|
| RBAC-1 | The six office roles from §4.2, with permissions as in §5, enforced by API middleware (authenticate → resolveRole → requireRole). |
| RBAC-2 | An office user-management screen to create, deactivate and change roles of office users, following ACC-3. |
| RBAC-3 | A dashboard for each role showing its queue, counts and recent activity. |
| RBAC-4 | Office Staff can correct application fields; every such edit is flagged on the application and recorded in the audit log with the old and new values (CIMP overview §2.4). |
| RBAC-5 | Executive / Sr. Executive can download reports and Excel data (delivered with XLS-1). |

#### 7.3 Dynamic forms (Admin IT)
| ID | Requirement |
|---|---|
| FORM-1 | Admin IT can define fields for the incubatee application and the mentor/investor profiles: text, long text, number, date, select, multi-select, file, URL. Each field has validation (required, length, allowed file types). |
| FORM-2 | Form schemas are versioned (`form_schemas`). Answers are stored as `answers{fieldId: value}`, so adding or removing fields needs no data migration. |
| FORM-3 | Admin IT chooses which fields are publicly visible in the directory. |

#### 7.4 Profiles & documents
| ID | Requirement |
|---|---|
| DOC-1 | Incubatee profile and application: dynamic form plus documents (pitch deck, ID proof, business registration, company logo). |
| DOC-2 | Uploads go straight from the browser to S3 via presigned URLs (valid 5 min). The server checks file type and size before issuing a URL; after upload the client confirms with the S3 key, and the server stores the key on the profile or report (CIMP overview §4.3). The API never handles file bytes. |
| DOC-3 | Profile completion status is tracked and shown to the user. |

#### 7.5 Approval engine
| ID | Requirement |
|---|---|
| APR-1 | Implements workflow 6.1 with stage-guarding, fast-track, reject and send-back. |
| APR-2 | Digital signature capture at the Sr. Manager and CEO stages. **[DECIDED]** for Phase 1: drawn or uploaded signature image plus a timestamp, tied to the signer's authenticated session. Legal eSign/DSC goes to Phase 2 (§8). |
| APR-3 | Approval queue for each role, with filters (stage, status, date, industry) and search. |

#### 7.6 Mentors, investors & connections (core)
| ID | Requirement |
|---|---|
| MEN-1 | Mentor registration, profile and approval workflow (6.2). |
| MEN-2 | Investor registration as an extra role for approved mentors, with a separate approval. |
| MEN-3 | Connection requests (6.3): the incubatee requests, the office routes, the mentor accepts or declines, and the result is stored in `connections`. |

#### 7.7 Messaging & notifications
| ID | Requirement |
|---|---|
| MSG-1 | Threaded messaging between an incubatee and the office, and between an incubatee and their assigned mentor. |
| MSG-2 | The Incubation Manager can message mentors and investors; office staff can message incubatees (CIMP overview §2.4). |
| NOT-1 | Dashboard notifications plus automatic email for key events (submission, every stage transition, connection updates, new message). |
| NOT-2 | Unread count and mark-as-read. |

#### 7.8 Audit & public directory
| ID | Requirement |
|---|---|
| AUD-1 | Every mutating action writes an immutable `audit_logs` record: actor, action, entity, diff, timestamp. Only CEO and Admin IT can view the log. |
| PUB-1 | Public directory of approved incubatees, mentors and investors. It shows only the fields Admin IT has made public. |

#### 7.9 Public website

Based on a review of 12 incubator websites (AIC-BIMTECH, IC IIT Patna, FITT IIT Delhi, NSRCEL, T-Hub, Venture Center, KIIT-TBI, CIE IIIT-H, IIM Calcutta Innovation Park, Y Combinator, Techstars, Station F).

| ID | Requirement |
|---|---|
| WEB-1 | Homepage sections, in order: header (with Apply and Login always visible), hero, open-calls strip with deadlines, impact stats, programs by stage, how to apply (steps + eligibility), featured startups (live from the directory), mentors & investors, government schemes grouped by ministry, partners, final call to action, and a footer with contacts for each audience. |
| WEB-2 | Every program card states who it is for, what you get, duration and terms before the applicant applies. |
| WEB-3 | "How to apply" mirrors the portal's real approval workflow and states eligibility. Applying happens in the portal, never through external forms. |
| WEB-4 | Impact stats are rendered on the server (no counters that show "0+"), and each shows its source and an "as of" date. |
| WEB-5 | Every figure comes from one content source, so numbers never contradict each other across pages. |
| WEB-6 | Admin IT edits all website content from the admin panel (stored in `site_config`): stats, open calls, programs, eligibility, schemes, partners, contacts. Real content is pushed at final deployment. Until then the site uses demo data with visible "Sample" tags. |
| WEB-7 | The homepage still renders if the database is slow or unavailable. Only the live sections fall back. |
| WEB-8 | Quality bar: meaningful alt text, no key content hidden in carousels, no placeholder or "#" links at launch, footer year updates automatically, and the layout works on mobile first. |
| WEB-9 | Phase 2: events with registration, and blog. |
| WEB-10 | Privacy policy and terms pages, plus a consent checkbox at registration, as required for personal data under India's DPDP Act 2023. Phase 1, before go-live. |
| WEB-11 | About page (institution, mission, leadership, governance, recognitions) and FAQ page (eligibility, process, terms), all editable by Admin IT. Phase 1; demo pages exist. |
| WEB-12 | Facilities page: labs, co-working, equipment and how to book. Phase 1. |
| WEB-13 | Startup directory with search and filters (sector, stage, location), plus an individual profile page for each startup and mentor. Mentor and investor directory per PUB-1. Phase 1; demo has search and filters. |
| WEB-14 | Each page has its own title and description, share previews (Open Graph) and a sitemap. Portal pages are marked noindex. Phase 1; done in the demo. |

#### 7.10 Portal information (implemented in the demo)

| ID | Requirement |
|---|---|
| INFO-1 | The applicant dashboard shows where the application stands: progress through the stages, who it is waiting on, how long it has been there, what comes next, and the review history. Internal reviewer remarks are never shown to applicants; only the rejection reason is. |
| INFO-2 | Office dashboards show "My queue": applications waiting on that user's stage, the count and the oldest wait. Items waiting 7 days or more are highlighted. |
| INFO-3 | Every application card shows how many days it has been in its current stage. The review panel shows the full application, with search across startup, founder, industry and city. |
| INFO-4 | The demo application form covers basics, founders and team, the venture (pitch, problem, solution, traction) and legal and funding details, with help text, character limits and a completion meter. In Phase 1 the same fields come from the form builder (FORM-1). |

### Phase 2 (separate scope & commercials)

| ID | Requirement |
|---|---|
| QPR-1 | Quarterly progress report form (configurable), draft saving, submission, and office review. |
| QPR-2 | QPR reminders: every Monday at 9 AM during quarter-end weeks, to incubatees who haven't submitted. |
| REM-1 | Profile reminder: 1st of each month at 9 AM, for incomplete profiles. |
| NOT-3 | Custom notification blast to user groups (CEO, Manager, Executive, Admin IT). |
| NOT-4 | Notification dedup: no repeats within a cooldown window (Redis). |
| PDF-1 | Signed PDF of approved applications, QPR PDF, and chat-history PDF (Puppeteer). |
| XLS-1 | Configurable Excel exports (incubatees, mentors, connections, QPR), run as async jobs (processor polls every 30 s). |
| IDC-1 | Virtual ID cards (PDF) for incubatees and mentors from templates Admin IT controls. Sent by email. Renewed by a daily 2 AM expiry job. |
| MEN-4 | Mentorship sessions: scheduling (physical or virtual), document requests to mentees, post-session feedback. |
| INV-1 | Investment proposals sent to the office to arrange pitching sessions. Investors can view and message the startups they invested in. |
| BLG-1 | Blog posts: Office Staff write, Admin IT approves, posts publish to the public site. |
| SIG-2 | Legally valid eSign / DSC, if CIMP needs it **[OPEN Q1]**. This is a third-party integration with per-signature cost. |

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Architecture | Three tiers: web client, stateless REST API, PostgreSQL + Redis, with S3 for files. The API scales horizontally. |
| API conventions | REST for resources. Named action endpoints for workflow steps (`/approve`, `/fast-track`, `/reroute`). Responses use the envelope `{ success, data, meta }`. Zod validates every request body and the environment variables. |
| Security | bcrypt password hashing, RBAC enforced in middleware, rate limiting, presigned S3 only (the API never proxies file bytes), HTTPS everywhere, secrets kept in environment variables. |
| Auditability | Immutable audit log for every mutating request (AUD-1). |
| Performance | Typical pages load in under 2 s on broadband. Approval queues are paginated. |
| Availability | Single-region AWS deployment. Uptime depends on third-party infrastructure (as the proposal states). |
| Deployability | Docker + Docker Compose for local, staging and production. |
| Database changes | Every schema change is a Prisma migration committed with the code (`prisma/migrations`). Deployments run `prisma migrate deploy`; nobody edits the production schema by hand. A demo seed script creates local data and refuses to run in production. |
| Usability | Responsive web UI. English. |

## 9. Technical design

### 9.1 Stack

| Layer | Technology |
|---|---|
| Frontend | **[DECIDED]** Next.js (React, TypeScript, Tailwind), reusing the current prototype UI |
| Backend | **[DECIDED]** Node.js + Express (TypeScript), as stated in the proposal |
| Database | **[PROPOSED, needs CIMP sign-off]** PostgreSQL with Prisma ORM. The proposal and CIMP's spec say MongoDB; see §9.4 for why we recommend changing. **[OPEN Q13]** |
| Cache / sessions | Redis (ioredis): refresh tokens, rate limits, verification tokens, dedup keys |
| Files | AWS S3 (presigned URLs) |
| Email | Nodemailer + Handlebars templates |
| PDF / Excel | Puppeteer / ExcelJS (Phase 2) |
| Jobs | node-cron (Phase 2) |
| Validation | Zod |
| Containers | Docker, Docker Compose |

> **Decision (internal):** Phase 1 uses a separate Express API with a Next.js frontend, in one monorepo. This matches the proposal and the client's spec. The prototype backend is small (~600 lines), so moving it costs little, and a separate API makes the BIIF 2.0 integrations easier. Until the SRS is signed, the prototype stays a Next.js monolith and is used only as a demo for the alignment meeting.

### 9.2 Data model

CIMP's spec defines 13 MongoDB collections. In PostgreSQL each becomes a table. Flexible parts use JSONB columns, and embedded arrays such as approval steps become child tables.

| Table | Purpose | Key fields |
|---|---|---|
| users | All users: incubatees, mentors, investors, office | email, user_types (text[]), office_role, status |
| profiles | Profile data for each user type plus dynamic answers | user_id, answers (JSONB), documents (JSONB), completion_status |
| approvals | Approval workflows for profiles and connections | entity_type, entity_id, current_stage, status |
| approval_steps | One row per decision (actor, remark, signature, timestamp) | approval_id, from_stage, to_stage, actor_id, remark, signature, at |
| connections | Mentor–incubatee and investor–incubatee links | incubatee_id, mentor_id, type, status |
| notifications | Dashboard and email notifications | user_id, type, channel, read |
| threads | Conversations | context, last_message_at (participants in thread_participants) |
| messages | Messages in a thread | thread_id, sender_id, body, attachments (JSONB) |
| reports | QPR and progress reports (Phase 2) | user_id, period, data (JSONB), status |
| blogs | Blog posts (Phase 2) | author_id, slug, status, published_at |
| id_cards | Virtual ID cards (Phase 2) | user_id, generated_url, issued_at |
| form_schemas | Configurable form definitions | schema_type, version, fields (JSONB), is_active |
| site_config | Global key-value config, including website content (WEB-6) | key, value (JSONB), updated_by |
| audit_logs | Immutable action log | actor_id, action, entity_id, diff (JSONB), ts |

### 9.3 API route groups
`/auth` · `/profiles` · `/approvals` · `/connections` · `/messages` · `/notifications` · `/dashboard` · `/upload` · `/admin/*` · `/public/*` in Phase 1. Phase 2 adds `/reports` · `/mentorship` · `/exports` · `/blogs`.

### 9.4 Database choice: PostgreSQL instead of MongoDB

**Recommendation:** PostgreSQL. To be agreed with CIMP at the requirement-alignment meeting (Q13), and confirmed in writing because it changes the proposal.

| Concern | Why PostgreSQL fits better |
|---|---|
| Relational data | Users, applications, approvals, connections, reports and audit logs are linked. Directory filters, stage reports and Excel exports are plain SQL joins. |
| Workflow integrity | A stage change, its approval step and its audit entry are saved in one transaction. They either all succeed or all roll back. |
| Dynamic forms | `answers` and `fields` are JSONB columns, which can be indexed and queried. Admin IT can still add or remove fields without migrations, which was the reason the spec chose MongoDB. |
| Data quality | Foreign keys, unique constraints and NOT NULL rules stop duplicate or orphaned records. |
| Reuse | The demo already uses Prisma. Moving it to PostgreSQL is mostly a provider change, so its data layer carries into Phase 1. |
| Hosting | Managed options in the Mumbai region (AWS RDS, Supabase, Neon), or self-hosted on the Phase 1 VPS within the infra budget. |

What does not change: Redis stays for refresh tokens, rate limits and notification dedup, and S3 stays for files. If CIMP requires MongoDB, the data model in §9.2 maps back to collections one-to-one. MySQL is an acceptable fallback if CIMP's hosting or IT requires it, but its JSON support is weaker for dynamic forms.

## 10. Delivery plan (Phase 1)

Assumes a team of 2 developers (backend + frontend) plus part-time QA/PM. With one developer, expect 14–16 weeks.

| Week | Deliverable | Starting point from the demo (§11) |
|---|---|---|
| 1–2 | Requirement workshop with CIMP. Signed SRS, wireframes, final role and permission matrix, workflow diagrams. Repo, Docker, AWS (S3) and Redis set up. | Demo used as the walkthrough; PRD + §14 matrix as the SRS draft |
| 3 | Auth (AUTH-1…6), users, office roles, RBAC middleware, audit logger | Registration, OTP, Google, staff rules and 6 roles exist; add refresh tokens, password reset, rate limits, middleware |
| 4 | Form builder (FORM-1…3), profiles, S3 uploads (DOC-1…3) | Demo form fields become the first form schema; uploads move to S3 |
| 5 | Approval engine (APR-1…3), notifications (NOT-1…2) | 4-stage engine, send-back, fast-track, trail exist; add image signatures and emails per step |
| 6 | Mentors, investors, connections (MEN-1…3, MSG-2). **Milestone demo on staging.** | New build; public mentors page exists |
| 7 | Role dashboards, messaging threads, public directory, Admin IT site content (WEB-6), hardening | Dashboards, website and directory exist; content moves to `site_config` |
| 8 | UAT with CIMP, production deployment, training | — |

### Milestones & payments (from the proposal)
| Milestone | Acceptance | Payment |
|---|---|---|
| M1: Project initiation | SRS signed by CIMP (end of week 2) | 30% |
| M2: Core system setup | Auth, RBAC, forms, approval engine demonstrated on staging (week 6) | 40% |
| M3: Deployment & handover | Phase 1 live, UAT passed, training done (week 8) | 30% |

Weekly demos on staging. Anything outside the signed SRS goes through a change request.

## 11. Current state

*As of 2026-11-20, branch `feature/cimp-demo`.* The demo is a Next.js monolith on PostgreSQL (Prisma, committed migrations), branded from the official CIMP-BIIF logo, with demo data marked "Sample". It is built to show CIMP the product at the alignment meeting; it is not the Phase 1 architecture (§9).

### 11.1 Built in the demo

| Area | What exists | Phase 1 reuse |
|---|---|---|
| Accounts | Email + OTP registration, Google sign-in verified on the server, consent recorded (WEB-10), staff rules ACC-1…7, CLI-created CEO, CEO's Team page for office users | Logic moves to Express; add refresh tokens, password reset, rate limits |
| Roles | All six office roles from CIMP overview §2.4 | Carried over; finish role-specific actions (§14) |
| Application | 15-field application in 4 sections, completion meter, pitch-deck upload (local disk) | Fields become the first `form_schemas` entry; uploads move to S3 |
| Approval | Executive → Manager → Sr. Manager → CEO, higher rank acts on lower stages, CEO fast-track, typed signatures, reject with reason, send back and resubmit, approval trail, activity log | Engine carried over; signature becomes image capture (APR-2) |
| Information | Applicant "where you stand", office "My queue", days in stage, search, full application panel (INFO-1…4) | Reused |
| Messaging & notifications | Per-application office chat, in-app notifications with unread count | Reworked into threads; emails added per step |
| Public website | Home (animated bodhi tree), About, Programs, How to Apply, Startups (search, filters), Mentors, Facilities, Schemes, FAQ, Privacy, Terms; per-page titles, sitemap | Reused; content moves to `site_config` (WEB-6) |
| Content | Facts from the organisation's own site (archived Mar 2025): name, story, vision, mission, leadership messages, host institute, policies, UN SDG focus, programmes, Bihar seed-fund route, contact | Confirm with CIMP (Q14) |

### 11.2 Coverage of CIMP's overview

| CIMP goal (overview §1.3) | Demo coverage (estimate) |
|---|---|
| G1 Registration, application, approval (Primary) | ~75% |
| G2 Role-based office system (Primary) | ~55% |
| G3 Mentor and investor connections (Primary) | ~5% |
| G4 Notifications, reminders, QPR (Secondary) | ~20% |
| G5 Signed PDFs, Excel, ID cards (Secondary) | 0% |
| G6 Public directory (Secondary) | ~60%, plus a full public website beyond the spec |
| Technology as specified (overview §3–6) | ~20% |
| **Whole specification** | **~30–35%** |
| **Phase 1 scope (this PRD)** | **~45%, at demo quality** |

### 11.3 Not yet started (largest gaps)
- Mentor and investor module and connection workflow (G3, MEN-1…3).
- Admin IT panel: form builder, site content, public field visibility, audit log screen.
- Production architecture: Express API, Redis, S3, Docker, Zod, middleware chain, response envelope, refresh tokens, password reset.
- All of Phase 2: QPR, reminders and scheduled jobs, PDFs, Excel, ID cards, mentorship sessions, investment proposals, blog.

The line-by-line status is in §14.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Full spec doesn't fit in 8 weeks / ₹1.5L | Missed delivery, loss on the project | Agree on Phase 1/Phase 2 at the alignment meeting, sign the SRS, use change requests |
| Digital signature means legal eSign | Third-party integration, cost, timeline | Settle Q1 early. Phase 1 uses image signatures. |
| Stack differs from the proposal (if Next.js only) | Client IT objects at review | Separate Express API, or written agreement |
| Spec ambiguities (approval order, routing) | Rework | Resolve the open questions before week 3 |
| CIMP's IT prefers MongoDB, as written in their spec | Rework of the data layer | Present §9.4 at the alignment meeting; the §9.2 model maps back to collections if needed |
| Infra budget of ₹30k/year for PostgreSQL + Redis + S3 + Puppeteer | Performance or cost overrun | One VPS plus S3 for Phase 1. Review before Phase 2 (Puppeteer needs a lot of memory). |
| Slow client inputs or approvals | Timeline slips | Timelines depend on timely inputs (proposal T&C). Agree response SLAs. |

## 13. Open questions for CIMP

1. **Digital signature:** is a drawn/image signature with an audit trail enough, or do you need legal eSign (Aadhaar eSign / DSC)?
2. **Approval order:** is it Executive → Manager → Sr. Manager → CEO? (§2.4 and §2.5 of your overview conflict.) Who can reject, send back or fast-track at each stage?
3. **Office account creation:** who creates and deactivates office users: the CEO, Admin IT, or both?
4. **Apple sign-in:** is it required? It needs an Apple Developer account ($99/year).
5. **Company email domain(s)** for staff accounts.
6. **Mentor/investor approval:** how many stages, and which roles?
7. **Connection routing:** what exactly happens between Incubation Manager, Sr. Manager and the mentor?
8. **Application form:** which fields and documents do you need at launch?
9. **Hosting:** our AWS account or CIMP's? Any data-residency requirement?
10. **Existing data:** is there current incubatee or mentor data to migrate?
11. **Branding:** logo, colours, domain name.
12. **Single incubation programme or several cohorts/programmes** in Phase 1?
13. **Database:** we recommend PostgreSQL instead of the MongoDB in your spec and our proposal, for transactions, reporting and data integrity (see §9.4). Do you agree, or does your IT team require MongoDB or MySQL?
14. **Official name:** is it "CIMP Business Incubation and Innovation Foundation" (as on the old cimpbiif.com) or the expansion in your overview document? Also confirm the current Director and CEO, and the contact phone number.
15. **Bihar seed-fund flow:** should the portal record Department of Industries seed-fund approval as a step, given seed funding is approved by the Department after pre-incubation?

## 14. Traceability to CIMP's overview document

Every item in *CIMP-BIIF 1.0 High-Level Overview (v1.0, 2025)* mapped to this PRD. **Phase**: 1 = Phase 1 (8 weeks), 2 = Phase 2 (separate scope), 2.0 = BIIF 2.0 (out of scope). **Demo**: ✅ built · 🟡 partly built · ❌ not started.

### 14.1 Features (overview §2)

| Overview § | Item | PRD ID | Phase | Demo |
|---|---|---|:-:|:-:|
| 2.1 | Registration with email verification | AUTH-1 | 1 | ✅ |
| 2.1 | Google OAuth | AUTH-2 | 1 | ✅ |
| 2.1 | Apple OAuth | AUTH-2 [Q4] | 1 | ❌ |
| 2.1 | Dynamic profile and application form, Admin-configurable | FORM-1…3 | 1 | ✅ versioned form builder (no file-type fields yet) |
| 2.1 | Documents: pitch deck, ID proof, business registration, logo | DOC-1, DOC-2 | 1 | ✅ private local storage, type-checked (S3 in Phase 1) |
| 2.1 | Multi-level approval with digital signatures | APR-1, APR-2 | 1 | ✅ typed signature |
| 2.1 | Public profile after CEO approval | WF-4, WEB-13, PUB-1 | 1 | ✅ profile page with logo |
| 2.1 | QPR submission from the dashboard | QPR-1 | 2 | ❌ |
| 2.1 | Mentorship request, feedback, session scheduling | MEN-3, MEN-4 | 1 / 2 | 🟡 request only (no feedback, scheduling) |
| 2.1 | Messaging with office and assigned mentor | MSG-1 | 1 | ✅ unified inbox |
| 2.2 | Mentor registration, profile, approval | MEN-1 | 1 | ✅ |
| 2.2 | Mentor public profile after approval | PUB-1, WEB-13 | 1 | ✅ opt-in profile page |
| 2.2 | Accept / decline mentee requests | MEN-3 | 1 | ✅ |
| 2.2 | Physical or virtual meetings with mentees | MEN-4 | 2 | ❌ |
| 2.2 | Request documents from mentees | MEN-4 | 2 | ❌ |
| 2.2 | Post-session feedback | MEN-4 | 2 | ❌ |
| 2.3 | Mentors register as investors (separate approval) | MEN-2 | 1 | ✅ |
| 2.3 | Investment proposals to the office | INV-1 | 2 | ❌ |
| 2.3 | View and message invested startups | INV-1 | 2 | ❌ |
| 2.4 | Admin IT: form fields, site config, public visibility | FORM-1…3, WEB-6 | 1 | ✅ stats, calls, eligibility, contacts, FAQ, sample mode |
| 2.4 | Admin IT: blog approvals | BLG-1 | 2 | ❌ |
| 2.4 | Admin IT: ID card templates | IDC-1 | 2 | ❌ |
| 2.4 | Admin IT: audit logs | AUD-1 | 1 | ✅ append-only (DB trigger), filters, CSV |
| 2.4 | CEO: final approval and signing, fast-track, all statistics | APR-1, APR-2, RBAC-3 | 1 | ✅ |
| 2.4 | Sr. Manager: approval and signing | APR-1, APR-2 | 1 | ✅ |
| 2.4 | Sr. Manager: route connection requests upward | MEN-3 (6.3) | 1 | ✅ |
| 2.4 | Incubation Manager: due diligence with remarks | APR-1 | 1 | ✅ |
| 2.4 | Incubation Manager: connection routing, message mentors and investors | MEN-3, MSG-2 | 1 | ✅ |
| 2.4 | Executive: accept submissions | APR-1 | 1 | ✅ |
| 2.4 | Executive: custom notifications | NOT-3 | 2 | ❌ |
| 2.4 | Executive: reports and Excel downloads | RBAC-5, XLS-1 | 2 | ❌ |
| 2.4 | Office Staff: view-only access | RBAC-1 | 1 | ✅ |
| 2.4 | Office Staff: edit application fields (flagged) | RBAC-4 | 1 | ✅ reason required, old/new in audit |
| 2.4 | Office Staff: message incubatees | MSG-2 | 1 | ✅ |
| 2.4 | Office Staff: write blog posts | BLG-1 | 2 | ❌ |
| 2.5 | Executive → Manager → Sr. Manager → CEO pipeline | APR-1, WF-1…6 [Q2] | 1 | ✅ |
| 2.5 | Higher roles approve or fast-track at any stage | APR-1, §5 | 1 | ✅ (fast-track: CEO) |
| 2.5 | Every action recorded with timestamp, actor, remark | WF-1, AUD-1 | 1 | ✅ approval trail |
| 2.5 | Digital signatures at Sr. Manager and CEO | APR-2, SIG-2 [Q1] | 1 / 2 | ✅ typed |
| 2.5 | Separate track for connection requests | 6.3, MEN-3 | 1 | ✅ |
| 2.6 | Dashboard notifications | NOT-1, NOT-2 | 1 | ✅ |
| 2.6 | Automatic emails for key events | NOT-1 | 1 | ✅ application, mentor and connection events (SMTP needed to send) |
| 2.6 | Reminders: incomplete profiles, pending QPR | REM-1, QPR-2 | 2 | ❌ |
| 2.6 | Custom notification blast by CEO, Manager, Admin IT | NOT-3 | 2 | ❌ |
| 2.6 | Deduplication within a cooldown window | NOT-4 | 2 | ❌ |
| 2.7 | Configurable Excel exports | XLS-1 | 2 | ❌ |
| 2.7 | Signed PDF of approved applications | PDF-1 | 2 | ❌ |
| 2.7 | QPR PDF download | PDF-1 | 2 | ❌ |
| 2.7 | Chat history PDF export | PDF-1 | 2 | ❌ |
| 2.7 | Virtual ID card PDF by email | IDC-1 | 2 | ❌ |
| 2.8 | Public listing of approved incubatees | PUB-1, WEB-13 | 1 | ✅ search and filters |
| 2.8 | Public listing of mentors and investors | PUB-1 | 1 | ✅ approved, opted-in profiles |
| 2.8 | Admin IT controls visible profile fields | FORM-3 | 1 | ✅ per-field public flag |
| 2.8 | Blog posts from the office team | BLG-1, WEB-9 | 2 | ❌ |

### 14.2 Technology and architecture (overview §3–6)

| Overview § | Item | PRD ref | Demo |
|---|---|---|:-:|
| 3 | Node.js + Express | §9.1 | ❌ Next.js API routes (demo only) |
| 3 | MongoDB (Mongoose) | §9.4 [Q13] | 🔄 PostgreSQL proposed instead |
| 3 | Redis (refresh tokens, rate limits, dedup) | AUTH-3, AUTH-6, NOT-4 | ❌ |
| 3 | JWT + bcrypt + OAuth 2.0 | AUTH-1…3 | 🟡 single 7-day JWT, bcrypt, Google |
| 3 | AWS S3 | DOC-2 | ❌ local disk |
| 3 | Nodemailer + Handlebars | NOT-1 | 🟡 Nodemailer, inline HTML |
| 3 | Puppeteer, ExcelJS | PDF-1, XLS-1 | ❌ |
| 3 | Zod validation | §8 | 🟡 hand-written validation |
| 3 | node-cron | REM-1, QPR-2, XLS-1, IDC-1 | ❌ |
| 3 | Docker + Docker Compose | §8 | ❌ |
| 4.2 | Middleware chain (authenticate → resolveRole → requireRole → validate) and audit logger | RBAC-1, AUD-1 | 🟡 checks per route |
| 4.2 | Response envelope `{ success, data, meta }` | §8 | ❌ |
| 4.3 | Presigned S3 upload flow with confirm step | DOC-2 | ❌ |
| 4.4 | Monthly profile reminder (1st, 9 AM) | REM-1 | ❌ |
| 4.4 | Weekly QPR reminder (Mondays, quarter-end weeks) | QPR-2 | ❌ |
| 4.4 | Export processor (every 30 s) | XLS-1 | ❌ |
| 4.4 | ID card expiry (daily, 2 AM) | IDC-1 | ❌ |
| 5 | 13 collections | §9.2 | 🟡 users, applications, approval steps, activity, messages, notifications |
| 5.3 | One users record with `userType[]` (mentor + investor) | §4.1 | ❌ single role per user |
| 5.3 | Dynamic answers without migrations | FORM-2 | ✅ answers JSONB |
| 6.2 | Route groups `/auth` `/profiles` `/approvals` `/connections` `/messages` `/notifications` `/reports` `/mentorship` `/dashboard` `/exports` `/blogs` `/admin/*` `/public/*` `/upload` | §9.3 | 🟡 auth, approvals, messages, notifications, public, upload, staff |
| 6.3 | 15-min access token, 7-day refresh token in httpOnly cookie, rotation on refresh | AUTH-3 | ❌ |
| 6.3 | Password reset | AUTH-4 | ❌ |
| 6.4 | BIIF 2.0 APIs (accounts, social media, CRM, attendance, leave, partner APIs, AI tools) | §3 Out of scope | n/a |

### 14.3 Where this PRD differs from the overview (to confirm with CIMP)

| Topic | Overview says | This PRD | Why |
|---|---|---|---|
| Organisation name | Centre for Innovation, Management & Policy – Business Incubation & Innovation Fund | CIMP Business Incubation and Innovation Foundation | Name on the organisation's own website (Q14) |
| Approval order | §2.4: Sr. Manager is the first approval level; §2.5: Executive → Manager → Sr. Manager → CEO | Follows §2.5 | The two sections conflict (Q2) |
| Database | MongoDB | PostgreSQL | Transactions, reporting, data integrity (§9.4, Q13) |
| Send back for changes | Not mentioned | Added (WF-3) | Avoids rejecting fixable applications |
| Staff account rules | Not specified | ACC-1…8 | Security: no self sign-up or social login for staff |
| Consent and privacy pages | Not mentioned | WEB-10 | Required under the DPDP Act 2023 |
| Public website pages | Directory and blog only | Full site (§7.9) | Based on a review of 12 incubator websites |
