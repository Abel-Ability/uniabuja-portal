-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "registrationNo" TEXT,
    "staffNo" TEXT,
    "jambNo" TEXT,
    "departmentId" TEXT,
    "facultyId" TEXT,
    "programmeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "mfaVerifiedAt" DATETIME,
    "stepUpUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "actorRole" TEXT,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "accreditationStatus" TEXT NOT NULL DEFAULT 'FULL',
    CONSTRAINT "Department_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstituteCentre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numberPattern" TEXT
);

-- CreateTable
CREATE TABLE "AcademicCalendarEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "startsOn" DATETIME NOT NULL,
    "endsOn" DATETIME NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PUBLIC',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programmeType" TEXT NOT NULL,
    "departmentId" TEXT,
    "facultyId" TEXT,
    "durationYears" INTEGER NOT NULL,
    "tuitionCents" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 200,
    CONSTRAINT "Programme_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Programme_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "jambNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "capsStatus" TEXT,
    "eligibility" JSONB,
    "nipedsStatus" TEXT,
    "parentConsent" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "storageRef" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentUpload_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "offeredOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted" BOOLEAN,
    "acceptedOn" DATETIME,
    CONSTRAINT "AdmissionOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "clearanceStatus" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueOn" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tsaSwept" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Scholarship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scholarship_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Waiver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "title" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Waiver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Waiver_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Waiver_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "installments" INTEGER NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "amountPerInstallmentCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "PaymentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentPlan_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 150,
    "prerequisites" JSONB,
    CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lmsSynced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourseRegistration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "caScore" INTEGER,
    "examScore" INTEGER,
    "total" INTEGER,
    "grade" TEXT,
    "gradeStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedById" TEXT,
    "approvedBy1Id" TEXT,
    "approvedBy2Id" TEXT,
    "approvedAt1" DATETIME,
    "approvedAt2" DATETIME,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "misconductRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Result_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Result_approvedBy1Id_fkey" FOREIGN KEY ("approvedBy1Id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Result_approvedBy2Id_fkey" FOREIGN KEY ("approvedBy2Id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MisconductCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidenceRef" TEXT,
    "decision" TEXT,
    "decidedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MisconductCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MisconductCase_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "caseRef" TEXT,
    "misconductCaseId" TEXT,
    "grounds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appeal_misconductCaseId_fkey" FOREIGN KEY ("misconductCaseId") REFERENCES "MisconductCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hostel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bedsAvailable" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "BedSpace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostelId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "bed" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FREE',
    CONSTRAINT "BedSpace_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HostelApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "hostelId" TEXT,
    "preference" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "allocatedBedId" TEXT,
    "feeVerified" BOOLEAN NOT NULL DEFAULT false,
    "allocatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HostelApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HostelApplication_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HostelApplication_allocatedBedId_fkey" FOREIGN KEY ("allocatedBedId") REFERENCES "BedSpace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hostelId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranscriptRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "destinationInstitution" TEXT,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "courier" BOOLEAN NOT NULL DEFAULT false,
    "courierAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "referenceNo" TEXT NOT NULL,
    "signedKeyRef" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "requesterOrg" TEXT,
    "result" TEXT NOT NULL DEFAULT 'NOT_FOUND',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LmsSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ranAt" DATETIME,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LmsSyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "designation" TEXT,
    "orcid" TEXT,
    "scopUserId" TEXT,
    "bio" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepartmentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "heroText" TEXT,
    "programmesText" TEXT,
    "news" JSONB,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DepartmentProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchOutput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "doi" TEXT,
    "repositoryUrl" TEXT,
    "year" INTEGER NOT NULL,
    CONSTRAINT "ResearchOutput_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClearanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clearanceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ClearanceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClearanceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clearanceRequestId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signedOffById" TEXT,
    "signedOffAt" DATETIME,
    "comment" TEXT,
    CONSTRAINT "ClearanceItem_clearanceRequestId_fkey" FOREIGN KEY ("clearanceRequestId") REFERENCES "ClearanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClearanceItem_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClearanceItemApprovalLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    CONSTRAINT "ClearanceItemApprovalLog_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClearanceItemApprovalLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClearanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Convocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "gownSize" TEXT,
    "feePaid" BOOLEAN NOT NULL DEFAULT false,
    "seatNo" TEXT,
    "guestSlots" INTEGER NOT NULL DEFAULT 2,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Convocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GraduationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "awardClass" TEXT,
    "cgpa" REAL,
    "senateApprovedAt" DATETIME,
    "certificateRef" TEXT,
    CONSTRAINT "GraduationRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlumniProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "employmentStatus" TEXT,
    "employer" TEXT,
    "sector" TEXT,
    "optedIntoDirectory" BOOLEAN NOT NULL DEFAULT false,
    "graduatedSession" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlumniProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlumniDonation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlumniDonation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "category" TEXT,
    "callNumber" TEXT,
    "resourceType" TEXT NOT NULL DEFAULT 'BOOK',
    "totalCopies" INTEGER NOT NULL DEFAULT 1,
    "availableCopies" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "LibraryLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "borrowedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME NOT NULL,
    "returnedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OUT',
    CONSTRAINT "LibraryLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "LibraryHolding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryHold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "placedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    CONSTRAINT "LibraryHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryHold_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "LibraryHolding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PGApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "referee1Name" TEXT,
    "referee1Email" TEXT,
    "referee2Name" TEXT,
    "referee2Email" TEXT,
    "screeningStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "interviewAt" DATETIME,
    "interviewOutcome" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PGApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PGApplication_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupervisorAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pgStudentId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "programme" TEXT,
    "workloadUnits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupervisorAssignment_pgStudentId_fkey" FOREIGN KEY ("pgStudentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisorAssignment_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Thesis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pgStudentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstractText" TEXT,
    "proposalStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "proposalSubmittedAt" DATETIME,
    "defenseScheduledAt" DATETIME,
    "defenseOutcome" TEXT,
    "plagiarismScore" REAL,
    "externalExaminer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "senateApprovedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Thesis_pgStudentId_fkey" FOREIGN KEY ("pgStudentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SIWESRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "orgAddress" TEXT,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "SIWESRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogbookEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siwesRecordId" TEXT NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "activities" TEXT NOT NULL,
    "supervisorComment" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogbookEntry_siwesRecordId_fkey" FOREIGN KEY ("siwesRecordId") REFERENCES "SIWESRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisitationReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siwesRecordId" TEXT NOT NULL,
    "coordinatorUserId" TEXT NOT NULL,
    "visitedAt" DATETIME NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    CONSTRAINT "VisitationReport_siwesRecordId_fkey" FOREIGN KEY ("siwesRecordId") REFERENCES "SIWESRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisitationReport_coordinatorUserId_fkey" FOREIGN KEY ("coordinatorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NYSCBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "mobilisationDeadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN'
);

-- CreateTable
CREATE TABLE "NYSCRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NYSCRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NYSCRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "NYSCBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "facultyId" TEXT,
    "equipment" JSONB,
    CONSTRAINT "Venue_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VenueBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "courseId" TEXT,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "bookerUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueBooking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT,
    "venueId" TEXT,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimetableEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PUBLIC',
    "visibleToRoles" JSONB,
    "authorId" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "HelpTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "slaDueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HelpTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatTranscript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "confidence" REAL,
    "answer" TEXT,
    "handedOff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatTranscript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileRef" TEXT NOT NULL,
    "authorId" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataSubjectRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FOIRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "dueOn" DATETIME,
    "responseAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "issuedById" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME
);

-- CreateTable
CREATE TABLE "IdCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "qrRef" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "IdCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_registrationNo_key" ON "User"("registrationNo");

-- CreateIndex
CREATE UNIQUE INDEX "User_staffNo_key" ON "User"("staffNo");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_hash_key" ON "AuditLog"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_code_key" ON "Faculty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_slug_key" ON "Faculty"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstituteCentre_code_key" ON "InstituteCentre"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_code_key" ON "Programme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FeeAccount_userId_key" ON "FeeAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Waiver_invoiceId_key" ON "Waiver"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPlan_invoiceId_key" ON "PaymentPlan"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_userId_courseId_academicSession_semester_key" ON "CourseRegistration"("userId", "courseId", "academicSession", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "Result_userId_courseId_academicSession_semester_key" ON "Result"("userId", "courseId", "academicSession", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_code_key" ON "Hostel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "HostelApplication_allocatedBedId_key" ON "HostelApplication"("allocatedBedId");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptRequest_referenceNo_key" ON "TranscriptRequest"("referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentProfile_departmentId_key" ON "DepartmentProfile"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationRecord_userId_key" ON "GraduationRecord"("userId");

-- CreateIndex
CREATE INDEX "GraduationRecord_userId_idx" ON "GraduationRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniProfile_userId_key" ON "AlumniProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NYSCBatch_code_key" ON "NYSCBatch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "NYSCRecord_userId_batchId_key" ON "NYSCRecord"("userId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_name_key" ON "Venue"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_code_key" ON "MessageTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "IdCard_qrRef_key" ON "IdCard"("qrRef");
