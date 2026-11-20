# PRD — CIMP-BIIF 1.0 Incubation Management Platform

| | |
|---|---|
| **Client** | CIMP — Centre for Innovation, Management & Policy (BIIF: Business Incubation & Innovation Fund) |
| **Vendor** | Homeasy Automation Pvt. Ltd. |
| **Status** | Draft v0.3, internally agreed; ready for the requirement-alignment meeting with CIMP |
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
- BIIF 2.0 modules: accounts, CRM, social media, attendance, leave

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
- **WF-3.** "Send back" returns the application to the applicant for edits, with a remark. The applicant can't edit the profile while it is under review.
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
| DOC-2 | Uploads go straight from the browser to S3 via presigned URLs (valid 5 min). The server checks file type and size before issuing a URL. |
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

| Week | Deliverable |
|---|---|
| 1–2 | Requirement workshop with CIMP. Signed SRS, wireframes, final role and permission matrix, workflow diagrams. Repo, Docker, AWS (S3) and Redis set up. |
| 3 | Auth (AUTH-1…6), users, office roles, RBAC middleware, audit logger |
| 4 | Form builder (FORM-1…3), profiles, S3 uploads (DOC-1…3) |
| 5 | Approval engine (APR-1…3), notifications (NOT-1…2) |
| 6 | Mentors, investors, connections (MEN-1…3). **Milestone demo on staging.** |
| 7 | Role dashboards, messaging, public directory, emails, hardening |
| 8 | UAT with CIMP, production deployment, training |

### Milestones & payments (from the proposal)
| Milestone | Acceptance | Payment |
|---|---|---|
| M1: Project initiation | SRS signed by CIMP (end of week 2) | 30% |
| M2: Core system setup | Auth, RBAC, forms, approval engine demonstrated on staging (week 6) | 40% |
| M3: Deployment & handover | Phase 1 live, UAT passed, training done (week 8) | 30% |

Weekly demos on staging. Anything outside the signed SRS goes through a change request.

## 11. Current state

A prototype ("Launchpad") was built in April 2026 alongside the proposal. It is a Next.js monolith. **The demo's data layer runs on PostgreSQL with Prisma**, the database proposed for Phase 1 (§9.4), so it can be reused if CIMP agrees. Here is what can be reused:

| Prototype feature | Reuse in Phase 1 |
|---|---|
| Email + OTP registration, Google login with server-side token verification | Logic reused; moved to Express plus the refresh-token model |
| Staff rules: CLI-created CEO, company-domain staff login, no social login for staff | Carried over as ACC-1…7 |
| 2-stage approval (Manager → CEO), fast-track, publish | Replaced by the 4-stage approval engine |
| Per-application messages, notifications, activity log | Reworked into threads / notifications / audit_logs |
| 6 office roles, 4-stage approval with typed signatures, approval trail, Team page (demo) | Logic carried into the Express approval engine; UI reused |
| Public homepage per §7.9 with demo data (`src/content/site.ts`) | Reused; content moves to `site_config` (WEB-6) |
| UI (auth, dashboard, approvals) | Rebranded to CIMP and reused |

Roughly 10–15% of the Phase 1 scope exists, at prototype quality.

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
