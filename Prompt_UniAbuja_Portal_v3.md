## ROLE

You are a senior full-stack engineer and product designer. Build a **modern, secure, mobile-first, accessible web portal** for the University of Abuja (Yakubu Gowon University) — "The University for National Unity". This build must implement every module and requirement below.

## CONTEXT — WHY THIS REBUILD EXISTS

The current portal runs on an end-of-life stack (CentOS 7, Apache, OpenSSL, PHP 7.4, jQuery), is hosted abroad (data-sovereignty risk), has SQL-injection vulnerabilities, uses insecure default logins (JAMB number as username, surname as password), lacks MFA/rate-limiting/CAPTCHA, fails WCAG accessibility, and has fragmented modules with no Single Sign-On (e.g. the Moodle subdomain currently serves the wrong content, transcripts live on a disconnected domain). This build must not repeat any of these failures — treat security, privacy and accessibility as architectural requirements from line one, not features added later.

## VISION STATEMENT

> "Build and sustain an intelligent, inclusive, and secure digital portal that serves as the unified gateway for all academic and administrative experiences — empowering every stakeholder to learn, work, and connect without barriers."

## CORE DESIGN PRINCIPLES (non-negotiable architecture rules)

1. **Open-source-first, owned in-house** — avoid vendor lock-in; institution retains full code/data ownership.
2. **Secure-by-design** — input validation, parameterised queries/ORM only (no raw string-concatenated SQL, ever), CSRF protection, secure session handling, role-based access control (RBAC) baked in from the start.
3. **Privacy-by-design \& compliant** — architect for Nigeria Data Protection Act (NDPA) 2023, WCAG 2.1 AA, and PCI DSS v4.0 as hard requirements: data minimisation, purpose limitation, consent capture, audit trails, and data-subject-rights tooling (access, rectification, erasure, portability).
4. **API-first** — every feature exposed via documented, versioned RESTful (or GraphQL) APIs to support JAMB/WAEC/NECO/NYSC/bank integrations and a future native mobile app.
5. **Modular monolith or microservices** — each of the **16 core modules** (see Part A) independently deployable behind well-defined interfaces; no cascading failures.
6. **Single Sign-On everywhere** — one identity provider (SAML 2.0 / OAuth 2.0 / OpenID Connect) authenticates all modules, including the LMS and transcript system.
7. **Mobile-first \& accessible** — design for smartphone use first; meet WCAG 2.1 Level AA across the entire product.
8. **Resilient-by-design** — no single point of failure; plan for a secondary DR site, automated encrypted offsite backups, tested restore procedures.
9. **CI/CD \& automated testing** — every deployment automated and tested; no manual/ad-hoc releases.
10. **Defence in depth on identity** — MFA at login is necessary but not sufficient; high-risk actions require **step-up (re-)authentication** regardless of session age (see Security \& Compliance Checklist).
11. **Least-exposure key custody** — cryptographic material (transcript-signing keys, encryption keys) is never held in application code or general-purpose servers; it lives in a dedicated KMS/HSM with access logged like any other sensitive action.

## TECHNICAL STACK (recommended)

* **Identity \& SSO:** Central IdP using OAuth 2.0/OpenID Connect (e.g. Keycloak) fronting every module.
* **Backend:** Modular services (Laravel/PHP or Node/NestJS or similar mature framework), PostgreSQL as the primary database.
* **Integration layer:** API gateway / ESB pattern (e.g. WSO2-style) for connecting JAMB CAPS, WAEC/NECO, NIPEDS, NIN verification, Remita, NIBSS/NIP, GIFMIS/TSA, and other national systems.
* **Workflow engine:** BPMN-based engine (e.g. Camunda-style) for multi-stage, audit-logged approval workflows (results, admissions, transcripts, clearance, PG thesis approval).
* **Frontend:** Responsive component-based SPA/SSR framework (React/Next.js or Vue/Nuxt), mobile-first, WCAG 2.1 AA compliant.
* **LMS:** Moodle, correctly configured on its own properly routed subdomain, integrated via SSO with auto-enrolment and grade passback.
* **Hosting:** Hybrid model — sovereign on-premises/local-cloud hosting for core data (no foreign-only hosting), CDN + WAF (e.g. Cloudflare + ModSecurity/OWASP CRS) at the edge.
* **Security baseline:** TLS 1.2+/1.3 everywhere, HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, bcrypt/Argon2 password hashing with per-user salts, MFA (mandatory for staff/admin, phased for students), step-up auth for high-risk actions.
* **Key \& secrets management:** Dedicated secrets manager (e.g. HashiCorp Vault or cloud equivalent) for all credentials/API keys; a separate KMS/HSM (e.g. AWS KMS/CloudHSM equivalent, or an on-prem HSM appliance) exclusively for transcript/document signing keys and any field-level encryption keys — never co-located with application secrets.
* **Observability:** Centralized logging, metrics, distributed tracing, alerting; comprehensive tamper-evident audit logs on every transaction; a **public status page** for planned/unplanned outages.
* **Feature management:** Feature-flag system (e.g. Unleash or equivalent) to support the pilot-faculty → all-faculties phased rollout without branch-based deployment risk.

## DESIGN / UX REQUIREMENTS

