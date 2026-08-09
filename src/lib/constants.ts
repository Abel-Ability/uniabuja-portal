// University of Abuja portal — shared constants
// Brand, roles, the Access Control Matrix, and identifier validation rules.

export const BRAND = {
  primary: "#32a320", // brand green
  dark: "#2e3e4e", // slate blue
  gold: "#c9a227",
  white: "#ffffff",
  fontHead: "Jost",
  fontBody: "Roboto",
  orgName: "University of Abuja",
  orgTagline: "The University for National Unity",
} as const;

export const SESSION_COOKIE = "uap_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours
export const IDLE_TIMEOUT_MS = 1000 * 60 * 30; // 30 min idle warning
export const MAX_CONCURRENT_SESSIONS = 3; // evict oldest beyond this
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 1000 * 60 * 15;

// Password policy per Security & Compliance Checklist
export const PASSWORD_POLICY = {
  minLength: 10,
  requiresUpper: true,
  requiresLower: true,
  requiresDigit: true,
  requiresSpecial: true,
  maxAgeDays: 180,
  history: 5,
};

export const ROLE_LABELS: Record<string, string> = {
  APPLICANT: "Prospective Applicant",
  STUDENT: "Student",
  LECTURER: "Lecturer",
  HOD_DEAN: "Head of Department / Dean",
  REGISTRY: "Registry / Admissions Officer",
  BURSARY: "Bursary / Finance Officer",
  STUDENT_AFFAIRS: "Student Affairs / Accommodation",
  EXAMS_RECORDS: "Exams & Records Officer",
  PG_SCHOOL: "Postgraduate School Officer",
  SIWES: "SIWES / Industrial Training Coordinator",
  TIMETABLE: "Timetable / Venue Officer",
  IT_ADMIN: "IT / Portal Administrator",
  DVC_OVERSIGHT: "DVC Admin / Academic (Oversight)",
  VC: "Vice-Chancellor (Institutional Oversight)",
  VERIFIER: "External / Third-party Verifier",
};

export const ROLES = Object.keys(ROLE_LABELS);

// ------------------------------------------------------------------
// Identifier formats (Account Provisioning rules)
// ------------------------------------------------------------------

// Undergraduate: 2 digits, optional letter, "/", 3 digits, 3-4 uppercase letters, "/", 3-4 digits
export const REGEX_UNDERGRAD =
  /^\d{2}[A-Z]?\/\d{3}[A-Z]{3}[A-Z]?\/\d{3}\d?$/;

// Postgraduate provisional: UA/PG + 4 digits + "/" + 6 digits
export const REGEX_PG_PROVISIONAL = /^UA\/PG\d{4}\/\d{6}$/;

// Staff: 2-3 uppercase letters + 2-4 digits
export const REGEX_STAFF = /^[A-Z]{2,3}\d{2,4}$/;

export function normaliseIdentifier(raw: string): string {
  return (raw ?? "").trim().toUpperCase();
}

export function validateUsernameFormat(username: string): boolean {
  return (
    REGEX_UNDERGRAD.test(username) ||
    REGEX_PG_PROVISIONAL.test(username) ||
    REGEX_STAFF.test(username) ||
    // email usernames allowed for applicants and newly employed staff
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)
  );
}

// ------------------------------------------------------------------
// Access Control Matrix (from the spec)
// Permission legend: R read, W write, A approve, S submit, V verify/view-limited
// ------------------------------------------------------------------

export type ModuleKey =
  | "ADMISSIONS"
  | "FEES"
  | "EXAMS_RECORDS"
  | "ACCOMMODATION"
  | "TRANSCRIPT"
  | "LMS"
  | "PROFILES"
  | "GRAD_CLEARANCE"
  | "PG_RESEARCH"
  | "SIWES"
  | "TIMETABLE_VENUE"
  | "ADMIN_SYSTEM"
  | "LIBRARY"
  | "COMMUNICATIONS"
  | "HELPDESK"
  | "DPO"
  | "HEALTH";

