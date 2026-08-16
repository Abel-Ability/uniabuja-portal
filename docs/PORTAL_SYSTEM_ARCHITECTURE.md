# University Portal System Architecture Documentation

## 3. DATABASE ARCHITECTURE

### 3.1 Prisma Schema Overview

Key models documented in `prisma/schema.prisma`. This section details all major models.

### 3.2 Major Models

| Model | Purpose | Important Fields | Relationships | Current Use |
|-------|---------|-----------------|---------------|-------------|
| **User** | Authenticated users | id, email, username, password, role, status, studentCategory, department, faculty, programmeId, level | ⇆ Staff (1:1), ⇆ Student (1:1), ⇆ Faculty, ⇆ Department | Core auth + role assignment |
| **Staff** | University staff | id, staffId, name, department, faculty, position, loginId | ⇆ User (1:1, optional) | 792 records, identity + RBAC |
| **Student** | Enrolled students | id, regNo, programmeId, department, faculty, studentCategory, level, sex, dob, status | ⇆ User (1:1), ⇆ Programme, ⇆ Department | Enrollment + academic tracking |
| **Programme** | Academic programmes | id, name, abbreviation, duration, levelOptions | ⇆ Faculty, ⇆ Department, ⇆ Student (many), ⇆ Course (many) | Academic structure |
| **Faculty** | University faculties | id, name, shortCode, description | ⇆ Department (many), ⇆ Programme (many), ⇆ Staff | Administrative division |
| **Department** | Academic departments | id, name, shortCode, facultyId, levelCoordinatorId | ⇆ Faculty, ⇆ Programme, ⇆ Student, ⇆ HOD, ⇆ LevelCoordinator | Departmental structure |
| **Course** | Course catalogue (Courses_UG) | id, code, title, faculty, hostingDepartment, semester, unitCredit | ⇆ Programme (many), ⇆ CourseOffering (many), ⇆ CourseAssignment (many) | Course catalogue |
| **CourseOffering** | Bridge between catalogue & registration | id, courseId, academicSession, semester, programmeId, level, status | ⇆ Course, ⇆ Programme, ⇆ Level, ⇆ Student registration eligibility | **Critical**: Eligible courses for registration |
| **CourseAssignment** | Lecturer workload allocation | id, courseId, academicSession, semester, programmeId, level, lecturerId, mainLecturer, coLecturers | ⇆ Course, ⇆ Lecturer, ⇆ Programme, ⇆ Level | Lecturer teaching allocation |
| **CourseRegistration** | Student registrations | id, studentId, courseOfferingId, units, registeredAt, status | ⇆ Student, ⇆ CourseOffering, ⇆ Course | Student course registration |
| **Results** | Student results/grades | id, studentId, courseOfferingId, caScore, examScore, overallScore, status | ⇆ Student, ⇆ CourseOffering | Assessment recording |
| **AuditLog** | Audit hash chain | id, recordId, recordType, previousHash, currentHash, createdAt | - | Integrity verification |
| **ClearanceRequest** | Student clearance | id, userId, department, items, status, approvedBy, createdAt, completedAt | ⇆ User (applicant) | Graduation/clearance processing |
| **Announcement** | Portal announcements | id, title, content, targetRole, createdAt, published | - | Communication |

### 3.3 Key Relationships

```
User ────── 1:1 ──→ Staff (staffId unique, optional)
User ────── 1:1 ──→ Student (regNo unique, optional)
Programme ──────┐
               ├──⇆ Student (many)
               ├──⇆ Course (many)
Department ──────┘
               ├──⇆ Student (many)
               ├──⇆ HOD (one, via department)
Faculty ──────┐
             ├──⇆ Department (many)
             ├──⇆ Programme (many)
             ├──⇆ Staff (many)
             
Course ──────┐
           ├──⇆ CourseOffering (many)
           ├──⇆ CourseAssignment (many)
           ├──⇆ Results (many)
           
CourseOffering ──────┐
                 ├──⇆ CourseRegistration (many)
                 ├──⇆ Results (many)
                 ├──⇆ level, semester, session filtering

Lecturer ──────┐
             ├──⇆ CourseAssignment (many)
             ├──⇆ mainLecturer, coLecturers
```

---

## 1. PROJECT OVERVIEW

### 1.1 Project Name
UniAbuja Portal - University of Abuja Portal System

### 1.2 Application Purpose
A comprehensive Nigerian university portal managing student registration, course allocation, academic progress, results, admissions, staff management, and administrative workflows for various university roles including Students, Lecturers, HODs, Deans, DVC, SBC, Governance, and VC.

