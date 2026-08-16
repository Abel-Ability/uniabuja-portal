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

// Degree prefix awarded per department for undergraduate entry. Unknown
// departments fall back to DEFAULT_DEGREE_PREFIX. The programme shown on the
// public apply form is `${prefix} ${department}` (e.g. "B.A. Sociology").
export const DEFAULT_DEGREE_PREFIX = "B.Sc.";

export const DEPARTMENT_DEGREE_PREFIXES: Record<string, string> = {
  // Agriculture
  "Agricultural Economics": "B.Agric.",
  "Agricultural Extension and Rural Sociology": "B.Agric.",
  "Agronomy": "B.Agric.",
  "Animal Science": "B.Agric.",
  "Crop and Environmental Protection": "B.Agric.",
  "Dairy Science": "B.Agric.",
  "Fisheries Aquaculture and Wildlife": "B.Agric.",
  "Food Science and Technology": "B.Sc.",
  "Forestry and Bioresources": "B.Agric.",
  "Horticulture and Landscaping": "B.Agric.",
  "Soil Science and Land Resources Management": "B.Agric.",
  // Arts
  "Arabic": "B.A.",
  "Christian Studies and Religious Communication": "B.A.",
  "English": "B.A.",
  "History and Diplomatic Studies": "B.A.",
  "Islamic Studies": "B.A.",
  "Linguistics and African Languages": "B.A.",
  "Philosophy": "B.A.",
  "Theatre Arts": "B.A.",
  // Communication and Media Studies
  "Advertising": "B.Sc.",
  "Broadcasting": "B.Sc.",
  "Film and Multimedia Studies": "B.Sc.",
  "Development Communication": "B.Sc.",
  "Journalism and Media Studies": "B.Sc.",
  "Information and Media Studies": "B.Sc.",
  "Public Relations": "B.Sc.",
  "Strategic Communication": "B.Sc.",
  // Education
  "Arts Education": "B.Ed.",
  "Educational Foundations": "B.Ed.",
  "Educational Management": "B.Ed.",
  "Guidance and Counselling": "B.Ed.",
  "Science and Environmental Education": "B.Ed.",
  "Social Science Education": "B.Ed.",
  // Engineering
  "Aeronautical Engineering": "B.Eng.",
  "Agricultural Engineering": "B.Eng.",
  "Chemical Engineering": "B.Eng.",
  "Civil Engineering": "B.Eng.",
  "Electrical and Electronic Engineering": "B.Eng.",
  "Mechanical Engineering": "B.Eng.",
  "Railway Engineering": "B.Eng.",
  // Environmental Sciences
  "Architecture": "B.Sc.",
  "Building": "B.Sc.",
  "Estate Management": "B.Sc.",
  "Industrial Design": "B.Sc.",
  "Quantity Surveying": "B.Sc.",
  "Surveying and Geo-informatics": "B.Sc.",
  "Urban and Regional Planning": "B.Sc.",
  // Geography and Atmospheric Sciences
  "Environmental Management": "B.Sc.",
  "Geography": "B.Sc.",
  "Meteorology and Climate Science": "B.Sc.",
  "Remote Sensing and Geospatial Science": "B.Sc.",
  // Law
  "Islamic Law": "LL.B.",
  "Jurisprudence and International Law": "LL.B.",
  "Private and Property Law": "LL.B.",
  "Public Law": "LL.B.",
  // Life Science
  "Biochemistry": "B.Sc.",
  "Biological Sciences": "B.Sc.",
  "Botany": "B.Sc.",
  "Zoology": "B.Sc.",
  "Microbiology": "B.Sc.",
  // Management Sciences
  "Accounting": "B.Sc.",
  "Banking and Finance": "B.Sc.",
  "Business Administration": "B.Sc.",
  "Entrepreneurship Studies": "B.Sc.",
  "Hospitality and Tourism Management": "B.Sc.",
  "Public Administration": "B.Sc.",
  // Pharmaceutical Sciences
  "Clinical Pharmacy and Pharmacy Administration": "B.Pharm.",
  "Pharmaceutical and Medicinal Chemistry": "B.Pharm.",
  "Pharmaceutical Microbiology and Biotechnology": "B.Pharm.",
  "Pharmaceutics and Pharmaceutical Technology": "B.Pharm.",
  "Pharmacognosy and Ethnopharmacy": "B.Pharm.",
  "Pharmacology and Toxicology": "B.Pharm.",
  // Physical Science
  "Chemistry": "B.Sc.",
  "Computer Science": "B.Sc.",
  "Geology and Gemology": "B.Sc.",
  "Mathematics": "B.Sc.",
  "Physics": "B.Sc.",
  "Statistics": "B.Sc.",
  // Social Sciences
  "Economics": "B.Sc.",
  "Library and Information Science": "B.Sc.",
  "Political Science and International Relations": "B.A.",
  "Sociology": "B.A.",
  // Veterinary Medicine
  "Animal Health and Production": "DVM",
  "Theriogenology": "DVM",
  "Veterinary Anatomy": "DVM",
  "Veterinary Medicine": "DVM",
  "Veterinary Microbiology": "DVM",
  "Veterinary Parasitology and Entomology": "DVM",
  "Veterinary Pathology": "DVM",
  "Veterinary Pharmacology and Toxicology": "DVM",
  "Veterinary Physiology and Biochemistry": "DVM",
  "Veterinary Public Health and Preventive Medicine": "DVM",
  "Veterinary Surgery": "DVM",
  // CHS - Basic Clinical Sciences
  "Chemical Pathology": "B.Sc.",
  "Haematology and Blood Transfusion": "B.Sc.",
  "Histopathology and Forensic Medicine": "B.Sc.",
  "Medical Microbiology and Parasitology": "B.Sc.",
  "Pharmacology and Therapeutics Medicine": "B.Sc.",
  // CHS - Basic Medical Sciences
  "Anatomical Sciences": "B.Sc.",
  "Human Physiology": "B.Sc.",
  "Medical Biochemistry": "B.Sc.",
  // CHS - Clinical Sciences
  "Anaesthesia": "MBBS",
  "Community Medicine": "MBBS",
  "Internal Medicine": "MBBS",
  "Obstetrics and Gynaecology": "MBBS",
  "Ophthalmology": "MBBS",
  "Orthopaedics and Trauma": "MBBS",
  "Otorhinolaryngology": "MBBS",
  "Paediatrics": "MBBS",
  "Psychiatry": "MBBS",
  "Radiology": "MBBS",
  "Surgery": "MBBS",
  // CHS - Nursing and Allied Health Sciences
  "Medical Laboratory Sciences": "BMLS",
  "Nursing Science": "B.NSc.",
  "Public Health": "B.Sc.",
  "Environmental Health Sciences": "B.Sc.",
  "Optometry": "OD",
};

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
  HOD: "Head of Department",
  DEAN: "Dean of Faculty",
  REGISTRY: "Registry / Admissions Officer",
  BURSARY: "Bursary / Finance Officer",
  STUDENT_AFFAIRS: "Student Affairs / Accommodation",
  EXAMS_RECORDS: "Exams & Records Officer",
  PG_SCHOOL: "Postgraduate School Officer",
  SIWES: "SIWES / Industrial Training Coordinator",
  TIMETABLE: "Timetable / Venue Officer",
  IT_ADMIN: "IT / Portal Administrator",
  DVC_OVERSIGHT: "DVC Admin / Academic (Oversight)",
  GOVERNANCE_OVERSIGHT_MEMBER: "Governance & Oversight Committee Member",
  VC: "Vice-Chancellor (Institutional Oversight)",
  SBC_CHAIRMAN: "Senate Business Committee Chairman",
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
  | "HEALTH"
  | "SENATE";

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
  SENATE: "Senate & Governance",
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
  HOD: {
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
  // The Dean is a read-only oversight role over faculty-facing modules plus
  // communications. The Dean has no approval action in the results pipeline
  // (SUBMITTED -> HOD_APPROVED -> SENATE_APPROVED -> FINAL); the only Dean
  // write action is returnResult, which is a bespoke, role-gated server action.
  DEAN: {
    ADMISSIONS: P("R"),
    EXAMS_RECORDS: P("R"),
    PROFILES: P("R"),
    GRAD_CLEARANCE: P("R"),
    PG_RESEARCH: P("R"),
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
    SENATE: P("RW"),
  },
  SBC_CHAIRMAN: {
    EXAMS_RECORDS: P("R"),
    SENATE: P("RWA"),
    COMMUNICATIONS: P("RW"),
  },
  BURSARY: {
    ADMISSIONS: P("R"),
    FEES: P("RWA"),
    EXAMS_RECORDS: P("R"),
    ACCOMMODATION: P("R"),
    TRANSCRIPT: P("R"),
    // "A" lets Bursary sign off clearance items for their department ("BURSARY"),
    // matching the CLEARANCE_DEPTS mapping and the audited signOffClearance
    // workflow. Added in the Bursary Workspace Recovery milestone; documented in
    // docs/BURSARY_RECOVERY_MILESTONE.md §RBAC.
    GRAD_CLEARANCE: P("RA"),
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
    SENATE: P("RW"),
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
    SENATE: P("R"),
  },
  GOVERNANCE_OVERSIGHT_MEMBER: {
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
    SENATE: P("R"),
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
    SENATE: P("R"),
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

// Cross-cutting modules appended after PORTAL_MODULES in the generic sidebar.
// Order here is the order they appear in the menu; help mirrors this exactly.
export const CROSS_CUTTING_MODULES: Partial<
  Record<ModuleKey, { href: string; label: string; description: string }>
> = {
  ADMIN_SYSTEM: { href: "/portal/admin", label: "Admin / System", description: "Users, feature flags, API keys" },
  DPO: { href: "/portal/dpo", label: "Data Protection", description: "DPO dashboard, subject requests" },
  COMMUNICATIONS: { href: "/portal/communications", label: "Communications", description: "Announcements and templates" },
  HELPDESK: { href: "/portal/helpdesk", label: "Helpdesk", description: "Tickets and live chat" },
};

// ------------------------------------------------------------------
// Academic sessions, semesters, student categories
// ------------------------------------------------------------------

export const CURRENT_SESSION = "2025/2026";
export const CURRENT_SESSION_START_YEAR = 2025;

// Current registration semester. CourseOffering.semester must equal this for a
// course to be eligible for student registration this semester (see §8 of the
// student registration eligibility milestone). Application constant only — no
// schema change.
export const CURRENT_SEMESTER = 1;

export const SEMESTER_LABELS: Record<number, string> = {
  0: "Backlog",
  1: "First Semester",
  2: "Second Semester",
};

// Lifecycle statuses of a student Registration header (see §6 of the student
// registration finalisation milestone). A header is created atomically in the
// FINALIZED state with lockedAt set — the submission, finalisation and lock are
// one server-side transaction.
export const REGISTRATION_STATUSES = ["SUBMITTED", "FINALIZED", "LOCKED", "CANCELLED"] as const;

export const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  FINALIZED: "Final",
  LOCKED: "Final / Locked",
  CANCELLED: "Cancelled",
};

// Ascending sessions ending at the current one, e.g. 2021/2022 … 2025/2026.
export function academicSessions(year: number = CURRENT_SESSION_START_YEAR): string[] {
  const sessions: string[] = [];
  for (let y = year - 4; y <= year; y += 1) sessions.push(`${y}/${y + 1}`);
  return sessions;
}

export const ACADEMIC_SESSIONS = academicSessions();

export const RESULT_SEMESTERS = [1, 2];
export const BACKLOG_SEMESTER_OPTIONS = [0];
export const RESULT_CA_MAX_OPTIONS = [20, 30, 40, 50, 60, 70];
export const RESULT_CONTENT_TYPES = ["CA", "EXAM", "BOTH"];
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  CA: "Continuous Assessment",
  EXAM: "Examination",
  BOTH: "CA + Exam",
};

