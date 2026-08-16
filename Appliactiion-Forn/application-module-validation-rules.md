# Validation Rules — University Application Module

| Field | Type | Required | Format / Rule | Example |
|---|---|---|---|---|
| Email address | String | Yes | Standard email regex; unique per applicant | `jane.doe@example.com` |
| Phone number | String | Yes | 11 digits, starts with 0; or +234 + 10 digits | `08012345678` |
| Password | String | Yes | Min 8 chars, 1 uppercase, 1 number, 1 symbol | `Passw0rd!` |
| Surname / First name / Other name | String | Surname & First name required | Letters, hyphens, apostrophes only; 2–50 chars | `Adeyemi` |
| Date of birth | Date | Yes | Must yield age ≥ 15 at time of application; not in future | `2007-04-12` |
| Gender | Enum | Yes | `Male` \| `Female` | — |
| Nationality | String | Yes | From ISO country list | `Nigerian` |
| State of origin | Enum | Yes (if Nigerian) | Must match one of 36 states + FCT | `Kaduna` |
| LGA | Enum | Yes (if Nigerian) | Must belong to selected state (dependent dropdown) | `Zaria` |
| NIN | String | Yes | Exactly 11 numeric digits; validated against NIMC where possible | `12345678901` |
| Passport photograph | File | Yes | JPG/PNG, max 200KB, min 200×200px, white/plain background | — |
| Home / permanent address | String | Yes | Min 10 chars, max 250 chars | — |
| Next of kin — full name | String | Yes | Letters, spaces, hyphens only | — |
| Next of kin — phone | String | Yes | Same as phone rule above | — |
| Next of kin — relationship | Enum | Yes | `Parent`, `Sibling`, `Guardian`, `Spouse`, `Other` | — |
| Sponsor details | String/Enum | Optional unless required by faculty (e.g. Postgraduate) | Same as Next of Kin rules | — |
| JAMB Registration Number | String | Yes (UTME applicants) | 10-char alphanumeric pattern e.g. `NNNNNNNNAA` | `12345678AB` |
| JAMB Score | Integer | Yes (UTME applicants) | 0–400 | `280` |
| JAMB subjects/scores | String/Integer | Yes (UTME) | Exactly 4 subjects; each score 0–100; subject list from JAMB syllabus | — |
| O'Level exam body | Enum | Yes | `WAEC` \| `NECO` \| `NABTEB` \| `GCE` | — |
| O'Level exam number | String | Yes | Alphanumeric, per exam body format | — |
| O'Level exam year | Integer | Yes | 4-digit year, not in future, not older than institution's max allowed years | `2023` |
| O'Level subjects/grades | String/Enum | Yes | Min 5 subjects incl. English & Maths; grade in `A1–F9` (WAEC/NECO) scale; no duplicate subjects | — |
| Number of sittings | Integer | Yes | 1 or 2 only (most institutions cap at 2) | `1` |
| Other qualification — CGPA | Decimal | Yes (DE/PG applicants) | 0.00–5.00 (or 0.00–4.00 depending on scale); must match selected scale | `4.21` |
| Other qualification — graduation year | Integer | Yes (DE/PG applicants) | 4-digit year, not in future | `2022` |
| Programme/course choice | Enum (FK) | Yes | Must be an active programme within faculty/department for the session | — |
| Mode of entry | Enum | Yes | `UTME` \| `Direct Entry` \| `Transfer` | — |
| Document uploads | File | Yes (per required doc list) | PDF/JPG/PNG, max 2MB each, legible scan | — |
| Disability status | Boolean | Yes | `Yes` / `No`; if `Yes`, `disability_type` becomes required | — |
| Catchment area status | Enum | System-derived | Computed from state_of_origin vs institution's catchment list — not user-editable | — |
| Payment amount | Decimal | System-set | Must equal current session's published fee | `₦2,000.00` |
| RRR / payment reference | String | Yes (after payment) | 12-digit numeric (Remita format); verified via payment gateway callback | `123456789012` |
| Payment status | Enum | System-set | `Pending` \| `Paid` \| `Failed` — user cannot manually set to `Paid` | — |
| Declaration consent | Boolean | Yes | Must be `true` to allow final submission | — |
| Signature | File/Signature pad | Yes | PNG upload or captured e-signature | — |
| Application status | Enum | System-set | `Draft` \| `Submitted` \| `Under Review` \| `Shortlisted` \| `Admitted` \| `Rejected` | — |
| Application reference number | String | System-generated | Auto-generated, unique, immutable once issued | `APP/2026/00123456` |

### Cross-field rules
- O'Level subject count + grades must meet the **minimum entry requirement** of the selected programme before submission is allowed.
- JAMB score must meet or exceed the **programme's cut-off mark** for the session (soft warning, not necessarily a hard block, depending on institution policy).
- `entry_level` should auto-set to `200L` when `mode_of_entry = Direct Entry`, and applicant must then supply `Other Qualification` details.
- Application cannot move from `Draft` to `Submitted` unless: bio-data, O'Level, JAMB (if UTME), programme choice, all mandatory documents, and payment status = `Paid` are all complete.
- File uploads should be virus-scanned server-side before being marked `Verified`.
