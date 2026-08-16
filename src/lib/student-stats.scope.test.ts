import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
const findFirst = vi.hoisted(() => vi.fn());
const levelCoordinatorFindMany = vi.hoisted(() => vi.fn());
const levelAdvisorAssignmentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany, findFirst },
    levelCoordinator: { findMany: levelCoordinatorFindMany },
    levelAdvisorAssignment: { findMany: levelAdvisorAssignmentFindMany },
  },
}));

import {
  fetchDepartmentStudents,
  fetchDepartmentStudentById,
  fetchDepartmentCoordinators,
  fetchDepartmentLevelAdvisers,
} from "./student-stats";

const physicsUser = {
  id: "u1",
  registrationNo: "24/012PHY/0001",
  username: "24/012PHY/0001",
  fullName: "Physics Student",
  sex: "Female",
  dateOfBirth: new Date("2005-01-15"),
  department: "Physics",
  faculty: "Physical Science",
  status: "ACTIVE",
  studentCategory: "UNDERGRADUATE",
  programmeId: null,
  programme: null,
  lastName: "Student",
  firstName: "Physics",
};

describe("fetchDepartmentStudents (department scope)", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("always scopes the query to the enforced department — never to a caller-supplied value", async () => {
    findMany.mockResolvedValue([]);
    await fetchDepartmentStudents("Physics", 400);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "STUDENT", department: "Physics" },
      }),
    );

    findMany.mockClear();
    await fetchDepartmentStudents("Chemistry", 400);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "STUDENT", department: "Chemistry" },
      }),
    );
  });

  it("never leaks a different department's rows into the caller's result", async () => {
    // A student belonging to another department is in the database…
    findMany.mockResolvedValue([
      { ...physicsUser, department: "Mathematics", registrationNo: "24/012MTH/0001" },
    ]);
    // …but the HOD for Physics can never retrieve it.
    const rows = await fetchDepartmentStudents("Physics", 400);
    expect(rows.length).toBe(1);
    expect(rows[0].department).not.toBe("Physics");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: "STUDENT", department: "Physics" } }),
    );
  });

  it("derives admission session, level and age from the raw record", async () => {
    findMany.mockResolvedValue([physicsUser]);
    const rows = await fetchDepartmentStudents("Physics", 400);
    expect(rows[0].admissionSession).toBe("2024/2025");
    expect(rows[0].level).toBe(200);
    expect(rows[0].age).toBe(20);
    expect(rows[0].ageBracket).toBe("18–20");
  });

  it("leaves missing biographical fields null instead of inventing values", async () => {
    findMany.mockResolvedValue([
      { ...physicsUser, registrationNo: "UA/PG1001/100001", dateOfBirth: null, sex: null },
    ]);
    const rows = await fetchDepartmentStudents("Physics", 400);
    expect(rows[0].admissionSession).toBeNull();
    expect(rows[0].level).toBeNull();
    expect(rows[0].age).toBeNull();
    expect(rows[0].ageBracket).toBeNull();
  });
});

describe("fetchDepartmentStudentById (department scope)", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("scopes the single-student lookup to the department", async () => {
    findFirst.mockResolvedValue(null);
    await fetchDepartmentStudentById("Physics", "u-student-1", 400);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "STUDENT", department: "Physics", id: "u-student-1" },
      }),
    );
  });

  it("returns null when the student is not in the department", async () => {
    findFirst.mockResolvedValue(null);
    await expect(fetchDepartmentStudentById("Physics", "u-other-dept", 400)).resolves.toBeNull();
  });
});

describe("fetchDepartmentCoordinators (department scope)", () => {
  beforeEach(() => {
    levelCoordinatorFindMany.mockReset();
  });

  it("scopes the lookup to the department and session", async () => {
    levelCoordinatorFindMany.mockResolvedValue([]);
    await fetchDepartmentCoordinators("Physics", "2026/2027");
    expect(levelCoordinatorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { department: "Physics", academicSession: "2026/2027" },
      }),
    );
  });
});

describe("fetchDepartmentLevelAdvisers (department scope)", () => {
  beforeEach(() => {
    levelAdvisorAssignmentFindMany.mockReset();
  });

  it("scopes the lookup to the department, session and ACTIVE assignments", async () => {
    levelAdvisorAssignmentFindMany.mockResolvedValue([]);
    await fetchDepartmentLevelAdvisers("Physics", "2026/2027");
    expect(levelAdvisorAssignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { department: "Physics", academicSession: "2026/2027", status: "ACTIVE" },
      }),
    );
  });
});