export const STUDENT_CATEGORIES = {
  UNDERGRADUATE: "UNDERGRADUATE",
  POSTGRADUATE: "POSTGRADUATE",
  DISTANCE_LEARNING: "DISTANCE_LEARNING",
  REMEDIAL: "REMEDIAL",
  INSTITUTE_OF_EDUCATION: "INSTITUTE_OF_EDUCATION",
} as const;

export type StudentCategory = (typeof STUDENT_CATEGORIES)[keyof typeof STUDENT_CATEGORIES];

export const STUDENT_CATEGORIES_LIST = Object.values(STUDENT_CATEGORIES);

export const STUDENT_CATEGORY_LABELS: Record<string, string> = {
  UNDERGRADUATE: "Undergraduate",
  POSTGRADUATE: "Postgraduate",
  DISTANCE_LEARNING: "Distance Learning",
  REMEDIAL: "Remedial",
  INSTITUTE_OF_EDUCATION: "Institute of Education",
};

// ------------------------------------------------------------------
// Registration-number helpers and level derivation
// ------------------------------------------------------------------

// "99" → 1999, "26" → 2026. Postgraduate provisional numbers (UA/PG…)
// carry no admission year and return null.
export function admissionYearFromRegNo(regNo: string | null | undefined): number | null {
  const m = /^(\d{2})/.exec((regNo ?? "").trim());
  if (!m) return null;
  const yy = Number(m[1]);
  return yy <= 70 ? 2000 + yy : 1900 + yy;
}