### 1.3 Current Technology Stack

| Technology | Version | Purpose | Evidence/File |
|-----------|---------|---------|---------------|
| Next.js | 16.3.0 | React framework, production build | `package.json`, `next.config.ts` |
| React | 19.2.8 | UI library | `package.json` |
| TypeScript | 5.x | Type safety | `tsconfig.json`, `.tsx` files |
| Prisma ORM | 7.9.1 | Database ORM and client | `prisma/schema.prisma`, `package.json` |
| PostgreSQL | Via Neon | Production database | Connection string in `.env` |
| Google Sheets | N/A | Data source for faculties, departments, staff, students, courses | `src/lib/sheets.ts` |
| Tailwind CSS | 4.x | Styling | `tailwind.config.ts`, CSS imports |
| Lucide React | 1.30.0 | Icon set | `lucide-react` imports throughout |
| ESLint | 9.x | Code linting | `npm run lint`, `.eslintrc*` |
| Vitest | 4.1.10 | Testing | `npm test`, `vitest.config.ts` |
| UUID | 8.x | ID generation | `uuid` package import |
| bcryptjs | 3.0.3 | Password hashing | `package.json` dependencies |
| pg | 8.23.0 | PostgreSQL client | `package.json` dependencies |

### 1.4 Frontend Architecture
- Next.js 16.x App Router (`src/app/`)
- Server Components (RSC) with `"use client"` directives where needed
- Client Components for interactivity
- Custom `PortalShell` component (`src/components/portal-shell.tsx`) for sidebar/layout
- Role-based navigation filtering in `layout.tsx`
- Component library at `src/components/ui.tsx`

### 1.5 Backend Architecture
- Next.js Server Actions (`src/lib/module-actions.ts`, `src/app/portal/*/page.tsx`)
- Prisma client queries and migrations
- Google Sheets data integration
- Audit logging chain (`src/lib/audit.ts`)
- Session management (`src/lib/session.ts`)

### 1.6 Authorization/RBAC
- RBAC architecture in `src/lib/constants.ts` - `ACCESS_CONTROL_MATRIX`
- Role definitions: STUDENT, LECTURER, HOD, DEAN, DVC, SBC, Governance, VC, APPLICANT, REGISTRY, BURSARY, STUDENT_AFFAIRS
- `visibleModules(role)` function filters modules by role permissions
- `can(role, module, perm)` checks specific permissions
- `landingForRole(role)` determines post-login destination
- Role-specific workspaces with distinct navigation

### 1.11 API/Server Actions
- Defined in `src/lib/module-actions.ts` (major business logic)
- Route handlers in `src/app/api/v1/*/route.ts`
- Portal page actions in `src/app/portal/*/`
- Registration: `registerCourse` action with CourseOffering validation
- Other actions: `startClearance`, `signOffClearance`, results entry, etc.

### 1.12 Google Sheets Integration
- `src/lib/sheets.ts` - main integration module
- Sheet IDs configured in code (not exposed in documentation)
- Tabs: Faculties, Departments, Staff, Students, Courses_UG, Centres, Directorates, Applications, Announcements
- Read operations: Course catalogue, staff records, student records
- Write operations: Some admission/application data
- Data transformation and normalization functions
- Considered supplementary to database (not authoritative)

### 1.13 File/Document Storage
- Google Sheets for tabular data (faculties, departments, staff, students, courses)
- Local uploads handled by Next.js `/app/(public)/apply/`
- No apparent local file storage for documents in code inspection
- Audit log chain stored in SQLite database

### 1.14 Testing Framework
- Vitest (primary: `npm test`)
- 173 tests passing, 7 pre-existing failures unchanged
- Test files in `src/lib/*.test.ts`, `src/app/portal/*/`
- Smoke tests in `src/lib/module-actions.smoke.test.ts`
- Pre-existing failures: audit chain timeout, module-actions integration, HOD_DEAN role test

### 1.14 Build System
- `npm run dev` - development server (localhost:3000)
- `npm run build` - production build (Turbopack, Next.js 16)
- `npm run start` - serve built app
- `npm run lint` - ESLint validation

### 1.15 Package Manager
- npm (Node Package Manager)
- `package.json` at project root
- Dependencies managed via `npm install`

### 1.16 Hosting/Deployment
- Target: Production PostgreSQL (Neon)
- Next.js standalone output not explicitly configured
- Environment-based configuration (`.env`, `.env.example`)
- No explicit CI/CD pipeline visible in source

