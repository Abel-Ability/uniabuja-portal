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