export function studentLevel(regNo: string | null | undefined, maxLevel: number): number | null {
  const admitted = admissionYearFromRegNo(regNo);
  if (admitted === null) return null;
  const level = 100 + (CURRENT_SESSION_START_YEAR - admitted) * 100;
  return Math.max(100, Math.min(level, maxLevel));
}

// Programme lengths by degree prefix. Most B.Sc/B.A/B.Ed run 4 years;
// law, engineering, pharmacy and veterinary run 5; MBBS and optometry 6.
const PROGRAMME_DURATION: Record<string, number> = {
  MBBS: 6,
  OD: 6,
  DVM: 5,
  BMLS: 5,
  "B.NSc.": 5,
  "LL.B.": 5,
  "B.Eng.": 5,
  "B.Pharm.": 5,
};

export function departmentMaxLevel(department: string | null | undefined): number {
  const d = (department ?? "").trim();
  if (!d) return 400;
  const prefix = DEPARTMENT_DEGREE_PREFIXES[d] ?? DEFAULT_DEGREE_PREFIX;
  return (PROGRAMME_DURATION[prefix] ?? 4) * 100;
}

export function departmentLevels(maxLevel: number): number[] {
  const levels: number[] = [];
  for (let l = 100; l <= maxLevel; l += 100) levels.push(l);
  return levels;
}