* Modern, clean, institutional visual identity reflecting "University of Abuja (Yakubu Gowon University) — The University for National Unity." Follow the live brand theme at uniabuja.edu.ng: primary green `#32a320` (buttons, links, active navigation, dropdown menus, footer, highlights, form-focus borders), dark slate-blue `#2e3e4e` (sub-footer, inner page headers, dark section backgrounds, scrollbars), and white `#ffffff` content surfaces with white text on green/dark fills. Use the Jost + Roboto font pairing and verify exact brand colors/logo with the university.
* Official university logo (use as the portal/header/footer brand mark).
* Landing-page imagery: use a faded/dimmed image of the university entrance gate as the landing-page background (so content remains readable).
* **Hero design (reference idea: tasscemri.org, adapted to UniAbuja branding):** full-screen hero with the entrance-gate image as an `object-cover` background, subtle scroll parallax (background scales/translates slower than content), and a dark gradient overlay (slate-blue `#2e3e4e` → 70% → 20%) for text readability. Content bottom-aligned: eyebrow/label, stacked headline with inline brand-green/gold-coloured words, tagline, pill CTAs (e.g. "Apply Now", "Check Admission"), and a meta row (session/date, location). Decorative vertical accent lines and a countdown/highlight strip are optional.
* **Pill buttons throughout** (`rounded-full`, semibold, shadow with hover lift), colour-coded by purpose (primary actions in brand green, secondary in slate-blue, tertiary outline).
* **Floating quick-access buttons** (reference idea: tasscemri.org):

  * Right-side vertical quick-link rail: fixed, vertically centred, `z-index` above content — buttons to the most important pages (e.g. Portal Login, Apply, Fees, Results, Transcript, LMS, Help). Icons-only on mobile, icon+label on desktop; subtle opacity with full opacity on hover.
  * "Back to top" floating button: fixed bottom-right, circular/pill, visible after scrolling.
  * Optional scroll-progress bar at the very top.
  * Floating buttons must be focusable, keyboard-accessible, and meet WCAG contrast with the brand palette.
* Fully responsive, mobile-first layouts (most students access via smartphone).
* WCAG 2.1 AA compliance: semantic HTML, correct heading hierarchy, descriptive alt text, explicit form labels, visible keyboard-focus states, sufficient color contrast, no `javascript:` links, correct `lang` attribute. **Recorded lecture and orientation video content must ship with captions/transcripts** (NUC e-learning accessibility requirement — see Compliance).
* Unified, in-app + email + SMS notification system for all stage changes across every module.
* Built-in AI-powered help assistant / chatbot for common student and staff queries, backed by a human helpdesk (see Communications \& Helpdesk below).
* Guided onboarding tutorials and a searchable help centre.
* **Document/policy repository**: a version-controlled, citable public library for admission guidelines, student handbook, fee schedules, and other institutional PDFs — currently scattered or absent; every module that references "official guidelines" links here instead of an ad-hoc upload.
* **Cookie/tracking consent banner** (Consent Management Platform) on the public-facing site, distinct from and in addition to the in-portal NDPA data-subject-rights tooling.
* Global search, consistent navigation shell, and a single unified dashboard per user role.
* **Recent announcements on the opening page:** the landing page must display a recent-announcements section (news, notices, deadlines, admission updates) pulled from the communications/announcements feed. Show the most recent items with date, category tag, and link to the full item; a "View all" link to the full notices archive. Announcements feed must be searchable/filterable and respect the role-scoped visibility rules (public announcements for all; role-specific ones only for the relevant roles).
* **Role-scoped UI**: each role's dashboard, navigation, menus, and widgets render ONLY the modules/actions permitted by the Access Control Matrix. No hidden/dead links, no "not authorised" dead ends — a role never sees a panel it cannot use. UI enforcement mirrors backend RBAC, never bypasses it (defence in depth).
* **Session UX**: idle-timeout warning with a countdown before forced logout, a visible "active sessions" panel per user (device, location, last-active) with one-click revoke, and a hard cap on concurrent sessions per account.

## THE CORE MODULES — BUILD SPECIFICATIONS

### 1\. Admissions Module

* Full online application flow for UTME/Direct Entry, postgraduate, and distance-learning programmes.
* Validated document upload (file type/size checks, virus scan) **plus tampering/forgery heuristics on uploaded result slips** (checksum/format validation against the NIPEDS-verified record; flag mismatches for manual Registry review rather than silently accepting).
* Real-time application-tracking dashboard for applicants.
* Rules-based automated eligibility-screening engine.
* Real-time JAMB (CAPS) and WAEC/NECO result verification via API, cross-checked against **NIPEDS** (see Compliance section — CAPS \& NIPEDS specifics).
* Multi-channel (SMS + email) notifications at every application stage.
* Guided post-admission onboarding workflow: acceptance-fee payment → course registration → student ID generation.
* Form auto-save (no data loss on drop-off).
* **Must not** use JAMB number as username / surname as default password — enforce mandatory secure password creation with complexity rules on first login.
* **Parental/guardian consent capture** for applicants under 18, with an age-appropriate privacy notice (NDPA requirement).

### 2\. Fee Payment Module

* Multi-channel payment: bank transfer (via **NIBSS/NIP** instant-payment rails), cards, mobile money, USSD.
* Integrates with Remita (or equivalent) but adds automated invoicing and receipt generation.
* **TSA/GIFMIS remittance**: as a federal university, applicable revenue streams must route to the Treasury Single Account; reconciliation logic must reflect TSA sweep timing, not assume funds are held locally.
* Fee-balance and full payment-history display for each student.
* **Scholarships, waivers \& payment plans**: scholarship awards, fee waivers/remissions, and instalment/payment-plan schedules, each with its own approval chain and audit trail.
* Automated reconciliation and anti-fraud/anomaly detection.
* Deadline alerts and reminders.
* PCI DSS v4.0-compliant handling of any cardholder data (never store raw card data — tokenize via payment processor).
* Financial-reporting dashboard for the Bursary/Finance office: multi-dimensional filtering (faculty, programme, payment channel, date range), reconciliation tools, CSV/Excel export.

### 3\. Examinations and Academic Records Module

* Online exam registration and timetable publication (timetable itself sourced from the Timetabling \& Venue Management module — see Module 15).
* Course registration linked directly to exam eligibility (block registration until fee clearance, per Fee Payment Module).
* Grade-entry portal with a **multi-stage, audit-logged approval workflow** (lecturer → HOD/Dean → Senate/Exams committee).
* Student result portal with cumulative GPA/CGPA computation, aligned to **NUC Minimum Academic Standards (CCMAS)**.
* Examination-misconduct management system: case logging, status tracking, evidence upload, appeal submission.
* **General academic-appeal workflow** (grade disputes outside misconduct cases), routed and tracked the same way as misconduct appeals but as a distinct case type.
* Historical academic-record archive with strict role-based access control.
* **Public result-verification endpoint**, mirroring the transcript verification endpoint, allowing third parties to authenticate a published result by reference number.

