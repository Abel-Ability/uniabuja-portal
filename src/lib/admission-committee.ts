// Admission Committee workspace — data types, state machine, and helpers
// This module defines the data contract for the admission committee workspace
// and the state machine for the admission workflow.

import {
  ADMISSION_VALID_TRANSITIONS,
  ADMISSION_STATUS_LABELS,
  ADMISSION_CATEGORY_LABELS,
  OLEVEL_GRADE_POINTS,
  OLEVEL_MAX_RAW_POINTS,
  OLEVEL_MAX_WEIGHTED,
  JAMB_MAX_SCORE,
  JAMB_MAX_WEIGHTED,
  ADMISSION_MAX_SCORE,
} from "./constants";

// ------------------------------------------------------------------
// Data contract types (consumed from Google Apps Script)
// ------------------------------------------------------------------

export type OLevelSubject = {
  subject: string;
  grade: string;
  points: number;
  relevant: boolean;
};

export type AdmissionApplication = {
  id: string;
  userId: string;
  programmeId: string;
  session: string;
  jambNo: string | null;
  status: string;

  // Applicant details
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  faculty: string | null;
  department: string | null;
  programmeName: string | null;

  // Scoring data from Google Apps Script
  jambRawScore: number | null;
  jambContribution: number | null;
  postUtmScore: number | null;
  postUtmContribution: number | null;
  olevelRawPoints: number | null;
  olevelContribution: number | null;
  compositeScore: number | null;
  programmeCutoff: number | null;
  cutoffMet: boolean | null;
  eligible: boolean | null;
  meritRank: number | null;
  olevelSubjects: OLevelSubject[] | null;

  // Committee workflow
  committeeSelectionUserId: string | null;
  committeeSelectionAt: Date | null;
  committeeCategory: string | null;
  committeeJustification: string | null;
  committeeNotes: string | null;

  // Chairman review
  chairmanDecisionUserId: string | null;
  chairmanDecisionAt: Date | null;
  chairmanDecision: string | null;
  chairmanDecisionNotes: string | null;

  // Timestamps
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CommitteeMembership = {
  id: string;
  committee: string;
  userId: string;
  designation: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
};

// ------------------------------------------------------------------
// State machine
// ------------------------------------------------------------------

export function canTransition(currentStatus: string, targetStatus: string): boolean {
  const allowed = ADMISSION_VALID_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(targetStatus);
}

export function getValidTransitions(currentStatus: string): string[] {
  return ADMISSION_VALID_TRANSITIONS[currentStatus] ?? [];
}

export function getStatusLabel(status: string): string {
  return ADMISSION_STATUS_LABELS[status] ?? status;
}

// ------------------------------------------------------------------
// Scoring helpers
// ------------------------------------------------------------------

export function calculateOLevelPoints(grade: string): number {
  return OLEVEL_GRADE_POINTS[grade.toUpperCase()] ?? 0;
}

export function calculateOLevelContribution(rawPoints: number): number {
  return (rawPoints / OLEVEL_MAX_RAW_POINTS) * OLEVEL_MAX_WEIGHTED;
}

export function calculateJambContribution(rawScore: number): number {
  return (rawScore / JAMB_MAX_SCORE) * JAMB_MAX_WEIGHTED;
}

export function calculateCompositeScore(
  jambContribution: number,
  olevelContribution: number,
  postUtmContribution: number = 0,
): number {
  // JAMB 50% + O-Level 50% (Post-UTME replaces JAMB if available)
  const jambComponent = postUtmContribution > 0
    ? postUtmContribution
    : jambContribution;
  return Math.min(jambComponent + olevelContribution, ADMISSION_MAX_SCORE);
}

// ------------------------------------------------------------------
// Access control helpers
// ------------------------------------------------------------------

export function isCommitteeMember(
  memberships: CommitteeMembership[],
  userId: string,
): boolean {
  return memberships.some(
    (m) =>
      m.userId === userId &&
      m.committee === "ADMISSIONS_COMMITTEE" &&
      m.status === "ACTIVE",
  );
}

export function isCommitteeChairman(
  memberships: CommitteeMembership[],
  userId: string,
): boolean {
  return memberships.some(
    (m) =>
      m.userId === userId &&
      m.committee === "ADMISSIONS_COMMITTEE" &&
      m.designation === "CHAIRMAN" &&
      m.status === "ACTIVE",
  );
}

// ------------------------------------------------------------------
// Category helpers
// ------------------------------------------------------------------

export function getCategoryLabel(category: string): string {
  return ADMISSION_CATEGORY_LABELS[category] ?? category;
}

export function requiresJustification(category: string): boolean {
  return category !== "MERIT";
}

// ------------------------------------------------------------------
// Score display helpers
// ------------------------------------------------------------------

export function formatScore(score: number | null, max: number): string {
  if (score === null) return "N/A";
  return `${score.toFixed(2)} / ${max}`;
}

export function formatGrade(grade: string): string {
  return grade.toUpperCase();
}