// ------------------------------------------------------------------
// Role landing pages (used by guards to bounce a user to their portal)
// ------------------------------------------------------------------

export function landingForRole(role: string): string {
  switch (role) {
    case "APPLICANT":
      return "/portal/applications";
    case "STUDENT":
      return "/portal/student";
    case "LECTURER":
      return "/portal/lecturer";
    case "HOD":
      return "/portal/hod";
    case "DEAN":
      return "/portal/dean";
    case "REGISTRY":
      return "/portal/admin";
    case "BURSARY":
      return "/portal/bursary";
    case "STUDENT_AFFAIRS":
      return "/portal/hostels";
    case "EXAMS_RECORDS":
      return "/portal/results";
    case "PG_SCHOOL":
      return "/portal/postgraduate";
    case "SIWES":
      return "/portal/siwes";
    case "TIMETABLE":
      return "/portal/timetabling";
    case "IT_ADMIN":
      return "/portal/admin";
    case "DVC_OVERSIGHT":
    case "GOVERNANCE_OVERSIGHT_MEMBER":
      return "/portal/dvc";
    case "VC":
      return "/portal/vc";
    case "SBC_CHAIRMAN":
      return "/portal/sbc";
    case "VERIFIER":
      return "/portal/results";
    default:
      return "/portal/dashboard";
  }
}

// ------------------------------------------------------------------
// Workspace dashboard + results routing helpers
// ------------------------------------------------------------------

// The "dashboard" entry shown at the top of the sidebar. Roles with a
// dedicated workspace get their own dashboard entry; everyone else keeps the
// generic portal dashboard. The workspace menu's first entry usually shares
// this href and is de-duplicated by the shell.
export function dashboardForRole(role: string): {
  href: string;
  label: string;
  desc: string;
} | undefined {
  switch (role) {
    case "STUDENT":
      return { href: "/portal/student", label: "Student Dashboard", desc: "Registration, fees, results" };
    case "LECTURER":
      return { href: "/portal/lecturer", label: "Lecturer Dashboard", desc: "Teaching and results" };
    case "HOD":
      return { href: "/portal/hod", label: "HoD Dashboard", desc: "Department overview" };
    case "DEAN":
      return { href: "/portal/dean", label: "Dean Dashboard", desc: "Faculty overview" };
    case "BURSARY":
      return { href: "/portal/bursary", label: "Bursary Dashboard", desc: "Overview" };
    case "SBC_CHAIRMAN":
      return { href: "/portal/sbc", label: "SBC Dashboard", desc: "Senate scrutiny" };
    case "DVC_OVERSIGHT":
    case "GOVERNANCE_OVERSIGHT_MEMBER":
      return { href: "/portal/dvc", label: "Oversight Dashboard", desc: "University-wide oversight" };
    case "VC":
      return { href: "/portal/vc", label: "VC Dashboard", desc: "Executive dashboard" };
    default:
      return undefined;
  }
}