export type Permission = "R" | "W" | "A" | "S" | "V";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  ADMISSIONS: "Admissions",
  FEES: "Fees & Payments",
  EXAMS_RECORDS: "Exams & Academic Records",
  ACCOMMODATION: "Accommodation",
  TRANSCRIPT: "Transcripts",
  LMS: "Learning Management System",
  PROFILES: "Profiles & Research",
  GRAD_CLEARANCE: "Graduation & Clearance",
  PG_RESEARCH: "Postgraduate & Research",
  SIWES: "SIWES / Industrial Training",
  TIMETABLE_VENUE: "Timetabling & Venue",
  ADMIN_SYSTEM: "Admin / System",
  LIBRARY: "Library",
  COMMUNICATIONS: "Communications",
  HELPDESK: "Helpdesk",
  DPO: "Data Protection",
  HEALTH: "Health / Clinic Services",
};

type Matrix = Record<string, Partial<Record<ModuleKey, Permission[]>>>;

const P = (s: string): Permission[] => s.split("") as Permission[];

export const ACCESS_CONTROL_MATRIX: Matrix = {
  PUBLIC: {
    ADMISSIONS: P("V"),
    EXAMS_RECORDS: P("V"),
    TRANSCRIPT: P("V"),
    PROFILES: P("V"),
  },
  APPLICANT: {
    ADMISSIONS: P("RWS"),
    FEES: P("W"),
    ACCOMMODATION: P("W"),
    PROFILES: P("RW"),
    PG_RESEARCH: P("RWS"),
  },
  STUDENT: {
    ADMISSIONS: P("R"),
    FEES: P("RW"),
    EXAMS_RECORDS: P("R"),
    ACCOMMODATION: P("RW"),
    TRANSCRIPT: P("RW"),
    LMS: P("RW"),
    PROFILES: P("RW"),
    GRAD_CLEARANCE: P("R"),
    PG_RESEARCH: P("RW"),
    SIWES: P("RW"),
    TIMETABLE_VENUE: P("R"),
    LIBRARY: P("RW"),
  },
  LECTURER: {
    EXAMS_RECORDS: P("S"),
    LMS: P("RW"),
    PROFILES: P("RW"),
    PG_RESEARCH: P("RW"),
    TIMETABLE_VENUE: P("R"),
    LIBRARY: P("R"),
  },
  HOD_DEAN: {
    ADMISSIONS: P("R"),
    EXAMS_RECORDS: P("A"),
    ACCOMMODATION: P("R"),
    LMS: P("R"),
    PROFILES: P("RW"),
    GRAD_CLEARANCE: P("A"),
    PG_RESEARCH: P("R"),
    SIWES: P("R"),
    TIMETABLE_VENUE: P("R"),
    LIBRARY: P("R"),
    COMMUNICATIONS: P("RW"),
  },
  REGISTRY: {
    ADMISSIONS: P("RWA"),
    EXAMS_RECORDS: P("R"),
    ACCOMMODATION: P("R"),
    PROFILES: P("R"),
    GRAD_CLEARANCE: P("R"),
    LIBRARY: P("R"),
    COMMUNICATIONS: P("RW"),
    HELPDESK: P("RW"),
  },
  BURSARY: {
    ADMISSIONS: P("R"),
    FEES: P("RWA"),
    EXAMS_RECORDS: P("R"),
    ACCOMMODATION: P("R"),
    TRANSCRIPT: P("R"),
    GRAD_CLEARANCE: P("R"),
    PG_RESEARCH: P("R"),
    LIBRARY: P("R"),
    COMMUNICATIONS: P("RW"),
  },
  STUDENT_AFFAIRS: {
    ADMISSIONS: P("R"),
    FEES: P("R"),
    EXAMS_RECORDS: P("R"),
    ACCOMMODATION: P("RWA"),
    GRAD_CLEARANCE: P("A"),
    COMMUNICATIONS: P("RW"),
  },
  EXAMS_RECORDS: {
    EXAMS_RECORDS: P("RWA"),
    TRANSCRIPT: P("RWA"),
    LMS: P("R"),
    GRAD_CLEARANCE: P("R"),
    PG_RESEARCH: P("R"),
    LIBRARY: P("R"),
  },
  PG_SCHOOL: {
    ADMISSIONS: P("R"),
    FEES: P("R"),
    EXAMS_RECORDS: P("R"),
    PROFILES: P("R"),
    GRAD_CLEARANCE: P("A"),
    PG_RESEARCH: P("RWA"),
    HELPDESK: P("R"),
  },
  SIWES: {
    GRAD_CLEARANCE: P("A"),
    SIWES: P("RWA"),
  },
  TIMETABLE: {
    EXAMS_RECORDS: P("R"),
    TIMETABLE_VENUE: P("RWA"),
  },
  IT_ADMIN: {
    ADMIN_SYSTEM: P("RWA"),
    DPO: P("R"),
  },
  DVC_OVERSIGHT: {
    ADMISSIONS: P("R"),
    FEES: P("R"),
    EXAMS_RECORDS: P("R"),
    ACCOMMODATION: P("R"),
    TRANSCRIPT: P("R"),
    LMS: P("R"),
    PROFILES: P("R"),
    GRAD_CLEARANCE: P("R"),
    PG_RESEARCH: P("R"),
    SIWES: P("R"),
    TIMETABLE_VENUE: P("R"),
    ADMIN_SYSTEM: P("R"),
    LIBRARY: P("R"),
    COMMUNICATIONS: P("R"),
    HELPDESK: P("R"),
    DPO: P("R"),
  },
  VC: {
    ADMISSIONS: P("R"),
    FEES: P("R"),
    EXAMS_RECORDS: P("R"),
    ACCOMMODATION: P("R"),
    TRANSCRIPT: P("R"),
    LMS: P("R"),
    PROFILES: P("R"),
    GRAD_CLEARANCE: P("RA"),
    PG_RESEARCH: P("R"),
    SIWES: P("R"),
    TIMETABLE_VENUE: P("R"),
    ADMIN_SYSTEM: P("RA"),
    LIBRARY: P("R"),
    COMMUNICATIONS: P("RA"),
    HELPDESK: P("R"),
    DPO: P("RA"),
    HEALTH: P("R"),
  },
  VERIFIER: {
    EXAMS_RECORDS: P("V"),
    TRANSCRIPT: P("V"),
  },
};