### 4\. Accommodation Module

* Online hostel application workflow.
* Transparent, rules-based bed-space allocation algorithm (fair, auditable, not manual/opaque).
* Room-inventory and bed-space dashboard for Student Affairs.
* Wait-list management with automatic notification when space opens.
* Accommodation-fee integration with the Fee Payment Module (verified before allocation is confirmed).
* Maintenance-request portal for resident students (submit, track, resolve).

### 5\. Transcript Generation Module

* Must live **inside** the unified portal under SSO — no more disconnected domain.
* Online transcript request with purpose declaration (job application, further study, etc.).
* Automated queue management and turnaround-time tracking, visible to the requester.
* Secure, **digitally signed** transcript generation with institutional watermarking — **signing keys held exclusively in the KMS/HSM described in the Technical Stack**, never in application code or a general-purpose server.
* Hard-copy option with courier-service integration.
* **Public verification endpoint** allowing third parties (employers, other universities) to authenticate an issued transcript by reference number.
* Transcript-fee payment integrated with the Fee Payment Module.

### 6\. Learning Management System (LMS) Integration

* Properly configured Moodle instance on a correctly routed subdomain (fix current misconfiguration).
* Full SSO with the main portal and **auto-enrolment** based on course registration (sync automatically — no manual enrolment).
* Materials upload, assignment submission, grading workflows.
* **Automated grade passback** from Moodle into the Examinations/Academic Records module.
* Live-class scheduling and video-conferencing integration, with **captioned/transcribed recordings** for accessibility.
* Performance analytics dashboard for lecturers/advisers.
* Mobile-responsive, low-bandwidth-friendly interface (design for constrained connectivity).
* Conforms to the **NUC "Guidelines for e-Learning in Nigerian Universities" (April 2023)**: institutional e-learning strategic plan, staff digital-literacy training before go-live, published policies on student/staff data security and copyright.

### 7\. Departmental and Leadership Profiles Module

* Dynamic, self-service faculty/staff profile pages integrated with **ORCID** and **Scopus** researcher IDs, and linked to an institutional repository.
* Departmental pages: programme information, **NUC accreditation status** (exposed for NUC reporting), news/announcements.
* Organisational chart showing leadership hierarchy (VC, DVCs, Deans, HODs, etc.).
* Self-service content-management interface so departments can update their own content without IT involvement.
* Public-facing integration with the main university website for visibility to prospective students/partners.
* Data model must scale to the institution's actual footprint: **14 faculties, 53 departments, 32 institutes/centres**.

### 8\. Course Registration Module

* Online course registration with add/drop windows aligned to the **Central Academic Calendar** (see Module 17 below).
* Enforce fee clearance before registration is permitted (integrate with Fee Payment Module).
* Prerequisite validation and course-capacity limits with automatic wait-listing.
* Lecture timetable generation and clash detection — **sourced from the Timetabling \& Venue Management module**, not computed independently.
* Automatic roster sync to the LMS for enrolled students.

### 9\. Graduation \& Convocation Module

* Graduation-clearance workflow: multi-department checks (Bursary, Library, Hostel, Sports, Exams/Records) shown as a clear per-student checklist, powered by the standalone Clearance module (Module 12).
* Award classification computation (First Class, Second Class Upper/Lower, etc.) from Senate-approved CGPA.
* Convocation registration: gown hire, convocation-fee payment (via Fee Payment Module), seat assignment, guest limits.
* Degree-certificate and ceremonial-process management, linked to the Transcript Module for verification.
* **NYSC mobilisation handoff**: on final clearance, eligible graduates' data is compiled and submitted through the NYSC Mobilisation module (Module 14) — this is a distinct, high-stakes, deadline-driven national workflow and must not be treated as a footnote of graduation.

### 10\. Alumni Module

* Alumni self-registration and profile updates after graduation.
* Alumni directory (opt-in, privacy-controlled per NDPA).
* Career tracking, alumni association pages, and giving/donation gateway (integrate with Fee Payment Module).
* Continued access to transcript requests and result/degree verification.
* **Scope decision needed**: a full employer-facing job board/career-services platform is a materially larger build than "career tracking." For v1, ship alumni-side career tracking (employment status, employer, sector — self-reported) only; a job-board with employer accounts, listings, and applications should be an explicit v2 decision by the Committee, not assumed in scope here.

### 11\. Library Module

* Catalogue search (OPAC) and e-resource access with a single sign-in via SSO.
* Remote-access proxy for licensed databases (Shibboleth/Renater-style or equivalent).
* Borrowing, holds, and overdue-notification management.
* Library-clearance integration for the Graduation/Convocation workflow.

### 12\. Clearance Module (standalone, reusable)

* Multi-department clearance forms used by Graduation/Convocation, withdrawal/leave of absence, **and SIWES/IT sign-off (Module 13)**.
* Status tracking visible to the student and each department; automatic routing and reminders.
* Rules engine preventing completion until all required departments sign off.

### 13\. Postgraduate School \& Research Supervision Module

PG admission and progression are structurally different from undergraduate and are currently unaddressed beyond a registration-number format:

* PG-specific admission workflow: referee letters, departmental screening, interview scheduling — separate from the JAMB CAPS-routed undergraduate pipeline (PG admission does not go through CAPS).
* Supervisor assignment and workload tracking per department.
* Thesis/dissertation lifecycle: proposal submission and defense scheduling, supervisor milestone sign-off, plagiarism screening (Turnitin/Ithenticate integration), external examiner assignment, viva scheduling and outcome recording.
* Upgrade path from provisional (`UA/PGiiii/iiiiii`) to full registration-number format on completion of registration, per the existing Account Provisioning rules.
* Feeds into Graduation \& Convocation on successful defense and Senate approval.

### 14\. SIWES / Industrial Training Module

Standard ITF-linked requirement for Nigerian universities, currently absent:

* Student logbook submission (digital, periodic).
* Industry supervisor visitation-report capture.
* IT/SIWES coordinator review and sign-off workflow.
* Feeds into the Clearance module as a prerequisite for graduation clearance for applicable programmes.