### 1.17 Environment Configuration
- `.env.example` provides template
- `SESSION_SECRET` required
- `DATABASE_URL` for PostgreSQL connection
- Google Sheets configuration in `sheets.ts`

### 1.18 Major External Integrations
- Google Sheets (data source for institutions, faculties, departments, staff, students, courses)
- PostgreSQL (primary data storage)
- Google OAuth/TOTP for MFA
- Next.js App Router framework

---

## 2. TECHNOLOGY STACK

*(See Section 1.3 for detailed table)*

---

## 3. DATABASE ARCHITECTURE

### 3.1 Prisma Schema Overview

Key models documented in `prisma/schema.prisma`. This section details all major models.

### 3.2 Major Models

| Model | Purpose | Important Fields | Relationships | Current Use |
|-------|---------|-----------------|---------------|-------------|
| **User** | Authenticated users | id, email, username, password, role, status, studentCategory, department, faculty, programmeId, level | ⇆ Staff (1:1), ⇆ Student (1:1), ⇆ Faculty, ⇆ Department | Core auth + role assignment |
| **Staff** | University staff | id, staffId, name, department, faculty, position, loginId | ⇆ User (1:1, optional) | 792 records, identity + RBAC |
| **Student** | Enrolled students | id, regNo, programmeId, department, faculty, studentCategory, level, sex, dob, status | ⇆ User (1:1), ⇆ Programme, ⇆ Department | Enrollment + academic tracking |
| **Programme** | Academic programmes | id, name, abbreviation, duration, levelOptions | ⇆ Faculty, ⇆ Department, ⇆ Student (many), ⇆ Course (many) | Academic structure |
| **Faculty** | University faculties | id, name, shortCode, description | ⇆ Department (many), ⇆ Programme (many), ⇆ Staff | Administrative division |
| **Department** | Academic departments | id, name, shortCode, facultyId, levelCoordinatorId | ⇆ Faculty, ⇆ Programme, ⇆ Student, ⇆ HOD, ⇆ LevelCoordinator | Departmental structure |
| **Course** | Course catalogue (Courses_UG) | id, code, title, faculty, hostingDepartment, semester, unitCredit | ⇆ Programme (many), ⇆ CourseOffering (many), ⇆ CourseAssignment (many) | Course catalogue |
| **CourseOffering** | Bridge between catalogue & registration | id, courseId, academicSession, semester, programmeId, level, status | ⇆ Course, ⇆ Programme, ⇆ Level, ⇆ Student registration eligibility | **Critical**: Eligible courses for registration |
| **CourseAssignment** | Lecturer workload allocation | id, courseId, academicSession, semester, programmeId, level, lecturerId, mainLecturer, coLecturers | ⇆ Course, ⇆ Lecturer, ⇆ Programme, ⇆ Level | Lecturer teaching allocation |
| **CourseRegistration** | Student registrations | id, studentId, courseOfferingId, units, registeredAt, status | ⇆ Student, ⇆ CourseOffering, ⇆ Course | Student course registration |
| **Results** | Student results/grades | id, studentId, courseOfferingId, caScore, examScore, overallScore, status | ⇆ Student, ⇆ CourseOffering | Assessment recording |
| **AuditLog** | Audit hash chain | id, recordId, recordType, previousHash, currentHash, createdAt | - | Integrity verification |
| **ClearanceRequest** | Student clearance | id, userId, department, items, status, approvedBy, createdAt, completedAt | ⇆ User (applicant) | Graduation/clearance processing |
| **Announcement** | Portal announcements | id, title, content, targetRole, createdAt, published | - | Communication |

### 3.3 Key Relationships

```
User ────── 1:1 ──→ Staff (staffId unique, optional)
User ────── 1:1 ──→ Student (regNo unique, optional)
Programme ──────┐
               ├──⇆ Student (many)
               ├──⇆ Course (many)
Department ──────┘
               ├──⇆ Student (many)
               ├──⇆ HOD (one, via department)
Faculty ──────┐
             ├──⇆ Department (many)
             ├──⇆ Programme (many)
             ├──⇆ Staff (many)
             
Course ──────┐
           ├──⇆ CourseOffering (many)
           ├──⇆ CourseAssignment (many)
           ├──⇆ Results (many)
           
CourseOffering ──────┐
                 ├──⇆ CourseRegistration (many)
                 ├──⇆ Results (many)
                 ├──⇆ level, semester, session filtering

Lecturer ──────┐
             ├──⇆ CourseAssignment (many)
             ├──⇆ mainLecturer, coLecturers
```
<tool_call>
<function=bash>
<parameter=description>
Read full prisma schema 
 