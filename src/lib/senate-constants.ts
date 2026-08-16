// Senate Business Committee — shared constants and pure workflow helpers.
// This module MUST NOT import Prisma: it is safe to pull into client bundles
// (forms/buttons), unlike ../lib/senate which talks to the database.

export const CURRENT_SESSION = "2025/2026";

export const MATTER_CATEGORIES = [
  "ACADEMIC",
  "ADMINISTRATIVE",
  "EXAMINATIONS",
  "DISCIPLINE",
  "FINANCE",
  "STAFF",
  "STUDENT",
  "OTHER",
] as const;

export const MATTER_STATUSES = ["SUBMITTED", "SCREENED", "DECIDED", "WITHDRAWN"] as const;

export const MATTER_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  SCREENED: "Screened for Senate",
  DECIDED: "Decided",
  WITHDRAWN: "Withdrawn",
};

export const CATEGORY_LABELS: Record<string, string> = {
  ACADEMIC: "Academic",
  ADMINISTRATIVE: "Administrative",
  EXAMINATIONS: "Examinations",
  DISCIPLINE: "Discipline",
  FINANCE: "Finance",
  STAFF: "Staff",
  STUDENT: "Student",
  OTHER: "Other",
};

export const RESOLUTIONS = [
  "APPROVED",
  "RATIFIED",
  "ADOPTED",
  "REJECTED",
  "DEFERRED",
  "WITHDRAWN",
] as const;

export const RESOLUTION_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  RATIFIED: "Ratified",
  ADOPTED: "Adopted",
  REJECTED: "Rejected",
  DEFERRED: "Deferred",
  WITHDRAWN: "Withdrawn",
};

export const AGENDA_STATUSES = ["DRAFT", "SCHEDULED", "HELD", "FINALIZED"] as const;

export const AGENDA_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  HELD: "Held",
  FINALIZED: "Finalized",
};

// ---- workflow transitions -------------------------------------------------
// A matter can only be screened while SUBMITTED, and a decision may only be
// recorded once the matter has been screened. There is deliberately no direct
// path from SUBMITTED to DECIDED: the decision workflow is mandatory.

export function canScreen(status: string): boolean {
  return status === "SUBMITTED";
}

export function canWithdraw(status: string): boolean {
  return status === "SUBMITTED";
}

export function canRecordDecision(status: string): boolean {
  return status === "SCREENED";
}
