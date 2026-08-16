import { describe, it, expect } from "vitest";
import {
  ageOn,
  bracketForAge,
  admissionSessionFromRegNo,
  AGE_BRACKETS,
  AGE_REFERENCE_DATE,
  MIN_AGE_SAMPLE,
  NO_PROGRAMME,
  applyStudentFilters,
  computeStudentStats,
  buildFilterOptions,
  paginate,
  crossTab,
  categoryLabel,
  parseStudentFilters,
  studentRowsToCsv,
  displayName,
  statusLabel,
  resolveStudentAdviser,
  type StudentRow,
} from "./student-stats";

const REF = AGE_REFERENCE_DATE; // 15 September of the current session's start year

function row(overrides: Partial<StudentRow>): StudentRow {
  return {
    id: "u0",
    registrationNo: "24/012CSC/0001",
    username: "24/012CSC/0001",
    fullName: "Ada Obi",
    firstName: null,
    lastName: null,
    sex: "Female",
    dateOfBirth: new Date("2005-01-15"),
    department: "Computer Science",
    faculty: "Physical Science",
    status: "ACTIVE",
    studentCategory: "UNDERGRADUATE",
    programmeId: "p1",
    programmeName: "B.Sc Computer Science",
    admissionSession: "2024/2025",
    level: 200,
    age: 21,
    ageBracket: "21–23",
    ...overrides,
  } as StudentRow;
}

// A small department snapshot used across the aggregation tests.
const ROWS: StudentRow[] = [
  row({ id: "u1", registrationNo: "26/012CSC/0001", sex: "Male", dateOfBirth: new Date("2007-05-01"), admissionSession: "2026/2027", level: 100, age: 18, ageBracket: "18–20", fullName: "Ada Obi" }),
  row({ id: "u2", registrationNo: "26/012CSC/0002", sex: "Male", dateOfBirth: new Date("2006-06-01"), admissionSession: "2026/2027", level: 100, age: 19, ageBracket: "18–20", fullName: "Bola Eze" }),
  row({ id: "u3", registrationNo: "26/012CSC/0003", sex: "Female", dateOfBirth: new Date("2007-03-01"), admissionSession: "2026/2027", level: 100, age: 18, ageBracket: "18–20", fullName: "Chidi Musa" }),
  row({ id: "u4", registrationNo: "24/012CSC/0004", sex: "Female", dateOfBirth: new Date("2004-01-01"), admissionSession: "2024/2025", level: 200, age: 21, ageBracket: "21–23", fullName: "Dada Sani" }),
  row({ id: "u5", registrationNo: "24/012CSC/0005", sex: "Male", dateOfBirth: new Date("2003-02-01"), admissionSession: "2024/2025", level: 200, age: 22, ageBracket: "21–23", fullName: "Emeka Lawal" }),
  row({ id: "u6", registrationNo: "UA/PG1001/100001", sex: "Female", dateOfBirth: new Date("1995-04-01"), admissionSession: null, level: null, age: 30, ageBracket: "30–34", studentCategory: "POSTGRADUATE", programmeId: null, programmeName: null, fullName: "Funke Adam" }),
  row({ id: "u7", registrationNo: "UA/PG1002/100002", sex: "Male", dateOfBirth: new Date("1993-05-01"), admissionSession: null, level: null, age: 32, ageBracket: "30–34", status: "SUSPENDED", studentCategory: "POSTGRADUATE", programmeId: null, programmeName: null, fullName: "Garba Yusuf" }),
  row({ id: "u8", registrationNo: "UA/DL1001/100003", sex: "Female", dateOfBirth: null, admissionSession: null, level: null, age: null, ageBracket: null, studentCategory: "DISTANCE_LEARNING", programmeId: null, programmeName: null, fullName: "Halima Bello" }),
  row({ id: "u9", registrationNo: "UA/RM1001/100004", sex: "Male", dateOfBirth: new Date("2008-06-01"), admissionSession: null, level: null, age: 17, ageBracket: "Below 18", studentCategory: "REMEDIAL", programmeId: null, programmeName: null, fullName: "Ibrahim Nweke" }),
  row({ id: "u10", registrationNo: "UA/IOE1001/100005", sex: null, dateOfBirth: null, admissionSession: null, level: null, age: null, ageBracket: null, status: "INACTIVE", studentCategory: "INSTITUTE_OF_EDUCATION", programmeId: null, programmeName: null, fullName: "Jumai Ojo" }),
  row({ id: "u11", registrationNo: "23/012CSC/0006", sex: "Male", dateOfBirth: new Date("2002-07-01"), admissionSession: "2025/2026", level: 300, age: 23, ageBracket: "21–23", status: "GRADUATED", fullName: "Kemi Aliyu" }),
  row({ id: "u12", registrationNo: "23/012CSC/0007", sex: "Female", dateOfBirth: new Date("2001-08-01"), admissionSession: "2025/2026", level: 300, age: 24, ageBracket: "24–26", fullName: "Lami Umar" }),
];