// The dedicated results surface for each role that owns one. Used both by the
// shared /portal/results fallback and by the navigation design so that every
// role is routed to its own results page instead of the generic module page.
// Returns null for roles whose results live on the shared /portal/results page.
export function resultsForRole(role: string): string | null {
  switch (role) {
    case "HOD":
      return "/portal/hod/approvals";
    case "DEAN":
      return "/portal/dean/results";
    case "SBC_CHAIRMAN":
      return "/portal/sbc/results";
    case "DVC_OVERSIGHT":
    case "GOVERNANCE_OVERSIGHT_MEMBER":
      return "/portal/dvc/academic";
    case "VC":
      return "/portal/vc/results";
    default:
      return null;
  }
}

// ------------------------------------------------------------------
// Menu catalogues for the Dean and HoD quick-action grids
// ------------------------------------------------------------------

export const HOD_MENU: { href: string; label: string; description: string }[] = [
  { href: "/portal/hod", label: "Department Overview", description: "Stats, pending approvals and quick actions" },
  { href: "/portal/hod/students", label: "Students", description: "View and export the department student register" },
  { href: "/portal/hod/staff", label: "Staff", description: "Academic staff in the department" },
  { href: "/portal/hod/approvals", label: "Approvals", description: "Sign off results and requests" },
  { href: "/portal/hod/course-allocation", label: "Course Allocation", description: "Allocate courses to lecturers" },
  { href: "/portal/hod/course-offerings", label: "Course Offerings", description: "Define which courses are offered per programme and level" },
  { href: "/portal/hod/level-advisers", label: "Level Advisers", description: "Assign and manage level advisers" },
  { href: "/portal/hod/level-coordinators", label: "Level Coordinators", description: "Assign and manage level coordinators" },
];

export const DEAN_MENU: { href: string; label: string; description: string }[] = [
  { href: "/portal/dean", label: "Faculty Overview", description: "Dashboard for your faculty" },
  { href: "/portal/dean/students", label: "Students", description: "View and export the faculty student register" },
  { href: "/portal/dean/staff", label: "Staff", description: "Academic staff across the faculty" },
  { href: "/portal/dean/results", label: "Results", description: "Review and return result submissions" },
  { href: "/portal/dean/admissions", label: "Admissions", description: "Monitor admissions into the faculty" },
  { href: "/portal/dean/graduation", label: "Graduation", description: "Graduation and clearance oversight" },
  { href: "/portal/dean/postgraduate", label: "Postgraduate", description: "PG programmes and supervision" },
  { href: "/portal/dean/academic-management", label: "Academic Management", description: "Departmental administration" },
  { href: "/portal/dean/communications", label: "Communications", description: "Faculty-wide announcements" },
];

export const VC_MENU: { href: string; label: string; description: string }[] = [
  { href: "/portal/vc", label: "Executive Dashboard", description: "University-wide command centre" },
  { href: "/portal/vc/results", label: "Results & Records", description: "Executive result pipeline" },
  { href: "/portal/vc/university-overview", label: "University Overview", description: "Population, staffing and faculties" },
  { href: "/portal/vc/academic", label: "Academic Affairs", description: "Course allocation and pipeline" },
  { href: "/portal/vc/governance", label: "Governance", description: "Committee activity and oversight" },
  { href: "/portal/vc/exceptions", label: "Exceptions", description: "Governance exceptions register" },
  { href: "/portal/vc/audit", label: "Audit / Activity", description: "Audit trail and chain integrity" },
  { href: "/portal/vc/students", label: "Students", description: "Whole-institution student register" },
  { href: "/portal/vc/staff", label: "Staff", description: "Staff register across the university" },
  { href: "/portal/vc/reports", label: "Reports", description: "Executive reports" },
  { href: "/portal/appointments", label: "Appointments", description: "Approve Dean and Director proposals" },
];