### 15\. NYSC Mobilisation Module *(new)*

* Compilation of the eligible-graduate list from confirmed Graduation/Convocation records.
* Data formatting and submission workflow aligned to NYSC's mobilisation data requirements and deadlines.
* Status tracking (submitted / queried / accepted) visible to Registry and to the affected students.
* Strict deadline-driven reminders — this is a hard national deadline, not a soft one.

### 16\. Timetabling \& Venue Management Module

Currently implied but not built — Course Registration and Examinations both reference "clash detection" and "timetable" without a system generating either:

* Central venue/room inventory: capacity, building, equipment, faculty ownership.
* Booking and conflict-resolution engine across departments sharing venues.
* Feeds lecture timetables to Course Registration and exam timetables to Examinations \& Academic Records.
* Publishes into the Central Academic Calendar.

### 17\. Health/Clinic Services

Graduation clearance references a "Sports" sign-off and NDPA identifies health data as a special category requiring the tightest controls, but no module currently generates or manages health data (e.g. medical exam-deferment requests, clinic visit records). **This is not included in v1 scope by default.** If the University wants even a minimal medical-deferment workflow (e.g. supporting documentation for exam deferrals), the Committee should approve it as an explicit, separately-scoped module — it would require its own consent model and the strictest access tier in the system (tighter than DVC oversight; see Roles \& Access Control), and should not be added implicitly by an engineering team mid-build.

## CROSS-MODULE INTEGRATION RULES

Build these dependencies explicitly — do not let modules become silos again:

* Fee Payment ↔ Course Registration: registration blocked until fee clearance verified automatically.
* Fee Payment ↔ Examinations: exam eligibility blocked until fee clearance verified automatically.
* Fee Payment ↔ Accommodation: bed-space allocation confirmed only after hostel-fee verification.
* Admissions ↔ Course Registration: seamless handoff from "admitted" status straight into first course registration — no separate manual process.
* Examinations ↔ Transcript Generation: only Senate-approved, verified results feed into transcript generation.
* Course Registration ↔ LMS: automatic roster sync so enrolled students appear in the correct Moodle course automatically.
* Admissions ↔ Departmental Profiles: programme pages link directly to the relevant application form.
* Course Registration ↔ Examinations: exam registration and timetable derive from the student's registered courses.
* Course Registration \& Examinations ↔ Timetabling \& Venue: both consume, not compute, timetable and venue data from Module 16.
* Graduation ↔ Clearance ↔ Library/Accommodation/Exams/Fee/SIWES: convocation clearance is only granted after all required department sign-offs, including library-, fee-, and (where applicable) SIWES-clearance checks.
* Graduation ↔ NYSC Mobilisation: eligible-graduate data flows automatically into the mobilisation compilation — no manual re-entry.
* Postgraduate School ↔ Graduation: successful thesis defense and Senate approval trigger the same graduation-clearance workflow as undergraduate completion.
* Transcript ↔ Alumni: alumni retain verified transcript/result access through their alumni account.
* Clearance ↔ Transcript: degree certificates issued at graduation link to the verified transcript record.
* Timetabling \& Venue ↔ Central Academic Calendar: all scheduling publishes into and reads from the single authoritative calendar.

## SECURITY \& COMPLIANCE CHECKLIST (must be demonstrably implemented, not just described)

* \[ ] Mandatory password change on first login for every account type; no shared/default passwords.
* \[ ] Password policy: minimum 10 characters, upper+lower+digit+special character, dictionary/surname rejection, 180-day expiry, history of 5 previous passwords.
* \[ ] MFA mandatory for staff/admin/faculty; phased rollout to students.
* \[ ] **Step-up (re-)authentication** required before high-risk actions regardless of session age — viewing/downloading a transcript, changing bank/payout or contact details used for password recovery, approving a grade change, granting a role/privilege.
* \[ ] Account lockout after 5 failed attempts (≥15 min, progressive delay), with holder notification; CAPTCHA and rate limiting on all auth surfaces.
* \[ ] Passwords hashed with bcrypt or Argon2 + per-user salt; never stored in plaintext or reversibly encrypted.
* \[ ] Parameterised queries / ORM everywhere — zero raw SQL string concatenation.
* \[ ] CSRF tokens, secure/HttpOnly/SameSite cookies, security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
* \[ ] TLS 1.2+/1.3 enforced site-wide; unused ports/services closed.
* \[ ] WAF (e.g. ModSecurity + OWASP CRS) and CDN/DDoS protection in front of the application.
* \[ ] **Mandatory audit trail**: tamper-evident, non-disableable, user-attributable audit logging of every action by any user — including read access to sensitive data — see "Mandatory Audit Trail" section below.
* \[ ] Encrypted, automated, offsite backups with tested restore procedure and defined RTO/RPO.
* \[ ] **Field-level encryption at rest** for special-category data — NIN, health/medical data, disciplinary records — in addition to standard database encryption.
* \[ ] **Cryptographic key custody**: signing and encryption keys held in a dedicated KMS/HSM, never in application code, config files, or general-purpose servers; key access itself is an audited event.
* \[ ] **API credential lifecycle**: machine-to-machine credentials (JAMB, WAEC/NIPEDS, Remita, NIBSS, GIFMIS) are issued, rotated, expired, and revoked through a documented process — not shared static keys living indefinitely in one config file.
* \[ ] NDPA 2023 features: published privacy notice, lawful-basis tracking, consent capture, data-subject rights (access/rectify/erase/port), DPO-facing tools.
* \[ ] WCAG 2.1 AA verified via automated + manual accessibility testing.
* \[ ] PCI DSS v4.0-aligned handling of any payment card data (prefer tokenized, hosted-field integration over storing card data at all).

## MANDATORY AUDIT TRAIL

Audit logging is a **non-negotiable, always-on architectural requirement**. It must be impossible for any user — including the IT/Portal superuser — to disable, edit, or purge audit logs.