describe("age helpers", () => {
  it("computes whole years on the session reference date", () => {
    expect(ageOn(new Date("2007-01-15"), REF)).toBe(18);
    expect(ageOn(new Date("2005-01-15"), REF)).toBe(20);
  });

  it("does not count a birthday that falls after the reference date", () => {
    expect(ageOn(new Date("2007-10-01"), REF)).toBe(17);
    expect(ageOn(new Date("2007-09-20"), REF)).toBe(17);
  });

  it("handles the reference-date birthday and invalid dates", () => {
    expect(ageOn(new Date("2025-09-15"), REF)).toBe(0);
    expect(ageOn(new Date("invalid"))).toBeNull();
  });

  it("maps ages onto the documented brackets", () => {
    expect(bracketForAge(17)).toBe("Below 18");
    expect(bracketForAge(18)).toBe("18–20");
    expect(bracketForAge(23)).toBe("21–23");
    expect(bracketForAge(29)).toBe("27–29");
    expect(bracketForAge(34)).toBe("30–34");
    expect(bracketForAge(49)).toBe("40–49");
    expect(bracketForAge(50)).toBe("50+");
    expect(bracketForAge(null)).toBeNull();
  });

  it("derives the admission session from a registration number", () => {
    expect(admissionSessionFromRegNo("26/012CSC/0766")).toBe("2026/2027");
    expect(admissionSessionFromRegNo("12/345ABC/678")).toBe("2012/2013");
    expect(admissionSessionFromRegNo("UA/PG1234/567890")).toBeNull();
    expect(admissionSessionFromRegNo(null)).toBeNull();
  });
});