export function permissionsFor(
  role: string,
  module: ModuleKey,
): Permission[] {
  return ACCESS_CONTROL_MATRIX[role]?.[module] ?? [];
}

export function can(role: string, module: ModuleKey, perm: Permission): boolean {
  return permissionsFor(role, module).includes(perm);
}

// Modules a role can see at all (any permission)
export function visibleModules(role: string): ModuleKey[] {
  const row = ACCESS_CONTROL_MATRIX[role] ?? {};
  return (Object.keys(row) as ModuleKey[]).filter((m) => (row[m]?.length ?? 0) > 0);
}

// ------------------------------------------------------------------
// Modules list (16 + cross-cutting) used by navigation
// ------------------------------------------------------------------

export const PORTAL_MODULES: {
  key: ModuleKey;
  slug: string;
  title: string;
  description: string;
}[] = [
  { key: "ADMISSIONS", slug: "applications", title: "Admissions", description: "Apply, track, verify" },
  { key: "FEES", slug: "fees", title: "Fees & Payments", description: "Invoices, payments, waivers" },
  { key: "EXAMS_RECORDS", slug: "results", title: "Exams & Records", description: "Results, grades, appeals" },
  { key: "ACCOMMODATION", slug: "hostels", title: "Accommodation", description: "Hostel applications, maintenance" },
  { key: "TRANSCRIPT", slug: "transcripts", title: "Transcripts", description: "Request and verify transcripts" },
  { key: "LMS", slug: "lms", title: "Learning Management", description: "Moodle SSO, courses, grades" },
  { key: "PROFILES", slug: "profiles", description: "Department and staff profiles", title: "Profiles & Research" },
  { key: "GRAD_CLEARANCE", slug: "graduation", title: "Graduation & Clearance", description: "Clearance, convocation, NYSC handoff" },
  { key: "PG_RESEARCH", slug: "postgraduate", title: "Postgraduate School", description: "PG admissions, supervision, theses" },
  { key: "SIWES", slug: "siwes", title: "SIWES / Industrial Training", description: "Logbooks, visitation, sign-off" },
  { key: "TIMETABLE_VENUE", slug: "timetabling", title: "Timetabling & Venue", description: "Venues, bookings, timetables" },
  { key: "LIBRARY", slug: "library", title: "Library", description: "Catalogue, loans, holds" },
  { key: "HEALTH", slug: "health", title: "Health / Clinic Services", description: "VC oversight only" },
];