* **Scope — every action by any user**: log all create, read, update, delete, login/logout, approval, payment, export, and verification events, across all 16 in-scope modules. Read access to sensitive data (results, fees, health/disability data, disciplinary records, personal data viewed by Bursary/Exams/Student Affairs/DPO) must be logged, not just state-changing transactions.
* **Attribution \& non-repudiation**: every entry records the acting user (or role/API credential), authenticated session ID, timestamp (UTC with timezone context), source IP/user-agent, and target record identifier. Entries are append-only; no UPDATE/DELETE of log rows is possible via the application or database role.
* **Tamper-evidence**: hash-chained/append-only log store (e.g. write-once storage, cryptographic chaining, or external WORM vault) so any alteration is detectable; logs written to a separate store from application data.
* **Before/after values**: state changes record the prior and new value of affected fields to support reconstruction and dispute resolution.
* **Config \& privilege changes**: RBAC/role/privilege grants, revocations, API-credential issuance/rotation, and all admin configuration changes are logged with the same rigour.
* **Search \& review**: DPO and audit-log-view-only roles (DVC oversight) can search, filter, and export logs; audit access itself is logged.
* **Retention**: audit logs retained per the records-retention schedule (see Compliance), exported to the encrypted offsite backup, and preserved across system migrations.
* **Alerting**: suspicious patterns (e.g. bulk reads of sensitive data, off-hours access, failed approval-chain tampering) trigger security alerts.

## ROLES \& ACCESS CONTROL

Design RBAC for at least these roles, each with a tailored dashboard:

* **Prospective applicant / Student** (undergraduate, postgraduate, distance learning)
* **Lecturer**
* **Head of Department / Dean**
* **Registry / Admissions officer**
* **Bursary / Finance officer**
* **Student Affairs / Accommodation officer**
* **Exams \& Records officer**
* **Postgraduate School Officer** *(PG admission screening, supervisor assignment, thesis-milestone tracking; distinct from undergraduate Registry)*
* **SIWES / Industrial Training Coordinator** *(logbook review, visitation reports, clearance sign-off)*
* **Timetable / Venue Officer** *(venue inventory, booking, conflict resolution)*
* **IT/Portal administrator (superuser)**
* **DVC — Administration / DVC — Academic (superuser, institutional oversight)**: cross-module read-only visibility with drill-down, final escalation/approval authority on cross-cutting decisions, and institutional reporting dashboards — but no day-to-day business transactions and no grade/course mutability (separation of duties from IT superuser). **Does not extend to Module 17 (Health) if and when the Committee approves it** — that module, if built, needs a tier tighter than DVC oversight.
* **VC — (superuser, highest-level institutional oversight)**: cross-module read-only visibility with drill-down, final escalation/approval authority on cross-cutting decisions, and institutional reporting dashboards — but no day-to-day business transactions and no grade/course mutability (separation of duties from IT superuser).  **Extends to Module 17 (Health)**.
* **External/third-party verifier** (limited, unauthenticated access — e.g. transcript/result verification endpoint only)

## ACCESS CONTROL MATRIX

Least-privilege model: every role is granted the minimum permissions required for its function, enforced by the central IdP/RBAC layer on every API call and module. Separation of duties: business-approval rights and IT/superuser rights never co-exist in one role.

Permission legend: R = read, W = write (create/edit), A = approve/finalise, S = submit-for-approval, V = view-only (limited/unauthenticated), – = no access.

Privilege levels (low → high):

1. Public/Guest — public pages + external verification endpoints only
2. Prospective Applicant — own application, payments, tracking
3. Student — own academics: results, registration, fees, hostel, transcripts
4. Lecturer — own-course grading (submit only) + LMS
5. HOD/Dean — dept/faculty: grade approval, rosters, misconduct review
6. Registry/Admissions — applicants, CAPS, eligibility, verification
7. Bursary/Finance — fees, invoicing, reconciliation, waivers; read-only academics
8. Student Affairs/Accommodation — allocation, waitlists, clearance sign-off
9. Exams \& Records — grade chain, results, transcripts
10. Postgraduate School Officer — PG admission, supervisor assignment, thesis milestones
11. SIWES/IT Coordinator — logbooks, visitation reports, SIWES clearance
12. Timetable/Venue Officer — venue inventory, booking, timetable publication
13. IT/Portal Admin (superuser) — full system/RBAC/audit; no business approvals
14. DVC Admin/Academic (superuser oversight) — cross-module read-only, escalation approvals, audit view
15. External/Third-party Verifier — authenticate a record by reference number only

|Role|Admissions|Fees|Exams/Records|Accommodation|Transcript|LMS|Profiles|Grad./Clearance|PG/Research|SIWES|Timetable/Venue|Admin/System|
|-|-|-|-|-|-|-|-|-|-|-|-|-|
|Public/Guest|V|–|V (verify)|–|V (verify)|–|V|–|–|–|–|–|
|Prospective applicant|R/W/S (own app)|W (own fees)|–|W (own hostel app)|–|–|R/W (own profile)|–|R/W/S (PG applicants)|–|–|–|
|Student|R (own status)|R/W (own balance)|R (own results)|R/W (own allocation)|R/W (own requests)|R/W (own courses)|R/W (own profile)|R (own clearance)|R/W (own thesis, if PG)|R/W (own logbook, if applicable)|R (own timetable)|–|
|Lecturer|–|–|S (own course grades)|–|–|R/W (own courses)|R/W (own profile)|–|R/W (own supervisees)|–|R (own timetable)|–|
|HOD/Dean|R|–|A (grade check 1)|R|–|R|R/W (dept pages)|A|R (dept PG)|R (dept SIWES)|R|–|
|Registry/Admissions|R/W/A|–|R|R|–|–|R|R|–|–|–|–|
|Bursary/Finance|R|R/W/A|R|R|R (fee-linked)|–|–|R|R (PG fees)|–|–|–|
|Student Affairs/Accommodation|R|R|R|R/W/A|–|–|–|A (clearance)|–|–|–|–|
|Exams \& Records|–|–|R/W/A|–|R/W/A|R|–|R|R (PG results)|–|–|–|
|Postgraduate School Officer|R (PG apps)|R|R (PG)|–|–|–|R|A (PG track)|R/W/A|–|–|–|
|SIWES/IT Coordinator|–|–|–|–|–|–|–|A (SIWES sign-off)|–|R/W/A|–|–|
|Timetable/Venue Officer|–|–|R (for scheduling)|–|–|–|–|–|–|–|R/W/A|–|
|IT/Portal Admin (superuser)|–|–|–|–|–|–|–|–|–|–|–|R/W/A|
|DVC Admin/Academic (oversight)|R|R|R|R|R|R|R|R (escalation)|R|R|R|R (audit view only)|
|External/third-party verifier|–|–|V (results, by ref.)|–|V (by ref.)|–|–|–|–|–|–|–|