describe("computeStudentStats", () => {
  const stats = computeStudentStats(ROWS);

  it("counts totals and active students", () => {
    expect(stats.total).toBe(12);
    expect(stats.active).toBe(9);
    expect(stats.activePct).toBe(75);
  });

  it("counts sex and derives the male : female ratio with percentages", () => {
    expect(stats.sexRatio.male).toBe(6);
    expect(stats.sexRatio.female).toBe(5);
    expect(stats.sexRatio.malePct).toBe(50);
    expect(stats.sexRatio.femalePct).toBe(41.7);
    expect(stats.sexRatio.ratio).toBe("1.20 : 1");
  });

  it("counts undergraduate and postgraduate students with percentages", () => {
    expect(stats.undergraduate).toBe(7);
    expect(stats.undergraduatePct).toBe(58.3);
    expect(stats.postgraduate).toBe(2);
    expect(stats.postgraduatePct).toBe(16.7);
  });

  it("returns null percentages when there are no students", () => {
    const empty = computeStudentStats([]);
    expect(empty.activePct).toBeNull();
    expect(empty.sexRatio.malePct).toBeNull();
    expect(empty.undergraduatePct).toBeNull();
    expect(empty.sexRatio.ratio).toBeNull();
  });

  it("builds level buckets with the actual levels and reports unknown", () => {
    expect(stats.byLevel.buckets.map((b) => [b.label, b.count])).toEqual([
      ["100 Level", 3],
      ["200 Level", 2],
      ["300 Level", 2],
    ]);
    expect(stats.byLevel.unknown).toBe(5);
    expect(stats.byLevel.buckets.reduce((a, b) => a + b.count, 0)).toBe(7);
  });

  it("sorts sessions newest-first and keeps unknown separate", () => {
    expect(stats.bySession.buckets.map((b) => [b.label, b.count])).toEqual([
      ["2026/2027", 3],
      ["2025/2026", 2],
      ["2024/2025", 2],
    ]);
    expect(stats.bySession.unknown).toBe(5);
  });

  it("shows the real sex categories and does not convert unknowns", () => {
    expect(stats.bySex.buckets.map((b) => [b.label, b.count])).toEqual([
      ["Male", 6],
      ["Female", 5],
    ]);
    expect(stats.bySex.unknown).toBe(1);
  });

  it("counts programmes and routes missing programmes to unknown", () => {
    expect(stats.byProgramme.buckets).toEqual([{ label: "B.Sc Computer Science", count: 7, pct: 58.3 }]);
    expect(stats.byProgramme.unknown).toBe(5);
    expect(stats.programmeCount).toBe(1);
  });

  it("labels categories from the shared category registry", () => {
    expect(categoryLabel("UNDERGRADUATE")).toBe("Undergraduate");
    expect(categoryLabel("POSTGRADUATE")).toBe("Postgraduate");
    expect(categoryLabel("DISTANCE_LEARNING")).toBe("Distance Learning");
    expect(categoryLabel(null)).toBe("(none)");
    expect(stats.byCategory.buckets.map((b) => [b.label, b.count])).toEqual([
      ["Undergraduate", 7],
      ["Postgraduate", 2],
      ["Distance Learning", 1],
      ["Institute of Education", 1],
      ["Remedial", 1],
    ]);
  });

  it("uses the real statuses with human labels", () => {
    expect(stats.byStatus.buckets.map((b) => [b.label, b.count])).toEqual([
      ["Active", 9],
      ["Graduated", 1],
      ["Inactive", 1],
      ["Suspended", 1],
    ]);
  });

  it("orders age brackets naturally and reports missing DOB", () => {
    expect(stats.byAgeBracket.buckets.map((b) => [b.label, b.count])).toEqual([
      ["Below 18", 1],
      ["18–20", 3],
      ["21–23", 3],
      ["24–26", 1],
      ["30–34", 2],
    ]);
    expect(stats.byAgeBracket.unknown).toBe(2);
  });

  it("computes min/max/mean/median age from valid DOB records only", () => {
    expect(stats.ageStats.n).toBe(10);
    expect(stats.ageStats.min).toBe(17);
    expect(stats.ageStats.max).toBe(32);
    expect(stats.ageStats.mean).toBe(22.4);
    expect(stats.ageStats.median).toBe(21.5);
  });

  it("withholds mean/median when the valid sample is too small", () => {
    const tiny = computeStudentStats(ROWS.slice(0, 2));
    expect(tiny.ageStats.n).toBe(2);
    expect(tiny.ageStats.min).toBe(18);
    expect(tiny.ageStats.max).toBe(19);
    expect(tiny.ageStats.mean).toBeNull();
    expect(tiny.ageStats.median).toBeNull();
    expect(MIN_AGE_SAMPLE).toBe(5);
  });

  it("builds an age profile per level", () => {
    expect(stats.ageProfileByLevel).toEqual([
      { level: "100", n: 3, mean: 18.3, median: 18 },
      { level: "200", n: 2, mean: 21.5, median: 21.5 },
      { level: "300", n: 2, mean: 23.5, median: 23.5 },
    ]);
  });

  it("reports data quality without hiding incomplete records", () => {
    expect(stats.dataQuality.missingDob).toBe(2);
    expect(stats.dataQuality.missingSex).toBe(1);
    expect(stats.dataQuality.missingProgramme).toBe(5);
    expect(stats.dataQuality.missingLevel).toBe(5);
    expect(stats.dataQuality.missingCategory).toBe(0);
    expect(stats.dataQuality.missingStatus).toBe(0);
  });

  it("counts duplicate registration numbers within the scope", () => {
    const withDup = ROWS.map((r, i) =>
      i === ROWS.length - 1 ? { ...r, registrationNo: ROWS[0].registrationNo as string } : r,
    );
    expect(computeStudentStats(withDup).dataQuality.duplicateRegNo).toBe(1);
  });
});

describe("cross tabulations", () => {
  const stats = computeStudentStats(ROWS);

  it("builds Level × Sex", () => {
    expect(stats.levelSex.rows.map((r) => [r.rowKey, r.cells, r.total])).toEqual([
      ["100", { Male: 2, Female: 1 }, 3],
      ["200", { Male: 1, Female: 1 }, 2],
      ["300", { Male: 1, Female: 1 }, 2],
    ]);
    expect(stats.levelSex.columns.sort()).toEqual(["Female", "Male"]);
  });

  it("builds Programme × Level", () => {
    expect(stats.programmeLevel.rows).toEqual([
      { rowKey: "B.Sc Computer Science", cells: { 100: 3, 200: 2, 300: 2 }, total: 7 },
    ]);
  });

  it("builds Level × Status", () => {
    expect(stats.levelStatus.rows).toEqual([
      { rowKey: "100", cells: { ACTIVE: 3 }, total: 3 },
      { rowKey: "200", cells: { ACTIVE: 2 }, total: 2 },
      { rowKey: "300", cells: { ACTIVE: 1, GRADUATED: 1 }, total: 2 },
    ]);
  });

  it("crossTab skips rows without a row key", () => {
    const result = crossTab(ROWS, (r) => r.programmeName, (r) => (r.level == null ? null : String(r.level)));
    expect(result.rows).toEqual([{ rowKey: "B.Sc Computer Science", cells: { 100: 3, 200: 2, 300: 2 }, total: 7 }]);
  });
});

