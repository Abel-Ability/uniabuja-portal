// Seed script for the UniAbuja portal demo.
// Run: npm run db:seed  (or: npx prisma db seed)
import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { Prisma } from "../src/generated/prisma/client";

const DEMO_PASSWORD = "UniAbuja@2026";

const COURSES: { code: string; title: string; units: number; level: number; semester: number; capacity: number }[] = [
  { code: "CSC201", title: "Data Structures & Algorithms", units: 3, level: 200, semester: 1, capacity: 150 },
  { code: "CSC203", title: "Object-Oriented Programming", units: 3, level: 200, semester: 1, capacity: 150 },
  { code: "MTH201", title: "Linear Algebra", units: 3, level: 200, semester: 1, capacity: 200 },
  { code: "MTH202", title: "Calculus II", units: 3, level: 200, semester: 2, capacity: 200 },
  { code: "CSC202", title: "Digital Systems", units: 3, level: 200, semester: 2, capacity: 150 },
  { code: "CSC301", title: "Database Systems", units: 3, level: 300, semester: 1, capacity: 120 },
  { code: "CSC304", title: "Software Engineering", units: 3, level: 300, semester: 1, capacity: 120 },
  { code: "GST102", title: "Use of English", units: 2, level: 100, semester: 2, capacity: 500 },
];

const WIPE_EXCLUDE = ["sqlite_sequence"];

const IS_POSTGRES = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");