Notes:

* Students/Lecturers/staff self-service edits are limited to their own records; any cross-record change requires the relevant approval role.
* Bursary, Exams \& Records, and Student Affairs read access to student academic data is subject to the audit log and purpose limits under NDPA.
* IT/Portal Admin holds no business-approval rights; DVC oversight holds no mutability rights.
* If Module 17 (Health/Clinic) is approved by the Committee, it requires its own access tier with **no default read access for DVC oversight** — narrower than every role in this table.
* **UI scope**: dashboards and navigation expose only the columns/modules a role holds in this matrix; a role sees no panels for modules marked "–".

## ACCOUNT PROVISIONING \& LOGIN IDENTIFIERS

* **Self-registration is exclusive to prospective applicants** (undergraduate and postgraduate). Already-registered students, staff, and all other internal users must never self-register — their accounts are provisioned from official records only.
* **Already-registered students use their registration number as their login username** (not email, not JAMB number).

  * **Undergraduate format** — `ii\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[x]/iiixxx\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[x]/iii\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[i]` where `i` = integer (digit) and `x` = uppercase letter; `\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[x]` / `\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[i]` are optional single characters:

    * Pattern: 2 digits, optional 1 uppercase letter, `/`, 3 digits, 3 uppercase letters, optional 1 uppercase letter, `/`, 3 digits, optional 1 digit.
    * Regex: `^\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\d{2}\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[A-Z]?/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\d{3}\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[A-Z]{3}\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[A-Z]?/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\d{3}\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\d?$` — input normalised to uppercase before validation.
    * Examples: `12/345ABC/678`, `12A/345ABC/678`, `12A/345ABC/6789`.
  * **Postgraduate — after admission (provisional):** `UA/PGiiii/iiiiii` — `UA/PG` + 4 digits + `/` + 6 digits.

    * Regex: `^UA/PG\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\d{4}/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\d{6}$` — examples: `UA/PG1234/567890`.
  * **Postgraduate — after full registration:** upgraded to the undergraduate format above.
* **Staff username format** — `xx\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[x]ii\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[i]\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[i]` where `x` = uppercase letter and `i` = digit; `\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[x]` / `\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[i]` are optional single characters:

  * Pattern: 2 uppercase letters, optional 1 uppercase letter, 2 digits, optional 1 digit, optional 1 digit.
  * Regex: `^\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\[A-Z]{2,3}\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\d{2,4}$` — input normalised to uppercase before validation.
  * Examples: `AB12`, `ABC12`, `AB123`, `ABC1234`.
  * **Newly employed staff (no staff number yet):** may use their verified personal email as a temporary login username until a staff number is issued, at which point their account is linked/renamed to the staff number. Temporary email accounts must not receive elevated privileges and must be merged or deactivated once the staff number is issued.
* **Institute, Centre, and Remedial-programme students** use their own number systems — implement as configurable placeholder patterns to be finalised later (documented TODOs, not hard-coded).
* **Validation rules:** registration-number format is validated with regex at provisioning and at every login; input is trimmed and uppercased; duplicates and conflicting identifiers are rejected at provisioning.
* **First-login flow for these accounts:** verification-based (email/SMS OTP on file) then forced strong-password creation — see Security \& Compliance Checklist. Because the username is a publicly-known identifier, password resets must be tied to the verified contact on file, never to the username alone.
* **Prospective applicants** self-register and use email as their login username until admitted, at which point their identity is linked to their issued registration number (per Admissions → Course Registration handoff).

## NON-FUNCTIONAL TARGETS

* System availability/uptime target: ≥ 99.5%.
* Student-facing service turnaround (clearance, results, transcripts): same-day to 48 hours.
* Core Web Vitals performance budget met on 3G/low-bandwidth mobile conditions.
* All new deployments go through CI/CD with automated tests — no manual production pushes.
* Defined peak-concurrency targets for known institutional spikes, **including the NYSC mobilisation submission window** in addition to CAPS release, fee deadlines, course-registration day, and results day.

## DELIVERABLES EXPECTED FROM THE AGENT

1. A working, deployable web application implementing all **16 in-scope modules** above with the specified integrations (Module 17 excluded pending Committee decision).
2. A central SSO/identity service all modules authenticate through.
3. Role-based dashboards for each user type listed above, including the three new roles.
4. API documentation for every exposed endpoint, plus a documented API-credential issuance/rotation process for external integrations.
5. A documented security implementation matching the checklist above, including key-custody (KMS/HSM) architecture.
6. Automated test suite (unit + integration) and a basic CI/CD pipeline configuration, with feature-flag support for phased rollout.
7. An accessibility audit report (automated tool output, e.g. axe/Lighthouse) showing WCAG 2.1 AA conformance.
8. Clear setup/deployment documentation (README) covering environment configuration, database migrations, and how to run locally and in production.
9. A one-page scope memo to the Committee on Module 17 (Health/Clinic) and the Alumni job-board question (Module 10), documenting the deliberate exclusion/deferral rather than leaving it ambiguous.

## LEGACY MIGRATION \& OPERATIONS REQUIREMENTS