describe("applyStudentFilters", () => {
  it("filters by level, session, sex, category and status individually", () => {
    expect(applyStudentFilters(ROWS, { level: 100 })).toHaveLength(3);
    expect(applyStudentFilters(ROWS, { session: "2026/2027" })).toHaveLength(3);
    expect(applyStudentFilters(ROWS, { sex: "Female" })).toHaveLength(5);
    expect(applyStudentFilters(ROWS, { category: "POSTGRADUATE" })).toHaveLength(2);
    expect(applyStudentFilters(ROWS, { status: "ACTIVE" })).toHaveLength(9);
  });

  it("filters by programme name and by the no-programme sentinel", () => {
    expect(applyStudentFilters(ROWS, { programme: "B.Sc Computer Science" })).toHaveLength(7);
    expect(applyStudentFilters(ROWS, { programme: NO_PROGRAMME })).toHaveLength(5);
  });

  it("filters by age bracket", () => {
    expect(applyStudentFilters(ROWS, { ageBracket: "18–20" })).toHaveLength(3);
    expect(applyStudentFilters(ROWS, { ageBracket: "Below 18" })).toHaveLength(1);
  });

  it("searches registration number, name and programme together", () => {
    expect(applyStudentFilters(ROWS, { q: "chidi" })).toHaveLength(1);
    expect(applyStudentFilters(ROWS, { q: "Computer" })).toHaveLength(7);
    expect(applyStudentFilters(ROWS, { q: "24/012CSC/0005" })).toHaveLength(1);
  });

  it("combines filters (level × sex × programme)", () => {
    expect(applyStudentFilters(ROWS, { level: 100, sex: "Female", programme: "B.Sc Computer Science" })).toHaveLength(1);
  });

  it("only ever operates on the rows it is given (department scope)", () => {
    const physicsRows = [row({ id: "x1", department: "Physics", fullName: "Physics Student" })];
    const filtered = applyStudentFilters(physicsRows, { q: "Chemistry" });
    expect(filtered).toHaveLength(0);
    // A foreign filter value cannot surface rows from another department.
    expect(applyStudentFilters(physicsRows, { programme: "B.Sc Chemistry" })).toHaveLength(0);
  });
});