async function main() {
  console.log("Seeding UniAbuja portal demo data…");

  if (IS_POSTGRES) {
    await prisma.$transaction(async (tx) => {
      const tables = await tx.$queryRawUnsafe<{ table_name: string }[]>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
      );
      for (const t of tables) {
        if (t.table_name.startsWith("_prisma")) continue;
        await tx.$executeRawUnsafe(`TRUNCATE TABLE "${t.table_name}" CASCADE`);
      }
    }, { maxWait: 30_000, timeout: 120_000 });
  } else {
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
    await prisma.$transaction(async (tx) => {
      const tables = await tx.$queryRawUnsafe<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'",
      );
      for (const t of tables) {
        if (WIPE_EXCLUDE.includes(t.name)) continue;
        await tx.$executeRawUnsafe(`DELETE FROM "${t.name}"`);
      }
    });
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  }

  await prisma.$transaction(async (tx) => {
    // ---- feature flags ----
    await tx.featureFlag.createMany({
      data: [
        { key: "pilot-faculties", enabled: true, note: "Phase 1 rollout — SCI, MGT, SOS" },
        { key: "pg-module", enabled: true },
        { key: "siwes-module", enabled: true },
        { key: "nysc-module", enabled: true },
        { key: "timetabling-module", enabled: true },
        { key: "lms-grade-passback", enabled: true },
        { key: "step-up-auth", enabled: true },
        { key: "public-verification", enabled: true },
        { key: "digital-id-cards", enabled: true },
      ],
    });

    // ---- programmes ----
    const pgProgramme = await tx.programme.create({
      data: {
        code: "PG-CSC-MSC", name: "M.Sc. Computer Science", programmeType: "PG",
        durationYears: 2, tuitionCents: 15000000, capacity: 60,
      },
    });
    const ugProgramme = await tx.programme.create({
      data: {
        code: "UG-CSC-BSC", name: "B.Sc. Computer Science", programmeType: "UTME",
        durationYears: 4, tuitionCents: 10000000, capacity: 200,
      },
    });
    await tx.programme.create({
      data: {
        code: "DL-MGT-BSC", name: "B.Sc. Business Administration (Distance Learning)", programmeType: "DISTANCE_LEARNING",
        durationYears: 4, tuitionCents: 8000000, capacity: 500,
      },
    });

    // ---- users (one per role) ----
    const hash = await hashPassword(DEMO_PASSWORD);
    const verifiedAt = new Date();
    const users = await Promise.all([
      tx.user.create({ data: {
        username: "applicant@uniabuja.edu.ng", email: "applicant@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "APPLICANT", firstName: "Tunde", lastName: "Bello",
        fullName: "Tunde Bello", phone: "+2348012345678", jambNo: "JAMB-00918273",
        mustChangePassword: true, programmeId: ugProgramme.id,
      } }),
      tx.user.create({ data: {
        username: "12/345ABC/678", email: "student@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "STUDENT", firstName: "Amina", lastName: "Yusuf",
        fullName: "Amina Yusuf", phone: "+2348098765432", registrationNo: "12/345ABC/678",
        programmeId: ugProgramme.id,
      } }),
      tx.user.create({ data: {
        username: "UA/PG1234/567890", email: "pgstudent@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "STUDENT", firstName: "Chinedu", lastName: "Okafor",
        fullName: "Chinedu Okafor", phone: "+2348077777777", registrationNo: "UA/PG1234/567890",
        programmeId: pgProgramme.id,
      } }),
      tx.user.create({ data: {
        username: "ACA3879", email: "aca3879@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "LECTURER", firstName: "Amina", lastName: "Ojo",
        fullName: "Dr. Amina Ojo", phone: "90500000000", staffNo: "ACA3879",
        faculty: "Physical Science", department: "Computer Science", sex: "FEMALE",
      } }),
      tx.user.create({ data: {
        username: "ACA140", email: "aca140@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "HOD", firstName: "Chidiebere", lastName: "Ibe",
        fullName: "Prof. Chidiebere Ibe", phone: "08170000000", staffNo: "ACA140",
        faculty: "Physical Science", department: "Computer Science", sex: "MALE",
      } }),
      tx.user.create({ data: {
        username: "SS6424", email: "ss6424@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "REGISTRY", firstName: "Ogechi", lastName: "Garba",
        fullName: "Engr. Ogechi Garba", phone: "90500000000", staffNo: "SS6424",
        department: "Registry", sex: "FEMALE",
      } }),
      tx.user.create({ data: {
        username: "SS5762", email: "ss5762@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "BURSARY", firstName: "Yemisi", lastName: "Fagbemi",
        fullName: "Mrs. Yemisi Fagbemi", phone: "07030000000", staffNo: "SS5762",
        department: "Bursary", sex: "FEMALE",
      } }),
      tx.user.create({ data: {
        username: "SS8229", email: "ss8229@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "STUDENT_AFFAIRS", firstName: "Tayo", lastName: "Mgbachi",
        fullName: "Mrs. Tayo Mgbachi", phone: "90500000000", staffNo: "SS8229",
        department: "Student Affairs Division", sex: "MALE",
      } }),
      tx.user.create({ data: {
        username: "SS953", email: "ss953@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "EXAMS_RECORDS", firstName: "Nafisat", lastName: "Ojo",
        fullName: "Ms. Nafisat Ojo", phone: "07000000000", staffNo: "SS953",
        department: "Office of Vice-Chancellor", sex: "FEMALE",
      } }),
      tx.user.create({ data: {
        username: "SS8026", email: "ss8026@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "PG_SCHOOL", firstName: "Salome", lastName: "Adeoye",
        fullName: "Dr. Salome Adeoye", phone: "08130000000", staffNo: "SS8026",
        department: "Office of Vice-Chancellor", sex: "FEMALE",
      } }),
      tx.user.create({ data: {
        username: "SS6753", email: "ss6753@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "SIWES", firstName: "Simisola", lastName: "Coker",
        fullName: "Mr. Simisola Coker", phone: "80600000000", staffNo: "SS6753",
        department: "Office of Vice-Chancellor", sex: "FEMALE",
      } }),
      tx.user.create({ data: {
        username: "QR78", email: "timetable@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "TIMETABLE", firstName: "Mrs.", lastName: "Chioma Obi",
        fullName: "Mrs. Chioma Obi", phone: "+2348077777777", staffNo: "QR78",
      } }),
      tx.user.create({ data: {
        username: "SS5103", email: "ss5103@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "IT_ADMIN", firstName: "Efosa", lastName: "Iroegbu",
        fullName: "Mr. Efosa Iroegbu", phone: "08160000000", staffNo: "SS5103",
        department: "Information Technology & Management Services (ITMS)", sex: "MALE",
      } }),
      tx.user.create({ data: {
        username: "ACA5129", email: "aca5129@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "DVC_OVERSIGHT", firstName: "Simisola", lastName: "Usman",
        fullName: "Prof. Simisola Usman", phone: "07090000000", staffNo: "ACA5129",
        faculty: "CHS-Nursing and Allied Health Sciences", department: "Public Health", sex: "FEMALE",
      } }),
      tx.user.create({ data: {
        username: "ACA3998", email: "aca3998@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "VC", firstName: "Ezinne", lastName: "Adeoye",
        fullName: "Prof. Ezinne Adeoye", phone: "09040000000", staffNo: "ACA3998",
        faculty: "Veterinary Medicine", department: "Veterinary Parasitology and Entomology", sex: "FEMALE",
      } }),
      tx.user.create({ data: {
        username: "ACA8614", email: "aca8614@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "DEAN", firstName: "Michael", lastName: "Egbuna",
        fullName: "Prof. Michael Egbuna", phone: "80600000000", staffNo: "ACA8614",
        faculty: "Physical Science", department: "Computer Science", sex: "MALE",
      } }),
      tx.user.create({ data: {
        username: "AC13", email: "sbc@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "SBC_CHAIRMAN", firstName: "Prof.", lastName: "Bala Ibrahim",
        fullName: "Prof. Bala Ibrahim", phone: "+2348032223334", staffNo: "AC13",
      } }),
      tx.user.create({ data: {
        username: "BD24", email: "gov@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "GOVERNANCE_OVERSIGHT_MEMBER", firstName: "Prof.", lastName: "Hauwa Sani",
        fullName: "Prof. Hauwa Sani", phone: "+2348043334445", staffNo: "BD24",
      } }),
    ]);
    const [
      applicant, student, pgStudent, lecturer, hod, registry, bursary, studentAffairs, exams,
      , siwes, timetable, itAdmin, dvc, , dean, sbc, gov,
    ] = users;

    // ---- governance & Senate (executive recovery milestone) ----
    await tx.committeeMembership.createMany({
      data: [
        {
          committee: "GOVERNANCE_OVERSIGHT", userId: dvc.id,
          designation: "CHAIRMAN", status: "ACTIVE", startDate: new Date(),
        },
        {
          committee: "GOVERNANCE_OVERSIGHT", userId: gov.id,
          designation: "MEMBER", status: "ACTIVE", startDate: new Date(),
        },
      ],
    });
    await tx.senateMatter.create({
      data: {
        reference: "SBC/2026/0001",
        title: "Approval of Second Semester Examination Results — Faculty of Science",
        summary: "Consolidated results schedule submitted for Senate consideration.",
        category: "RESULTS", status: "SUBMITTED", session: "2025/2026",
        submittedById: registry.id,
      },
    });
    const screenedMatter = await tx.senateMatter.create({
      data: {
        reference: "SBC/2026/0002",
        title: "Revision of Postgraduate Tuition Fees for 2026/2027",
        summary: "Proposed fee review tabled by the Bursary for Senate ratification.",
        category: "FEES", status: "SCREENED", session: "2025/2026",
        submittedById: registry.id, screenedById: registry.id, screenedAt: new Date(),
      },
    });
    await tx.senateDecision.create({
      data: {
        matterId: screenedMatter.id,
        resolution: "APPROVED",
        decisionBody: "Committee resolved to recommend the revised fee schedule to Senate for ratification.",
        recordedById: sbc.id, recordedAt: new Date(),
      },
    });
    await tx.senateAgenda.create({
      data: {
        title: "Senate Meeting — Standing Committee on Examinations",
        meetingDate: new Date("2026-09-15T10:00:00Z"),
        session: "2025/2026", status: "PUBLISHED",
        items: ["Approval of second semester results", "Admission quota for 2026/2027", "AOB"],
        createdById: registry.id,
      },
    });

    // ---- courses ----
    const courseIds: Record<string, string> = {};
    for (const c of COURSES) {
      const created = await tx.course.create({
        data: {
          code: c.code, title: c.title, units: c.units, level: c.level,
          semester: c.semester, capacity: c.capacity,
          prerequisites: c.code === "CSC301" ? ["CSC201"] : Prisma.JsonNull,
        },
      });
      courseIds[c.code] = created.id;
    }

    // ---- student academics: registration + results (multi-stage) ----
    await tx.feeAccount.create({
      data: { userId: student.id, balanceCents: 2500000, clearanceStatus: true },
    });
    const regs = [
      { code: "CSC201", ca: 32, exam: 55, grade: "A", status: "FINAL" },
      { code: "CSC203", ca: 28, exam: 48, grade: "B", status: "SENATE_APPROVED" },
      { code: "MTH201", ca: 25, exam: 40, grade: "C", status: "HOD_APPROVED" },
      { code: "MTH202", ca: 22, exam: 30, grade: "D", status: "SUBMITTED" },
      { code: "CSC202", ca: 20, exam: 25, grade: "C", status: "SENATE_APPROVED" },
      { code: "CSC301", ca: 30, exam: 52, grade: "A", status: "FINAL" },
    ];
    for (const r of regs) {
      const reg = await tx.courseRegistration.create({
        data: {
          userId: student.id, courseId: courseIds[r.code], academicSession: "2025/2026",
          semester: 1, status: "ACTIVE", lmsSynced: true,
        },
      });
      await tx.lmsSyncLog.create({
        data: { kind: "ENROLMENT", refType: "COURSE_REGISTRATION", refId: reg.id, status: "SYNCED", ranAt: new Date(), userId: student.id },
      });
      await tx.result.create({
        data: {
          userId: student.id, courseId: courseIds[r.code], academicSession: "2025/2026",
          semester: 1, caScore: r.ca, examScore: r.exam, total: r.ca + r.exam, grade: r.grade,
          gradeStatus: r.status, published: r.status === "FINAL",
          submittedById: lecturer.id,
          approvedBy1Id: r.status !== "SUBMITTED" ? hod.id : null,
          approvedAt1: r.status !== "SUBMITTED" ? new Date() : null,
          approvedBy2Id: r.status === "SENATE_APPROVED" || r.status === "FINAL" ? exams.id : null,
          approvedAt2: r.status === "SENATE_APPROVED" || r.status === "FINAL" ? new Date() : null,
        },
      });
    }

    // ---- applications ----
    const application = await tx.application.create({
      data: {
        userId: applicant.id, programmeId: ugProgramme.id, jambNo: "JAMB-00918273",
        status: "ADMITTED", capsStatus: "ACCEPTED", nipedsStatus: "VERIFIED",
        parentConsent: false,
        eligibility: { totalScore: 287, utme: 242, oLevel: "8 points", eligible: true },
        submittedAt: new Date("2026-01-12T10:00:00Z"),
      },
    });
    await tx.documentUpload.create({
      data: {
        applicationId: application.id, userId: applicant.id, kind: "RESULT_SLIP",
        fileName: "waec_result.pdf", mimeType: "application/pdf", sizeBytes: 240000,
        checksum: "sha256:abc123", verificationStatus: "VERIFIED", storageRef: "uploads/waec_result.pdf",
      },
    });
    await tx.admissionOffer.create({
      data: { applicationId: application.id, programmeId: ugProgramme.id, accepted: true, acceptedOn: new Date("2026-02-01T09:00:00Z") },
    });

    // ---- fees for student ----
    const invoice = await tx.invoice.create({
      data: { userId: student.id, module: "TUITION", description: "2025/2026 2nd semester tuition", amountCents: 10000000, dueOn: new Date("2026-09-30T00:00:00Z"), status: "OPEN" },
    });
    await tx.payment.create({
      data: { invoiceId: invoice.id, userId: student.id, module: "TUITION", reference: "RRR-2025-00012345", amountCents: 7500000, channel: "REMITA", status: "RECONCILED", tsaSwept: true, createdAt: new Date("2026-01-20T11:00:00Z") },
    });
    await tx.scholarship.create({
      data: { userId: student.id, title: "Federal Scholarship Award", amountCents: 2000000, status: "APPROVED", approvedById: bursary.id },
    });
    await tx.paymentPlan.create({
      data: { userId: student.id, invoiceId: invoice.id, installments: 2, intervalDays: 45, amountPerInstallmentCents: 5000000, status: "ACTIVE" },
    });

    // ---- accommodation ----
    const silverbird = await tx.hostel.create({
      data: { name: "Silverbird Hostel", code: "SBH", capacity: 200, bedsAvailable: 180 },
    });
    const maryam = await tx.hostel.create({
      data: { name: "Maryam Sambo Hostel", code: "MSH", capacity: 120, bedsAvailable: 96 },
    });
    const aminaHall = await tx.hostel.create({
      data: { name: "Amina Mohammed Hostel", code: "AMH", capacity: 150, bedsAvailable: 150 },
    });
    const bed = await tx.bedSpace.create({
      data: { hostelId: silverbird.id, room: "B-204", bed: "Bed 2", status: "FREE" },
    });
    await tx.bedSpace.createMany({
      data: [
        { hostelId: silverbird.id, room: "B-205", bed: "Bed 1" },
        { hostelId: silverbird.id, room: "B-205", bed: "Bed 2" },
        { hostelId: maryam.id, room: "A-101", bed: "Bed 1" },
        { hostelId: maryam.id, room: "A-101", bed: "Bed 2" },
        { hostelId: maryam.id, room: "A-102", bed: "Bed 1" },
        { hostelId: aminaHall.id, room: "C-301", bed: "Bed 1" },
        { hostelId: aminaHall.id, room: "C-301", bed: "Bed 2" },
        { hostelId: aminaHall.id, room: "C-302", bed: "Bed 1" },
      ],
    });
    await tx.hostelApplication.create({
      data: { userId: student.id, academicSession: "2025/2026", hostelId: silverbird.id, feeVerified: true, preference: { roomType: "shared", block: "B" }, status: "ALLOCATED", allocatedBedId: bed.id, allocatedAt: new Date("2026-01-15T00:00:00Z") },
    });
    await tx.invoice.create({
      data: {
        userId: student.id,
        module: "HOSTEL",
        description: "Hostel accommodation — Silverbird Hostel (2025/2026)",
        amountCents: 7500000,
        dueOn: new Date("2026-03-31T00:00:00Z"),
        status: "PAID",
      },
    });
    await tx.maintenanceRequest.create({
      data: { userId: student.id, hostelId: silverbird.id, title: "Faulty ceiling fan", description: "Fan in B-204 is not working.", status: "OPEN" },
    });

    // ---- transcripts ----
    await tx.transcriptRequest.create({
      data: { userId: student.id, purpose: "JOB", destinationInstitution: "Nigerian Bottling Company", copies: 1, courier: false, status: "ISSUED", referenceNo: "TXN-2026-000001", signedKeyRef: "kms:uniabuja/transcript-signing-key-1", issuedAt: new Date("2026-03-02T00:00:00Z") },
    });
    await tx.transcriptRequest.create({
      data: { userId: student.id, purpose: "FURTHER_STUDY", destinationInstitution: "University of Lagos", copies: 2, courier: true, courierAddress: "Lagos", status: "QUEUED", referenceNo: "TXN-2026-000002" },
    });
    await tx.verificationRecord.createMany({
      data: [
        { kind: "TRANSCRIPT", referenceNo: "TXN-2026-000001", requesterOrg: "Nigerian Bottling Company", result: "VALID" },
        { kind: "RESULT", referenceNo: "RS-12/345ABC/678-2025", requesterOrg: "Employer", result: "VALID" },
      ],
    });

    // ---- library ----
    const holdings = await Promise.all([
      tx.libraryHolding.create({ data: { title: "Introduction to Algorithms", author: "Cormen et al.", isbn: "9780262033848", category: "Computer Science", callNumber: "QA76.C6", totalCopies: 5, availableCopies: 3 } }),
      tx.libraryHolding.create({ data: { title: "Database System Concepts", author: "Silberschatz", isbn: "9780073523323", category: "Computer Science", callNumber: "QA76.9.D3", totalCopies: 3, availableCopies: 1 } }),
      tx.libraryHolding.create({ data: { title: "The Nigerian Constitution", author: "Government of Nigeria", category: "Law", resourceType: "E_RESOURCE", totalCopies: 1, availableCopies: 1 } }),
    ]);
    await tx.libraryLoan.create({
      data: { userId: student.id, holdingId: holdings[0].id, borrowedAt: new Date("2026-05-01T00:00:00Z"), dueAt: new Date("2026-05-15T00:00:00Z"), status: "OUT" },
    });

    // ---- clearance / graduation ----
    const clearance = await tx.clearanceRequest.create({
      data: { userId: student.id, clearanceType: "GRADUATION", status: "IN_PROGRESS" },
    });
    const departmentsForClearance = ["BURSARY", "LIBRARY", "HOSTEL", "SPORTS", "EXAMS", "SIWES"];
    for (const dept of departmentsForClearance) {
      const item = await tx.clearanceItem.create({
        data: { clearanceRequestId: clearance.id, department: dept, status: dept === "BURSARY" ? "PENDING" : "PENDING" },
      });
      await tx.clearanceItemApprovalLog.create({
        data: { itemId: item.id, department: dept, approverId: dept === "BURSARY" ? bursary.id : dept === "LIBRARY" ? itAdmin.id : studentAffairs.id, requestId: clearance.id },
      });
    }
    await tx.graduationRecord.create({
      data: { userId: student.id, academicSession: "2025/2026", awardClass: "Second Class Upper", cgpa: 4.1, senateApprovedAt: new Date("2026-04-01T00:00:00Z"), certificateRef: "CERT-2026-0001" },
    });
    await tx.convocation.create({
      data: { userId: student.id, session: "2025/2026", gownSize: "M", feePaid: true, seatNo: "A-42", guestSlots: 2, registeredAt: new Date("2026-05-10T00:00:00Z") },
    });

    // ---- alumni ----
    const alumni = await tx.user.create({
      data: {
        username: "99/123XYZ/456", email: "alumni@uniabuja.edu.ng",
        passwordHash: hash, emailVerifiedAt: verifiedAt, role: "STUDENT", firstName: "Blessing", lastName: "Okafor",
        fullName: "Blessing Okafor", phone: "+2348000000000", registrationNo: "99/123XYZ/456",
        status: "GRADUATED",
      },
    });
    await tx.alumniProfile.create({
      data: { userId: alumni.id, employmentStatus: "EMPLOYED", employer: "MTN Nigeria", sector: "Telecoms", optedIntoDirectory: true, graduatedSession: "2022/2023", joinedAt: new Date("2023-03-01T00:00:00Z") },
    });
    await tx.alumniDonation.create({
      data: { userId: alumni.id, purpose: "Endowment Fund", amountCents: 500000, status: "RECONCILED" },
    });

    // ---- password history (seed hash so reuse checks work immediately) ----
    await tx.passwordHistory.createMany({
      data: [
        ...users.map((u) => ({ userId: u.id, passwordHash: hash })),
        { userId: alumni.id, passwordHash: hash },
      ],
    });

    // ---- postgraduate ----
    await tx.pGApplication.create({
      data: { userId: pgStudent.id, programmeId: pgProgramme.id, referee1Name: "Prof. Ade", referee1Email: "ade@uniabuja.edu.ng", referee2Name: "Dr. Ben", referee2Email: "ben@uniabuja.edu.ng", screeningStatus: "ADMITTED", interviewAt: new Date("2026-02-10T10:00:00Z"), interviewOutcome: "PASS" },
    });
    await tx.supervisorAssignment.create({
      data: { pgStudentId: pgStudent.id, staffUserId: lecturer.id, programme: "M.Sc. Computer Science", workloadUnits: 2 },
    });
    await tx.thesis.create({
      data: { pgStudentId: pgStudent.id, title: "Federated Learning for Low-Bandwidth e-Learning Platforms", abstractText: "…", proposalStatus: "APPROVED", proposalSubmittedAt: new Date("2026-03-01T00:00:00Z"), defenseScheduledAt: new Date("2026-08-20T10:00:00Z"), plagiarismScore: 4.2, externalExaminer: "Prof. O. University of Ibadan", status: "SUPERVISION" },
    });

    // ---- SIWES ----
    const siwesRecord = await tx.sIWESRecord.create({
      data: { userId: student.id, academicSession: "2025/2026", orgName: "SystemSpecs Ltd", orgAddress: "Lagos", startAt: new Date("2026-03-01T00:00:00Z"), endAt: new Date("2026-07-31T00:00:00Z"), status: "ACTIVE" },
    });
    await tx.logbookEntry.createMany({
      data: [
        { siwesRecordId: siwesRecord.id, weekNo: 1, activities: "Onboarding, IT induction, workstation setup." },
        { siwesRecordId: siwesRecord.id, weekNo: 2, activities: "Database schema walkthrough; created test cases." },
        { siwesRecordId: siwesRecord.id, weekNo: 3, activities: "Built REST endpoint for payroll integration." },
      ],
    });
    await tx.visitationReport.create({
      data: { siwesRecordId: siwesRecord.id, coordinatorUserId: siwes.id, visitedAt: new Date("2026-04-10T00:00:00Z"), notes: "Progress satisfactory; logbook up to date." },
    });

    // ---- NYSC ----
    const nyscBatch = await tx.nYSCBatch.create({
      data: { code: "2026B", mobilisationDeadline: new Date("2026-07-15T00:00:00Z"), status: "OPEN" },
    });
    await tx.nYSCRecord.create({
      data: { userId: alumni.id, batchId: nyscBatch.id, status: "PENDING" },
    });

    // ---- timetabling & venues ----
    const venueA = await tx.venue.create({ data: { name: "Lecture Theatre A", building: "Main Campus", capacity: 250, equipment: { projector: true, smartBoard: false } } });
    const venueB = await tx.venue.create({ data: { name: "Lab 204", building: "ICT Building", capacity: 40, equipment: { computers: 40 } } });
    await tx.timetableEntry.createMany({
      data: [
        { courseId: courseIds.CSC201, venueId: venueA.id, kind: "LECTURE", day: "MONDAY", startTime: "09:00", endTime: "11:00", academicSession: "2025/2026", semester: 1 },
        { courseId: courseIds.CSC301, venueId: venueB.id, kind: "LECTURE", day: "WEDNESDAY", startTime: "13:00", endTime: "15:00", academicSession: "2025/2026", semester: 1 },
        { courseId: courseIds.MTH201, venueId: venueA.id, kind: "EXAM", day: "MONDAY", startTime: "09:00", endTime: "12:00", academicSession: "2025/2026", semester: 1 },
      ],
    });
    await tx.venueBooking.create({
      data: { venueId: venueA.id, purpose: "EXAM", courseId: courseIds.MTH201, day: "MONDAY", startTime: "09:00", endTime: "12:00", status: "CONFIRMED", bookerUserId: timetable.id },
    });

    // ---- academic calendar ----
    await tx.academicCalendarEntry.createMany({
      data: [
        { title: "2025/2026 Second Semester", entryType: "SESSION", startsOn: new Date("2026-01-05T00:00:00Z"), endsOn: new Date("2026-07-31T00:00:00Z") },
        { title: "Course registration window", entryType: "REGISTRATION", startsOn: new Date("2026-01-05T00:00:00Z"), endsOn: new Date("2026-01-16T00:00:00Z") },
        { title: "Tuition fee deadline", entryType: "FEE_DEADLINE", startsOn: new Date("2026-09-30T00:00:00Z"), endsOn: new Date("2026-09-30T00:00:00Z") },
        { title: "First semester examinations", entryType: "EXAM", startsOn: new Date("2026-05-18T00:00:00Z"), endsOn: new Date("2026-05-29T00:00:00Z") },
        { title: "NYSC 2026B mobilisation deadline", entryType: "NYSC", startsOn: new Date("2026-07-15T00:00:00Z"), endsOn: new Date("2026-07-15T00:00:00Z") },
      ],
    });

    // ---- announcements (public + role-scoped) ----
    await tx.announcement.createMany({
      data: [
        { title: "Admission list for 2026/2027 session released", body: "Candidates should check their CAPS status and accept offers on eFacility or USSD 55019.", category: "ADMISSION", scope: "PUBLIC", publishedAt: new Date("2026-07-01T09:00:00Z") },
        { title: "Second semester fee deadline approaching", body: "All students must clear outstanding fees before course registration for the next session.", category: "DEADLINE", scope: "STUDENT", publishedAt: new Date("2026-07-05T09:00:00Z") },
        { title: "Convocation ceremonies scheduled for August 2026", body: "Graduands must complete clearance and register for convocation before July 20.", category: "NOTICE", scope: "STUDENT", publishedAt: new Date("2026-07-06T09:00:00Z") },
        { title: "Beware of fake admission portals and SMS shortcode spoofing", body: "Only use official channels. We never request payment via SMS links.", category: "GENERAL", scope: "PUBLIC", publishedAt: new Date("2026-07-08T09:00:00Z") },
        { title: "Staff: mandatory MFA enrolment by month end", body: "All staff accounts must have MFA enabled before the August rollout.", category: "NOTICE", scope: "STAFF", publishedAt: new Date("2026-07-10T09:00:00Z") },
        { title: "Faculty results review window", body: "Deans may now review second-semester results and return HoD-approved rows to departments where needed.", category: "NOTICE", scope: "ROLE", visibleToRoles: ["DEAN"], authorId: dean.id, publishedAt: new Date("2026-07-18T09:00:00Z") },
        { title: "Post-UTME screening dates announced", body: "First-choice candidates can now book screening slots on the portal. Screening runs from mid-August.", category: "ADMISSION", scope: "PUBLIC", publishedAt: new Date("2026-07-12T09:00:00Z") },
        { title: "Library extended hours for examination period", body: "The main library will stay open until midnight on weekdays throughout the examinations.", category: "NOTICE", scope: "PUBLIC", publishedAt: new Date("2026-07-14T09:00:00Z") },
        { title: "Chancellor's scholarship applications now open", body: "Merit and need-based awards for new and returning students. Apply before the end of the month.", category: "NEWS", scope: "PUBLIC", publishedAt: new Date("2026-07-16T09:00:00Z") },
      ],
    });

    // ---- policy documents ----
    await tx.document.createMany({
      data: [
        { title: "Admission Guidelines 2026/2027", category: "GUIDELINE", version: "1.2", fileRef: "/documents/admission-guidelines-2026.pdf" },
        { title: "Student Handbook", category: "HANDBOOK", version: "2026", fileRef: "/documents/student-handbook-2026.pdf" },
        { title: "Fee Schedule 2025/2026", category: "FEE_SCHEDULE", version: "3.0", fileRef: "/documents/fee-schedule-2025-26.pdf" },
        { title: "Privacy Notice (NDPA 2023)", category: "POLICY", version: "1.0", fileRef: "/documents/privacy-notice.pdf" },
        { title: "NUC Guidelines for e-Learning", category: "GUIDELINE", version: "April 2023", fileRef: "/documents/nuc-elearning-guidelines.pdf" },
      ],
    });

    // ---- templates & consents ----
    await tx.messageTemplate.createMany({
      data: [
        { code: "APP_SUBMITTED", subject: "Application submitted", body: "Your application {{ref}} has been received." },
        { code: "ADMITTED", subject: "Admission offer", body: "Congratulations! You have been offered admission. Accept on CAPS." },
        { code: "FEE_REMINDER", subject: "Fee payment reminder", body: "Your {{module}} balance of {{amount}} is due {{due}}." },
      ],
    });
    await tx.consent.create({
      data: { userId: student.id, purpose: "ACADEMIC_PROCESSING", granted: true, grantedAt: new Date("2025-09-01T00:00:00Z") },
    });

    // ---- API credentials (hashed, lifecycle tracked) ----
    const sha = (v: string) => createHash("sha256").update(v).digest("hex");
    await tx.apiCredential.createMany({
      data: [
        { provider: "JAMB", label: "JAMB CAPS production credential", keyHash: sha("jamb-prod-2026"), issuedById: itAdmin.id, issuedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2026-12-31T00:00:00Z") },
        { provider: "NIPEDS", label: "WAEC/NECO results bank credential", keyHash: sha("nipeds-2026"), issuedById: itAdmin.id, issuedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2026-12-31T00:00:00Z") },
        { provider: "REMITA", label: "Remita payment gateway", keyHash: sha("remita-2026"), issuedById: itAdmin.id, issuedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2027-01-01T00:00:00Z") },
      ],
    });

    // ---- ID cards ----
    await tx.idCard.createMany({
      data: [
        { userId: student.id, qrRef: "UAID-STU-12/345ABC/678-01", kind: "STUDENT" },
        { userId: lecturer.id, qrRef: "UAID-STF-ACA3879-01", kind: "STAFF" },
      ],
    });

    // ---- welcome notifications ----
    await tx.notification.createMany({
      data: [
        { userId: student.id, channel: "IN_APP", subject: "Welcome to the new portal", body: "Your dashboard now shows results, fees, and clearance.", status: "SENT", readAt: null },
        { userId: student.id, channel: "EMAIL", subject: "Result published", body: "CSC201 result is now final.", status: "SENT" },
      ],
    });

    // ---- notification preferences ----
    await tx.notificationPreference.createMany({
      data: [
        { userId: student.id, allowEmail: true, allowSms: true, allowInApp: true, allowPromotional: false },
        { userId: applicant.id, allowEmail: true, allowSms: false, allowInApp: true, allowPromotional: true },
      ],
    });

    // ---- DPO: data-subject request + FOI request + breach log ----
    await tx.dataSubjectRequest.create({
      data: { userId: student.id, requestType: "ACCESS", detail: "Export all my academic and fee records.", status: "SUBMITTED" },
    });
    await tx.fOIRequest.create({
      data: { requesterName: "Citizen Inquiry", requesterEmail: "inquiry@example.com", subject: "Admission statistics 2025/2026", body: "Please provide aggregate admission statistics by faculty.", status: "SUBMITTED", dueOn: new Date("2026-09-01T00:00:00Z") },
    });
    await tx.breachLog.create({
      data: { userId: student.id, category: "LOW", description: "Simulated low-impact demo breach for NDPA drill.", notifiedNdpc: false, status: "OPEN" },
    });

    // ---- misconduct case + appeal (Module 3 workflow) ----
    const misconduct = await tx.misconductCase.create({
      data: { studentId: student.id, title: "Late submission of continuous assessment", status: "INVESTIGATION", evidenceRef: "MC-2026-001" },
    });
    await tx.appeal.create({
      data: { userId: student.id, caseType: "GRADE", caseRef: "MTH202", grounds: "Examination script not marked — zero entered in error.", status: "SUBMITTED" },
    });
    await tx.appeal.create({
      data: { userId: student.id, caseType: "MISCONDUCT", misconductCaseId: misconduct.id, grounds: "The lateness was caused by documented hospital admission.", status: "UNDER_REVIEW" },
    });
  }, { maxWait: 30_000, timeout: 120_000 });

  console.log("Seed complete. Demo login: use any seeded email/password with password", DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