* **Data migration plan**: inventory of all legacy data (students, results, fees, admissions, transcripts), extraction/cleansing/validation strategy, mapping to the new schema, a rehearsal on staging, defined downtime window, and rollback plan. No data loss or silent corruption is acceptable.
* **Concrete RPO/RTO**: define and publish explicit targets (e.g. RPO ≤ 15 minutes, RTO ≤ 4 hours for core services) and a backup retention schedule (e.g. daily retained 30 days, weekly 12 months, monthly 7 years where regulatory).
* **DR/BCP**: schedule documented, tested disaster-recovery and backup-restore exercises at least twice yearly; produce runbooks and evidence of successful restores.
* **Security testing as a release gate**: SAST, DAST, and SCA/dependency scanning in CI; a penetration test by an independent tester before production go-live and after major changes; vulnerabilities must be triaged and remediated before deployment.
* **SBOM / supply-chain governance**: maintain a software bill of materials; verify licenses of all open-source dependencies; pin and verify third-party images/artifacts.
* **Secrets management**: store all credentials/keys in a dedicated secrets manager (e.g. Vault/cloud equivalent); never in code, config files, or environment dumps. See also API credential lifecycle and KMS/HSM requirements above.
* **Environment separation**: strict dev/staging/production separation with promotion pipelines; automated rollback on failed deployments.
* **Load/performance targets**: define peak concurrency for known spikes (JAMB CAPS release, fee deadlines, course-registration day, results day, NYSC mobilisation window) and test against them (e.g. X concurrent users at Y RPS with p95 latency budget under Z seconds).

## COMPLIANCE \& LEGAL ADDITIONS

* **NDPA breach response**: documented incident-response procedure with a concrete **72-hour notification SLA to the NDPC** for breaches likely to affect data-subject rights/freedoms (NDPA 2023, Section 40); where high risk, affected data subjects are informed directly or publicly.
* **NDPC registration \& annual returns**: the university is a Data Controller and must register with the NDPC and file annual compliance returns. The portal must include tooling that automatically produces and exports the data required for these returns (data inventory, lawful-basis register, processing records).
* **DPO tooling**: a named Data Protection Officer with institutional authority; a DPO dashboard exposing data-mapping, consent register, breach log, and subject-request queue.
* **Annual independent data-protection audit**: the portal must export the underlying evidence (processing records, retention logs) needed for this audit.
* **Children's data**: parental/guardian consent capture for applicants under 18; age-appropriate notices.
* **FOI Act 2011**: a request surface and workflow for Freedom of Information requests, with retention and response-time tracking.
* **Records retention \& data lifecycle**: retention schedules for academic records, transcripts, audit logs, and payment data; automated deletion/purge where lawful.
* **Vendor Data Processing Agreements**: every third-party processor that touches personal data (SMS gateway, email provider, payment processor, cloud backup target) must operate under an NDPA-compliant Data Processing Agreement — a contractual requirement, not just a technical one, but the portal's vendor registry should track DPA status per integration.
* **Payment-rail compliance**: bank-transfer payments route through NIBSS/NIP-compliant channels; applicable revenue streams reconcile against TSA/GIFMIS remittance timing, not treated as instantly available local funds.

## FEATURES / UX ADDITIONS

* **Communications module**: bulk cohort messaging (mass SMS/email to admitted lists, faculties, departments) with templates and send logs; a per-user notification preference centre (channel opt-in/opt-out).
* **Human helpdesk/escalation**: ticketing system behind the AI chatbot with priority/SLA tiers, assignment, and status tracking.
* **Scholarships, waivers \& payment plans**: support in the Fee Payment Module for scholarship awards, fee waivers/remissions, and instalment/payment-plan schedules.
* **Public result-verification endpoint**: mirroring transcript verification, allow third parties to authenticate a published result by reference number.
* **User training, change management \& phased rollout**: training materials for staff, a communication plan for students, and a phased rollout (pilot faculty → all) with defined MVP scope and per-module acceptance criteria / definition of done, supported by the feature-flag system described in the Technical Stack.
* **Document/policy repository, consent management platform, and public status page** — see Design/UX Requirements above.

## EXTERNAL REVIEW — VERIFIED STANDARDS \& ADDITIONS

The following were confirmed against current external sources (NDPC/NDPA 2023, NUC, JAMB, NITDA) and must be treated as hard requirements:

### NDPC / NDPA 2023 operational compliance

* **Registration \& returns**: the university is a Data Controller that must register with the Nigeria Data Protection Commission (NDPC) and file **annual compliance returns**. The portal must include tooling that automatically produces and exports the data required for these returns (data inventory, lawful-basis register, processing records). Context: as of the 2024 returns cycle, only \~1.7% of accredited universities filed — do not repeat this.
* **Breach notification (Section 40)**: report personal-data breaches likely to affect rights/freedoms to the NDPC **within 72 hours**; where high risk, inform affected data subjects directly or publicly.
* **DPO**: name a Data Protection Officer with institutional authority; the DPO dashboard must expose data-mapping, consent register, breach log, and subject-request queue.
* **Data protection audit**: schedule an annual independent data-protection audit; the portal must export the underlying evidence (processing records, retention logs).

### NUC alignment

* **e-Learning**: conform to the NUC "Guidelines for e-Learning in Nigerian Universities" (April 2023) for the LMS module — including an institutional e-learning strategic plan, staff digital-literacy training before LMS go-live, stated policies on student/staff data security and copyright, and accessibility for physically-challenged learners (captioned video content).
* **Academic standards**: academic records and GPA/CGPA computation must align with NUC Minimum Academic Standards (CCMAS); expose accreditation-status data for NUC reporting (ties into Departmental Profiles module).

### JAMB CAPS \& NIPEDS integration specifics

* **CAPS routing**: all undergraduate admissions must be processed **through JAMB CAPS** — no back-door admissions. The Admissions module must support institution-side CAPS workflows: programme/quota parameter setup, batch and instantaneous admission upload, and live two-way status sync so a JAMB-issued admission (and candidate acceptance on eFacility/USSD 55019) reflects in the portal automatically. **Postgraduate admissions are explicitly outside CAPS** and are handled by the Postgraduate School module instead.
* **O-level verification via NIPEDS**: verify WAEC/NECO results through the Nigeria Integrated Post-Secondary Education Data System (NIPEDS) results Bank in addition to direct body APIs; align Direct Entry candidate-record correction with the JAMB TALDAP platform. Flag mismatches between an uploaded document and the NIPEDS-verified record for manual Registry review.
* **Anti-fraud UX**: display official-domain guidance and warn users about fake portals and SMS shortcode spoofing (e.g. 55019) that harvest JAMB numbers; publish only verified official communication channels; never email/SMS users links to payment or credential entry without authenticated context.