export const STUDENT_MENU: { href: string; label: string; description: string }[] = [
  { href: "/portal/student", label: "Student Dashboard", description: "Registration status, fees and latest result" },
  { href: "/portal/student/course-registration", label: "Course Registration", description: "Register eligible courses for the session" },
  { href: "/portal/student/view-registration", label: "View / Print Registration", description: "Review your finalised registration reference" },
  { href: "/portal/student/academic-progress", label: "Academic Progress", description: "Grades and progress summary" },
  { href: "/portal/student/courses", label: "My Courses", description: "Courses you are registered for" },
  { href: "/portal/results", label: "My Results", description: "Your published grades" },
  { href: "/portal/fees", label: "Fees & Payments", description: "Invoices, payments and receipts" },
  { href: "/portal/transcripts", label: "Transcripts", description: "Request and track transcripts" },
  { href: "/portal/lms", label: "Learning Management", description: "Moodle SSO and e-learning" },
  { href: "/portal/hostels", label: "Accommodation", description: "Hostel applications and maintenance" },
  { href: "/portal/graduation", label: "Graduation & Clearance", description: "Clearance checklist and convocation" },
  { href: "/portal/profiles", label: "Profiles & Research", description: "Department and staff profiles" },
];

export const LECTURER_MENU: { href: string; label: string; description: string }[] = [
  { href: "/portal/lecturer", label: "Lecturer Dashboard", description: "Assigned courses and completion" },
  { href: "/portal/lecturer/post-results", label: "Post Results", description: "Upload results for an assigned course" },
  { href: "/portal/lecturer/post-backlog", label: "Post Backlog Results", description: "Upload re-sit / backlog results" },
  { href: "/portal/lecturer/course-results", label: "Course Results", description: "Status of results you submitted" },
  { href: "/portal/lecturer/result-files", label: "Result Files", description: "CSV upload history" },
  { href: "/portal/lecturer/result-correction", label: "Result Corrections", description: "Request and track corrections" },
  { href: "/portal/lecturer/level-adviser/cumulative-result", label: "Level Adviser Lookup", description: "Student cumulative and class standing" },
  { href: "/portal/lms", label: "Learning Management", description: "Moodle SSO and e-learning" },
  { href: "/portal/profiles", label: "Profiles & Research", description: "Department and staff profiles" },
];

export const SBC_MENU: { href: string; label: string; description: string }[] = [
  { href: "/portal/sbc", label: "SBC Dashboard", description: "Senate scrutiny overview" },
  { href: "/portal/sbc/results", label: "Results / Senate Scrutiny", description: "University-wide result pipeline" },
  { href: "/portal/sbc/matters", label: "Senate Matters", description: "Matters before the committee" },
  { href: "/portal/sbc/decisions", label: "Decisions", description: "Committee resolutions" },
  { href: "/portal/sbc/reports", label: "Reports", description: "Committee reports" },
  { href: "/portal/sbc/communications", label: "Communications", description: "Senate announcements" },
];

export const DVC_GOVERNANCE_MENU: { href: string; label: string; description: string }[] = [
  { href: "/portal/dvc", label: "Oversight Dashboard", description: "University-wide monitoring" },
  { href: "/portal/dvc/academic", label: "Academic Oversight", description: "Results pipeline and allocations (read-only)" },
  { href: "/portal/dvc/university-overview", label: "University Overview", description: "Population, staffing and faculties" },
  { href: "/portal/dvc/exceptions", label: "Governance Exceptions", description: "Exceptions register" },
  { href: "/portal/dvc/audit", label: "Audit / Activity", description: "Audit trail and chain integrity" },
  { href: "/portal/dvc/reports", label: "Reports", description: "Oversight reports" },
  { href: "/portal/dvc/students", label: "Students", description: "Student register (read-only)" },
  { href: "/portal/dvc/staff", label: "Staff", description: "Staff register (read-only)" },
  { href: "/portal/dvc/communications", label: "Communications", description: "Announcements" },
];

// ------------------------------------------------------------------
// Bursary workspace navigation (sidebar override for the BURSARY role)
// ------------------------------------------------------------------

