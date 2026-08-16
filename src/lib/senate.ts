import { prisma } from "./prisma";
import {
  CURRENT_SESSION,
  MATTER_CATEGORIES,
  MATTER_STATUSES,
  MATTER_STATUS_LABELS,
  CATEGORY_LABELS,
  RESOLUTIONS,
  RESOLUTION_LABELS,
  AGENDA_STATUSES,
  AGENDA_STATUS_LABELS,
  canScreen,
  canWithdraw,
  canRecordDecision,
} from "./senate-constants";

// Senate Business Committee — shared constants and workflow helpers.
// The SBC Chairman raises and screens matters and records decisions only via
// the matter workflow (SUBMITTED → SCREENED → DECIDED). The official Senate
// agenda is created by Registry / Exams & Records, never by the Chairman.
//
// Pure constants and transition rules live in ./senate-constants (safe for
// client bundles); this module additionally talks to the database.

export {
  CURRENT_SESSION,
  MATTER_CATEGORIES,
  MATTER_STATUSES,
  MATTER_STATUS_LABELS,
  CATEGORY_LABELS,
  RESOLUTIONS,
  RESOLUTION_LABELS,
  AGENDA_STATUSES,
  AGENDA_STATUS_LABELS,
  canScreen,
  canWithdraw,
  canRecordDecision,
};

// Next human-readable matter reference, e.g. SBC/2026/0001. Sequential within
// the current calendar year; the column is unique so any race surfaces loudly.
export async function nextMatterReference(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.senateMatter.count({
    where: { reference: { startsWith: `SBC/${year}/` } },
  });
  return `SBC/${year}/${String(count + 1).padStart(4, "0")}`;
}