### AI governance (chatbot/assistant)

* Align the AI help assistant with NITDA's Guidelines for AI Development (GAID): restrict it to institutional documents via retrieval (RAG) — it must never fabricate academic advice; force human helpdesk handoff when confidence is low; log all interactions for audit; obtain consent before processing any personal data; no student academic data used to train external models.

### National e-government standards

* Align identity/data exchange with NITDA's Nigeria e-Government Interoperability Framework (NeGIF) and the National Data Management Policy — relevant to NIN verification and any inter-agency data sharing (JAMB, NYSC, NIPEDS).

### Institutional context for scale planning

* University of Abuja is a **dual-mode university** (conventional + distance learning) with **14 faculties, 53 departments, and 32 institutes/centres** (as of 2026). The Institute/Centre/Remedial number-system placeholders must be configurable per-unit; plan capacity, RBAC, and data-model scalability accordingly.

### Cross-cutting additions

* **Central Academic Calendar \& Notices**: a single authoritative calendar service (sessions, registration windows, fee deadlines, exam dates, holidays, convocation, NYSC mobilisation window) consumed by every module for scheduling, reminders, and timetable generation — prevents deadline drift across modules.
* **Digital identity cards**: generate QR/NFC-scannable student and staff ID cards (on photo-verified identity) with a public verification endpoint, replacing physical-card-only issuance.



University of Abuja Faculties and Departments (July, 2025)



Faculty of Agriculture

1\. Agricultural Economics

2\. Agricultural Extension \& Rural Sociology

3\. Agronomy

4\. Animal Science

5\. Crop and Environmental Protection

6\. Dairy Science

7\. Fisheries Aquaculture \& Wildlife

8\. Food Science \& Technology

9\. Forestry \& Bioresources

10\. Horticulture \& Landscaping

11\. Soil Science \& Land Resources Management



Faculty of Arts

12\. Arabic

13\. Christian Studies \& Religious Communication

14\. English

15\. History \& Diplomatic Studies

16\. Islamic Studies

17\. Linguistics \& African Languages

18\. Philosophy

19\. Theatre Arts



Faculty of Communication \& Media Studies

20\. Advertising \& Public Relations

21\. Broadcasting, Film \& Multimedia

22\. Development \& Strategic Communication

23\. Information, Journalism \& Media Studies



Faculty of Education

24\. Arts Education

25\. Educational Foundations

26\. Educational Management

27\. Guidance \& Counselling

28\. Science \& Environmental Education

29\. Social Science Education



Faculty of Engineering

30\. Aeronautical Engineering

31\. Agricultural Engineering

32\. Chemical Engineering

33\. Civil Engineering

34\. Electrical \& Electronic Engineering

35\. Mechanical Engineering

36\. Railway Engineering



Faculty of Environmental Science

37\. Architecture

38\. Building \& Quantity Surveying

39\. Estate Management

40\. Industrial Design

41\. Surveying \& Geoinformatics

42\. Urban and Regional Planning



Faculty of Geography \& Atmospheric Sciences

43\. Environmental Management

44\. Geography

45\. Meteorology \& Climate Science

46\. Remote Sensing \& Geospatial Science



Faculty of Law

47\. Islamic Law

48\. Jurisprudence \& International Law

49\. Private \& Property Law

50\. Public Law



Faculty of Management Sciences

51\. Accounting

52\. Banking \& Finance

53\. Business Administration

54\. Entrepreneurship Studies

55\. Hospitality \& Tourism Management

56\. Public Administration



Faculty of Pharmaceutical Sciences

62\. Clinical Pharmacy \& Pharmacy Administration

63\. Pharmaceutical \& Medicinal Chemistry

64\. Pharmaceutical Microbiology \& Biotechnology

65\. Pharmaceutics \& Pharmaceutical Technology

66\. Pharmacognosy \& Ethnopharmacy

67\. Pharmacology \& Toxicology



Faculty of Science

68\. Biochemistry

69\. Biological Sciences

70\. Botany

71\. Chemistry

72\. Computer Science

73\. Geology \& Mining

74\. Mathematics

75\. Microbiology

76\. Physics

77\. Statistics

78\. Zoology



Faculty of Social Sciences

79\. Economics

80\. Library \& Information Science

81\. Political Science \& International Relations

82\. Sociology



Faculty of Veterinary Medicine

83\. Animal Health \& Production

84\. Theriogenology

85\. Veterinary Anatomy

86\. Veterinary Medicine

87\. Veterinary Microbiology

88\. Veterinary Parasitology \& Entomology

89\. Veterinary Pathology

90\. Veterinary Pharmacology \& Toxicology

91\. Veterinary Physiology \& Biochemistry

92\. Veterinary Public Health \& Preventive Medicine

93\. Veterinary Surgery



College of Health Sciences

Faculty of Basic Clinical Sciences

94\. Chemical Pathology

95\. Haematology \& Blood Transfusion

96\. Histopathology \& Forensic Medicine

97\. Medical Microbiology \& Parasitology

98\. Pharmacology \& Therapeutics Medicine



Faculty of Basic Medical Sciences

99\. Anatomical Sciences

100\. Human Physiology

101\. Medical Biochemistry



Faculty of Clinical Sciences

102\. Anaesthesia

103\. Community Medicine

104\. Internal Medicine

105\. Obstetrics \& Gynaecology

106\. Ophthalmology

107\. Orthopaedics \& Trauma

108\. Otorhinolaryngology

109\. Paediatrics

110\. Psychiatry

111\. Radiology

112\. Surgery



Faculty of Nursing \& Allied Health Sciences

57\. Environmental Health Sciences

58\. Medical Laboratory Sciences

59\. Nursing Science

60\. Optometry

61\. Public Health

