# Admission Committee Workspace - Recovery Report

**Date:** 2026-08-20
**Branch:** `recovery/production-security-hardening`
**Commit:** `66850c0` (recovery checkpoint)

## Summary

Implemented the Admission Committee workspace for the University of Abuja Portal, completing **Milestone 2** of the controlled admission decision workflow. The portal acts as the institutional decision and approval layer consuming data from the separately deployed Google Apps Script system.

## What Was Built

### Schema Extensions (`prisma/schema.prisma`)
- `Application` model extended with:
  - Committee workflow fields: `committeeSelectionUserId`, `committeeSelectionAt`, `committeeCategory`, `committeeJustification`, `committeeNotes`
  - Chairman review fields: `chairmanDecisionUserId`, `chairmanDecisionAt`, `chairmanDecision`, `chairmanDecisionNotes`
  - Scoring fields (consumed from Google Apps Script): `jambRawScore`, `jambContribution`, `postUtmScore`, `postUtmContribution`, `olevelRawPoints`, `olevelContribution`, `compositeScore`, `programmeCutoff`, `cutoffMet`, `eligible`, `meritRank`, `olevelSubjects`
  - Applicant detail fields: `applicantName`, `applicantEmail`, `applicantPhone`, `faculty`, `department`, `programmeName`
- `User` model: reverse relations `committeeSelections` and `chairmanDecisions`

### Constants & RBAC (`src/lib/constants.ts`)
- `ADMISSION_COMMITTEE` role with label "Admissions Committee"
- `ACCESS_CONTROL_MATRIX`: ADMISSIONS module (RWA for ADMISSION_COMMITTEE)
- `ADMISSIONS_COMMITTEE` in `COMMITTEES` registry
- `ADMISSION_COMMITTEE_MENU`: 6 dedicated workspace items
- `getMenuForRole()`, `dashboardForRole()`, `landingForRole()` updated
- Admission workflow constants: status labels, valid transitions, categories, chairman decisions
- O-Level scoring: A1=6, B2=5, B3=4, C4=3, C5=2, C6=1, D7/E8/F9=0
- Composite scoring: JAMB weighted 50%, O-Level weighted 50%, max 100

### Data Layer (`src/lib/admission-committee.ts`)
- Types: `OLevelSubject`, `AdmissionApplication`, `CommitteeMembership`
- State machine: `canTransition()`, `getValidTransitions()`
- Scoring helpers: O-Level points, JAMB contribution, composite score
- Access control: `isCommitteeMember()`, `isCommitteeChairman()`

### Server Actions (`src/lib/module-actions.ts`)
- `selectCandidate`: Committee member selects with category + justification
- `deselectCandidate`: Committee member removes selection
- `submitForChairmanReview`: Forward selected to chairman
- `chairmanConfirm`: Chairman admits (final)
- `chairmanReject`: Chairman rejects
- `chairmanReturn`: Chairman returns to committee for review

### Pages (12 files)
| Route | Purpose |
|---|---|
| `/portal/admissions` | Dashboard with stats, workflow, committee members |
| `/portal/admissions/merit-list` | Ranked eligible applicants with filters |
| `/portal/admissions/applications/[id]` | Full applicant detail with score breakdown |
| `/portal/admissions/selected` | Selected candidates pending chairman review |
| `/portal/admissions/chairman` | Chairman review queue |
| `/portal/admissions/decisions` | Admitted/Not Admitted/Returned lists |
| `/portal/admissions/reports` | Statistics and category/faculty breakdowns |
| `/portal/apply` | Public application page with Google Apps Script iframe |

### Other Changes
- `StatusBadge` in `src/components/ui.tsx`: new tones for SHORTLISTED, SELECTED, CHAIRMAN_REVIEW, NOT_ADMITTED, RETURNED, MET, NOT_MET
- `src/lib/help.ts`: ADMISSION_COMMITTEE_HELP registered in ROLE_HELP
- `src/app/portal/applications/page.tsx`: ADMISSION_COMMITTEE redirects to /portal/admissions

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (0 errors) |
| `npm run lint` | **PASS** (0 errors, 53 warnings — 0 from our code) |
| `npm run build` | **PASS** (all 8 new routes registered) |
| `navigation-help.test.ts` | **PASS** (38/38) |
| `constants.test.ts` | **PASS** (25/25) |
| Integration tests | Skipped (require running PostgreSQL) |

## Not In Scope (Per Requirements)
- Google Apps Script system (separate, untouched)
- Application form in Next.js (consumed via iframe)
- Score calculation in portal (consumed from Google Apps Script)
- Student account creation/migration
- Automatic migration or database reset

## Pending / Blockers
- **Schema migration not applied**: `prisma migrate dev` / `prisma db push` needed before runtime
- **Database not running**: Integration tests require `npm run db:start`
- **CAPTCHA_SECRET**: Pre-existing env gap blocks `npm run build` in production mode without the variable set