export const BURSARY_WORKSPACE: { href: string; label: string; description: string }[] = [
  { href: "/portal/bursary", label: "Bursary Dashboard", description: "Financial-management overview" },
  { href: "/portal/bursary/accounts", label: "Student Accounts", description: "Search students and review financial profiles" },
  { href: "/portal/bursary/invoices", label: "Invoices", description: "Issue and manage student invoices" },
  { href: "/portal/bursary/payments", label: "Payments", description: "Payment transactions and receipts" },
  { href: "/portal/bursary/reconciliation", label: "Reconciliation", description: "Match payments and review exceptions" },
  { href: "/portal/bursary/waivers", label: "Waivers", description: "Approve and reject fee waivers" },
  { href: "/portal/bursary/scholarships", label: "Scholarships", description: "Approve and reject scholarship awards" },
  { href: "/portal/bursary/payment-plans", label: "Payment Plans", description: "Installment plans on invoices" },
  { href: "/portal/bursary/clearance", label: "Financial Clearance", description: "Sign off clearance and review obligations" },
  { href: "/portal/bursary/reports", label: "Financial Reports", description: "Revenue, outstanding and activity reports" },
  { href: "/portal/bursary/audit", label: "Audit / Activity", description: "Audit trail and chain integrity" },
];

// ------------------------------------------------------------------
// Role-to-menu resolution
// ------------------------------------------------------------------

export function getMenuForRole(role: string): {
  href: string;
  label: string;
  description: string;
}[] {
  switch (role) {
    case "HOD":
      return HOD_MENU;
    case "DEAN":
      return DEAN_MENU;
    case "VC":
      return VC_MENU;
    case "BURSARY":
      return BURSARY_WORKSPACE;
    case "STUDENT":
      return STUDENT_MENU;
    case "LECTURER":
      return LECTURER_MENU;
    case "SBC_CHAIRMAN":
      return SBC_MENU;
    case "DVC_OVERSIGHT":
    case "GOVERNANCE_OVERSIGHT_MEMBER":
      return DVC_GOVERNANCE_MENU;
    default:
      return [];
  }
}

// ------------------------------------------------------------------
// Financial workspace constants (invoices, payments, waivers, scholarships)
// ------------------------------------------------------------------

export const INVOICE_MODULES = [
  "TUITION",
  "ACCEPTANCE",
  "HOSTEL",
  "TRANSCRIPT",
  "CONVOCATION",
  "SIWES",
  "LIBRARY",
] as const;

export const INVOICE_MODULE_LABELS: Record<string, string> = {
  TUITION: "Tuition",
  ACCEPTANCE: "Acceptance",
  HOSTEL: "Hostel",
  TRANSCRIPT: "Transcript",
  CONVOCATION: "Convocation",
  SIWES: "SIWES",
  LIBRARY: "Library",
};

// Invoice statuses used by the schema; OPEN/OVERDUE/PARTIAL count as outstanding
// for fee clearance (see registerCourse/submitCourseRegistration).
export const INVOICE_STATUSES = ["OPEN", "PAID", "OVERDUE", "WAIVED", "PARTIAL"] as const;

export const PAYMENT_CHANNELS = ["CARD", "TRANSFER", "MOBILE_MONEY", "USSD", "REMITA"] as const;

export const PAYMENT_CHANNEL_LABELS: Record<string, string> = {
  CARD: "Card",
  TRANSFER: "Transfer",
  MOBILE_MONEY: "Mobile Money",
  USSD: "USSD",
  REMITA: "Remita",
};

// Payment status lifecycle: PENDING → SUCCESS | FAILED → RECONCILED (terminal).
export const PAYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILED", "RECONCILED"] as const;

// Statuses that count as "unreconciled" for the reconciliation workspace.
export const UNRECONCILED_PAYMENT_STATUSES = ["PENDING", "SUCCESS"] as const;

export const WAIVER_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const SCHOLARSHIP_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const PAYMENT_PLAN_STATUSES = ["ACTIVE", "COMPLETED", "DEFAULTED"] as const;

export const PAYMENT_PLAN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  DEFAULTED: "Defaulted",
};

// Upper bound for an invoice issued by the Bursary (guards against fat-finger
// and abuse). 500,000,000.00 in naira (kobo).
export const MAX_ISSUABLE_INVOICE_CENTS = 500_000_000_00;

// ------------------------------------------------------------------
// Committee membership (Governance & Oversight Committee)
// ------------------------------------------------------------------

export const COMMITTEES = {
  GOVERNANCE_OVERSIGHT: "GOVERNANCE_OVERSIGHT",
} as const;

export const COMMITTEE_LABELS: Record<string, string> = {
  GOVERNANCE_OVERSIGHT: "Governance & Oversight Committee",
};

export const MEMBERSHIP_DESIGNATIONS = {
  CHAIRMAN: "CHAIRMAN",
  MEMBER: "MEMBER",
} as const;

export const MEMBERSHIP_STATUSES = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