describe("buildFilterOptions", () => {
  const options = buildFilterOptions(ROWS);

  it("lists sessions and levels from the data", () => {
    expect(options.sessions).toEqual(["2026/2027", "2025/2026", "2024/2025"]);
    expect(options.levels).toEqual([100, 200, 300]);
  });

  it("lists programme names including the no-programme option", () => {
    expect(options.programmes).toEqual(["B.Sc Computer Science", NO_PROGRAMME]);
  });

  it("returns labelled categories, sexes and statuses", () => {
    expect(options.categories).toEqual([
      { value: "DISTANCE_LEARNING", label: "Distance Learning" },
      { value: "INSTITUTE_OF_EDUCATION", label: "Institute of Education" },
      { value: "POSTGRADUATE", label: "Postgraduate" },
      { value: "REMEDIAL", label: "Remedial" },
      { value: "UNDERGRADUATE", label: "Undergraduate" },
    ]);
    expect(options.sexes).toEqual([
      { value: "Female", label: "Female" },
      { value: "Male", label: "Male" },
    ]);
    expect(options.statuses).toEqual([
      { value: "ACTIVE", label: "Active" },
      { value: "GRADUATED", label: "Graduated" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "SUSPENDED", label: "Suspended" },
    ]);
  });

  it("lists only the age brackets that exist in the data", () => {
    expect(options.ageBrackets).toEqual(["Below 18", "18–20", "21–23", "24–26", "30–34"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 12 }, (_, i) => i + 1);

  it("slices the requested page", () => {
    const p1 = paginate(items, 1, 5);
    expect(p1.items).toEqual([1, 2, 3, 4, 5]);
    expect(p1.totalPages).toBe(3);
    expect(paginate(items, 2, 5).items).toEqual([6, 7, 8, 9, 10]);
    expect(paginate(items, 3, 5).items).toEqual([11, 12]);
  });

  it("clamps out-of-range pages", () => {
    expect(paginate(items, 0, 5).page).toBe(1);
    expect(paginate(items, 99, 5).page).toBe(3);
    expect(paginate([], 1).totalPages).toBe(1);
    expect(paginate([], 1).total).toBe(0);
  });
});

describe("age brackets reference", () => {
  it("covers every possible age exactly once", () => {
    const ranges = AGE_BRACKETS.map((b) => ({ min: b.min, max: b.max === Number.POSITIVE_INFINITY ? Infinity : b.max }));
    for (let age = 0; age <= 120; age += 1) {
      const hits = ranges.filter((r) => age >= r.min && age <= r.max);
      expect(hits, `age ${age}`).toHaveLength(1);
    }
  });
});

describe("parseStudentFilters", () => {
  const options = buildFilterOptions(ROWS);

  it("parses valid filters and trims the search term", () => {
    const parsed = parseStudentFilters(
      { session: "2026/2027", level: "100", programme: "B.Sc Computer Science", status: "ACTIVE", q: "  chidi  ", page: "2" },
      options,
    );
    expect(parsed.filters.level).toBe(100);
    expect(parsed.filters.session).toBe("2026/2027");
    expect(parsed.filters.programme).toBe("B.Sc Computer Science");
    expect(parsed.filters.status).toBe("ACTIVE");
    expect(parsed.filters.q).toBe("chidi");
    expect(parsed.active).toEqual({
      session: "2026/2027",
      level: "100",
      programme: "B.Sc Computer Science",
      status: "ACTIVE",
      q: "chidi",
    });
    expect(parsed.page).toBe(2);
  });

  it("drops values not in the department's option list", () => {
    const parsed = parseStudentFilters(
      { session: "2099/2100", level: "900", programme: "B.A. Physics", status: "ACTIVE", page: "0" },
      options,
    );
    expect(parsed.filters.session).toBeUndefined();
    expect(parsed.filters.level).toBeUndefined();
    expect(parsed.filters.programme).toBeUndefined();
    expect(parsed.filters.status).toBe("ACTIVE");
    expect(parsed.active).toEqual({ status: "ACTIVE" });
    expect(parsed.page).toBe(1);
  });
});

describe("studentRowsToCsv", () => {
  it("writes the header and escapes embedded commas", () => {
    const rowWithComma = { ...ROWS[0], fullName: 'Obi, Ada "Ada"' };
    const csv = studentRowsToCsv([rowWithComma]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Registration No,Surname,First Name,Full Name,Programme,Level,Admission Session,Status,Student Category");
    expect(csv).toContain('"Obi, Ada ""Ada"""');
  });
});

describe("displayName", () => {
  it("prefers the Surname, First format", () => {
    expect(displayName({ lastName: "Obi", firstName: "Ada", fullName: "Ada Obi" })).toBe("Obi, Ada");
  });

  it("falls back to the stored full name", () => {
    expect(displayName({ lastName: null, firstName: null, fullName: "Ada Obi" })).toBe("Ada Obi");
  });

  it("returns a dash when nothing is known", () => {
    expect(displayName({ lastName: null, firstName: null, fullName: "" })).toBe("—");
  });
});

describe("statusLabel", () => {
  it("title-cases simple and underscored values", () => {
    expect(statusLabel("ACTIVE")).toBe("Active");
    expect(statusLabel("ACTIVE_ENROLLED")).toBe("Active Enrolled");
    expect(statusLabel("")).toBe("");
  });
});

describe("resolveStudentAdviser", () => {
  it("prefers a programme-scoped adviser for the level", () => {
    const advisers = [
      { level: 100, programmeId: "p1", adviserId: "a1", adviserName: "Dr. A" },
      { level: 100, programmeId: null, adviserId: "a2", adviserName: "Dr. B" },
    ];
    expect(resolveStudentAdviser({ level: 100, programmeId: "p1" }, advisers)).toBe("Dr. A");
  });

  it("falls back to the department-wide adviser", () => {
    const advisers = [{ level: 100, programmeId: null, adviserId: "a2", adviserName: "Dr. B" }];
    expect(resolveStudentAdviser({ level: 100, programmeId: "p1" }, advisers)).toBe("Dr. B");
  });

  it("returns null when no adviser applies", () => {
    const advisers = [{ level: 200, programmeId: null, adviserId: "a3", adviserName: "Dr. C" }];
    expect(resolveStudentAdviser({ level: 100, programmeId: "p1" }, advisers)).toBeNull();
    expect(resolveStudentAdviser({ level: null, programmeId: "p1" }, advisers)).toBeNull();
  });
});
