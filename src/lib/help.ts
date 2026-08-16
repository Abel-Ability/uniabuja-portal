import {
  PORTAL_MODULES,
  CROSS_CUTTING_MODULES,
  visibleModules,
  dashboardForRole,
  type ModuleKey,
} from "@/lib/constants";

export type HelpFaq = { q: string; a: string };
export type HelpSection = { href: string; label: string; body: string };
export type HelpWorkflowStep = { step: string; note: string };

// Structured, account-specific help content. Every workspace explains the
// ten points required for a self-sufficient user:
//   1. workspace  – what the workspace is for
//   2. sections   – what each sidebar item does
//   3. startHere  – what to do first
//   4. workflow   – the important workflow sequence
//   5. canDo      – what you are allowed to do
//   6. cannotDo   – what you should not expect to do
//   7. results    – where results / reports live
//   8. after      – what happens after key actions
//   9. dashboard  – how to return to the dashboard
//  10. history    – where historical records are kept
export type RoleHelpContent = {
  description: string;
  workspace: string;
  startHere: string[];
  sections: HelpSection[];
  workflow: HelpWorkflowStep[];
  canDo: string[];
  cannotDo: string[];
  results: string;
  after: string;
  dashboard: string;
  history: string;
  faqs: HelpFaq[];
};

// ------------------------------------------------------------------
// Student
// ------------------------------------------------------------------

const STUDENT_HELP: RoleHelpContent = {
  description:
    "Guidance for working inside your student portal — registration, fees, results, transcripts, accommodation and more.",
  workspace:
    "Your student portal is where you register courses, pay fees, view your published results, request transcripts and manage accommodation for every academic session.",
  startHere: [
    "Complete your course registration for the current session, then finalise it to generate your registration reference.",
    "Clear any outstanding fees shown on your dashboard under “Outstanding fees”.",
    "Check your “Latest result” on the dashboard after each semester.",
  ],
  sections: [
    { href: "/portal/student", label: "Student Dashboard", body: "Registration status, outstanding fees and your latest result." },
    { href: "/portal/student/course-registration", label: "Course Registration", body: "Register the courses you are eligible for this session." },
    { href: "/portal/student/view-registration", label: "View / Print Registration", body: "See and print your finalised registration reference." },
    { href: "/portal/student/academic-progress", label: "Academic Progress", body: "Your grades, units and progress summary." },
    { href: "/portal/student/courses", label: "My Courses", body: "Every course you are registered for this session." },
    { href: "/portal/results", label: "My Results", body: "Your published grades once approved." },
    { href: "/portal/fees", label: "Fees & Payments", body: "Invoices, payments and receipts." },
    { href: "/portal/transcripts", label: "Transcripts", body: "Request and track transcript requests." },
    { href: "/portal/lms", label: "Learning Management", body: "Moodle e-learning, signed in automatically." },
    { href: "/portal/hostels", label: "Accommodation", body: "Hostel applications and maintenance requests." },
    { href: "/portal/graduation", label: "Graduation & Clearance", body: "Your clearance checklist once you reach your final year." },
    { href: "/portal/profiles", label: "Profiles & Research", body: "Department and staff profiles." },
  ],
  workflow: [
    { step: "Register your courses", note: "Add the courses you are eligible for during the registration window." },
    { step: "Pay your fees", note: "Clear outstanding invoices before or after registering, depending on the session rules." },
    { step: "Finalise your registration", note: "Finalise to lock in your courses and get your registration reference." },
    { step: "Take your examinations", note: "Sit your exams for the semester." },
    { step: "Check your results", note: "Results appear here after your lecturer posts them and Exams & Records finalises them." },
  ],
  canDo: [
    "Register and finalise your own course registration for the current session.",
    "View your own invoices, pay fees and download receipts.",
    "View your own published results, progress and cumulative standing.",
    "Request transcripts and track their status.",
    "Apply for accommodation and raise maintenance requests.",
    "Complete your graduation clearance checklist.",
  ],
  cannotDo: [
    "View or change another student’s registration, results or fees.",
    "Post, approve or finalise any results.",
    "Register courses outside the eligibility rules of your programme and level.",
  ],
  results:
    "Open “My Results” in your sidebar, or use the “Latest result” card on your dashboard. Grades only appear after your HoD approves them and Exams & Records finalises them.",
  after:
    "Once you finalise registration you can no longer edit it yourself. After results are published they become part of your academic record; corrections go through the Result Corrections process in your department.",
  dashboard:
    "Click “Student Dashboard” at the top of your sidebar, or your browser back button, to return to the dashboard at any time.",
  history:
    "Previous sessions’ registrations and results remain visible on Academic Progress and My Courses. Transcripts request the full history from Exams & Records.",
  faqs: [
    {
      q: "How do I sign in for the first time?",
      a: "Your username is your registration number and your initial password was issued by the university. On first login you must change your password before continuing. Use the “Forgot password” link if you get locked out.",
    },
    {
      q: "How do I register my courses?",
      a: "Register your courses for the current session from the course registration section of your dashboard. Your dashboard shows how many courses you have registered for the session.",
    },
    {
      q: "How do I pay my fees?",
      a: "Any outstanding invoices are shown on your dashboard under “Outstanding fees”. Open Fees & Payments to view invoices, make a payment and track receipts.",
    },
    {
      q: "When will I see my results?",
      a: "After a lecturer posts results, your HoD approves them and Exams & Records finalises them, your grades appear under Results. A “Latest result” summary also shows on your dashboard.",
    },
    {
      q: "How do I request a transcript?",
      a: "Request a transcript from the Transcripts page. The status of in-progress requests appears on your dashboard, and you can track progress there.",
    },
    {
      q: "How do I apply for accommodation?",
      a: "Submit a hostel application from the Accommodation page. You can also raise maintenance requests there for issues in your room.",
    },
    {
      q: "How do I access my e-learning materials?",
      a: "Open Learning Management (LMS) to reach Moodle. You are signed in automatically using your portal login, so no separate password is needed.",
    },
    {
      q: "How do I prepare for graduation?",
      a: "The Graduation & Clearance page lists your clearance checklist once you reach your final year. Complete each item to become eligible for convocation.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority. Urgent issues are triaged first.",
    },
  ],
};

// ------------------------------------------------------------------
// Lecturer
// ------------------------------------------------------------------

const LECTURER_HELP: RoleHelpContent = {
  description:
    "Guidance for working inside your lecturer portal — assigned courses, posting results, result files and corrections.",
  workspace:
    "Your lecturer portal is where you post and manage results for the courses allocated to you by your Head of Department each session.",
  startHere: [
    "Check “My assigned courses” on your dashboard to confirm what you are teaching this session.",
    "Download the result CSV template from Post Results before uploading.",
    "Watch the status of your uploads on Course Results.",
  ],
  sections: [
    { href: "/portal/lecturer", label: "Lecturer Dashboard", body: "Your assigned courses and result completion." },
    { href: "/portal/lecturer/post-results", label: "Post Results", body: "Upload a CSV of results for an assigned course." },
    { href: "/portal/lecturer/post-backlog", label: "Post Backlog Results", body: "Upload re-sit / backlog results for a course." },
    { href: "/portal/lecturer/course-results", label: "Course Results", body: "Status of every result you submitted." },
    { href: "/portal/lecturer/result-files", label: "Result Files", body: "Your CSV upload history and row errors." },
    { href: "/portal/lecturer/result-correction", label: "Result Corrections", body: "Request and track result corrections." },
    { href: "/portal/lecturer/level-adviser/cumulative-result", label: "Level Adviser Lookup", body: "Look up a student’s cumulative result and class standing." },
    { href: "/portal/lms", label: "Learning Management", body: "Moodle e-learning." },
    { href: "/portal/profiles", label: "Profiles & Research", body: "Department and staff profiles." },
  ],
  workflow: [
    { step: "Teach your allocated courses", note: "Your allocation comes from your HoD each session." },
    { step: "Post results", note: "Upload the CSV with MATRIC_NO, CA and EXAM; TOTAL and GRADE are computed for you." },
    { step: "Fix rejected rows", note: "Review row-level errors, correct and re-upload." },
    { step: "Watch approval", note: "Your HoD approves your SUBMITTED rows; Exams & Records then finalises them." },
    { step: "Handle corrections", note: "Request a correction through Result Corrections if a published grade is wrong." },
  ],
  canDo: [
    "Post and manage results for courses you are the main lecturer or co-lecturer of.",
    "Upload re-sit / backlog results for your assigned courses.",
    "Request and track result corrections.",
    "Look up students as a level adviser for advising purposes.",
  ],
  cannotDo: [
    "Approve or finalise any results — those steps belong to your HoD and Exams & Records.",
    "Post results for courses that are not allocated to you.",
    "Change a published grade directly; corrections go through the formal process.",
  ],
  results:
    "Course Results shows the status of every result you submitted (SUBMITTED, then FINAL once approved). Use Post Results to add new ones.",
  after:
    "Posted results go to your HoD for approval, then to Exams & Records for finalisation. Once FINAL, a result becomes the published grade a student sees.",
  dashboard:
    "Click “Lecturer Dashboard” at the top of your sidebar to return to your teaching overview at any time.",
  history:
    "Result Files keeps your CSV upload history for the current session, and Course Results lists every course you taught.",
  faqs: [
    {
      q: "How do I sign in for the first time?",
      a: "Your username is your staff number and your initial password was issued by the university. On first login you must change your password before continuing.",
    },
    {
      q: "Which courses do I see on my dashboard?",
      a: "“My assigned courses” lists every course allocated to you by your HoD for the current session and semester. Courses where you are the main lecturer and courses you co-teach are both listed, labelled accordingly.",
    },
    {
      q: "How do I post results?",
      a: "Open Post Results, choose the course and attach your CSV. Download the template and fill in exactly three columns — MATRIC_NO, CA and EXAM. TOTAL and GRADE are computed automatically.",
    },
    {
      q: "What is Post Backlog Results for?",
      a: "Use Post Backlog Results to upload re-sit / backlog results for a course. The CSV format is the same as a normal results upload.",
    },
    {
      q: "My result file was rejected. What now?",
      a: "Review the row-level errors shown after upload, correct the flagged rows and upload again. If the problem persists, contact your HoD or Exams & Records.",
    },
    {
      q: "What do the statuses on Course Results mean?",
      a: "SUBMITTED rows have been posted and await your HoD’s approval. FINAL rows have been approved and are the published result. You can watch the progress of every course you teach.",
    },
    {
      q: "How do I request a result correction?",
      a: "Open Request for Result Correction, complete the details of the correction and submit. Your previous requests and their status are listed below the form.",
    },
    {
      q: "What can I do as a Level Adviser?",
      a: "The Level Adviser section lets you look up a student’s cumulative/detailed result and the class-of-degree / good-standing definitions, so you can advise students on their academic standing.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority. Urgent issues are triaged first.",
    },
  ],
};

// ------------------------------------------------------------------
// Head of Department
// ------------------------------------------------------------------

const HOD_HELP: RoleHelpContent = {
  description:
    "Guidance for working inside your HoD portal — course allocation, level coordinators, approvals, students and department oversight.",
  workspace:
    "Your HoD portal runs the academic business of your department: allocating courses, managing level advisers and coordinators, and approving the results your lecturers post.",
  startHere: [
    "Confirm the courses offered this session under Course Offerings.",
    "Allocate each course to a main lecturer (and any co-lecturers) under Course Allocation.",
    "Set your level advisers and coordinators early in the session.",
    "Clear the pending approvals shown on your dashboard.",
  ],
  sections: [
    { href: "/portal/hod", label: "Department Overview", body: "Stats, pending approvals and quick actions." },
    { href: "/portal/hod/students", label: "Students", body: "View and export the department student register." },
    { href: "/portal/hod/staff", label: "Staff", body: "Academic staff in the department." },
    { href: "/portal/hod/approvals", label: "Approvals", body: "Sign off results and requests." },
    { href: "/portal/hod/course-allocation", label: "Course Allocation", body: "Allocate courses to lecturers." },
    { href: "/portal/hod/course-offerings", label: "Course Offerings", body: "Define which courses are offered per programme and level." },
    { href: "/portal/hod/level-advisers", label: "Level Advisers", body: "Assign and manage level advisers." },
    { href: "/portal/hod/level-coordinators", label: "Level Coordinators", body: "Assign and manage level coordinators." },
  ],
  workflow: [
    { step: "Set up course offerings", note: "Define which courses run for each programme and level this session." },
    { step: "Allocate lecturers", note: "Assign a main lecturer and co-lecturers to each offered course." },
    { step: "Lecturers post results", note: "Your staff upload result CSVs for their allocated courses." },
    { step: "Approve results", note: "Sign off SUBMITTED results in Approvals." },
    { step: "Exams & Records finalises", note: "Finalised results become the published record." },
  ],
  canDo: [
    "Allocate courses and manage co-lecturers for your department.",
    "Define course offerings per programme and level.",
    "Approve results, appeals, misconduct reports and clearance for your department.",
    "Assign level advisers and level coordinators.",
    "View and export your department’s student register.",
  ],
  cannotDo: [
    "Post results on behalf of lecturers.",
    "Finalise results — that step belongs to Exams & Records.",
    "Approve or view matters outside your department and the current workflow stage.",
  ],
  results:
    "Open Approvals in your sidebar to sign off the results your lecturers post. The shared Results module routes you straight here.",
  after:
    "Once you approve a result it moves to Exams & Records for finalisation. Approving an appeal or misconduct recommendation advances that case to the next stage in the pipeline.",
  dashboard:
    "Click “HoD Dashboard” at the top of your sidebar to return to the department overview at any time.",
  history:
    "Previous sessions’ allocations and offerings remain available on Course Allocation and Course Offerings; published results stay on the student record.",
  faqs: [
    {
      q: "How do I allocate a course to a lecturer?",
      a: "Open Course Allocation. Choose the session and semester (1 or 2), then pick the course and the main lecturer. Courses and lecturers are listed in dropdowns. Click Assign and the allocation appears immediately in the Current allocations list.",
    },
    {
      q: "Can a course have more than one lecturer?",
      a: "Yes. A course has one main lecturer and any number of co-lecturers. Pick co-lecturers from the multi-select dropdown in the assign form. Co-lecturers must be lecturers in your department and cannot also be the main lecturer.",
    },
    {
      q: "Why does Course Allocation open on the current session?",
      a: "The page defaults to the current academic session so your active allocations are shown first. Use the session dropdown to view or edit allocations for other sessions.",
    },
    {
      q: "How do I assign level coordinators?",
      a: "Open Level Coordinators and choose one lecturer to coordinate each level of the department. Each level can have only one coordinator.",
    },
    {
      q: "How do I sign off results?",
      a: "Open Approvals. Results posted by your lecturers appear here for sign-off. Approve them to send them to Exams & Records for finalisation.",
    },
    {
      q: "Which students appear in my dashboard?",
      a: "Only undergraduate students appear in the department overview, the Students list and the approvals you work with. Other student categories (postgraduate, distance learning, institute of education, remedial) are handled by their dedicated offices.",
    },
    {
      q: "How do I find a student in my department?",
      a: "Open Students to see your department’s undergraduate list. Use the search box to find a student by name or matriculation number and open their profile.",
    },
    {
      q: "Where can I handle department clearance and profiles?",
      a: "Use Graduation & Clearance for your department’s clearance approvals and Staff & Profiles to manage department staff and research profiles.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority. Urgent issues are triaged first.",
    },
  ],
};

// ------------------------------------------------------------------
// Dean of Faculty
// ------------------------------------------------------------------

const DEAN_HELP: RoleHelpContent = {
  description:
    "Guidance for working inside your Dean portal — faculty results, students, staff, admissions and academic management.",
  workspace:
    "Your Dean portal governs the faculties in your portfolio: reviewing department results, monitoring admissions and graduation, and managing academic staff and departments.",
  startHere: [
    "Review the results awaiting your return across your departments.",
    "Confirm the department and course allocation picture under Academic Management.",
    "Track admission and graduation activity for your faculties.",
  ],
  sections: [
    { href: "/portal/dean", label: "Faculty Overview", body: "Dashboard for your faculty." },
    { href: "/portal/dean/students", label: "Students", body: "View and export the faculty student register." },
    { href: "/portal/dean/staff", label: "Staff", body: "Academic staff across the faculty." },
    { href: "/portal/dean/results", label: "Results", body: "Review and return result submissions." },
    { href: "/portal/dean/admissions", label: "Admissions", body: "Monitor admissions into the faculty." },
    { href: "/portal/dean/graduation", label: "Graduation", body: "Graduation and clearance oversight." },
    { href: "/portal/dean/postgraduate", label: "Postgraduate", body: "PG programmes and supervision." },
    { href: "/portal/dean/academic-management", label: "Academic Management", body: "Departmental administration." },
    { href: "/portal/dean/communications", label: "Communications", body: "Faculty-wide announcements." },
  ],
  workflow: [
    { step: "Departments approve results", note: "HoDs sign off their lecturers’ posted results." },
    { step: "Return submissions to departments", note: "You review and return any result submissions for correction before finalisation." },
    { step: "Exams & Records finalises", note: "Approved, unre-turned results are finalised." },
    { step: "Monitor outcomes", note: "Admissions, graduation and postgraduate activity roll up to your overviews." },
  ],
  canDo: [
    "Review and return result submissions from departments in your faculty.",
    "View and export the faculty student and staff registers.",
    "Monitor admissions, graduation and postgraduate activity.",
    "Publish faculty communications.",
  ],
  cannotDo: [
    "Post or approve individual results directly — approvals happen at department level.",
    "Finalise results — that step belongs to Exams & Records.",
    "Manage matters outside your faculty portfolio.",
  ],
  results:
    "Open Results in your sidebar to review and return the result submissions from your departments.",
  after:
    "Returning a submission sends it back to the department for correction. Result submissions you do not return proceed to Exams & Records for finalisation.",
  dashboard:
    "Click “Dean Dashboard” at the top of your sidebar to return to the faculty overview at any time.",
  history:
    "Past result submissions, admission records and graduation lists remain available from their modules for the relevant session.",
  faqs: [
    {
      q: "How do I review a department’s results?",
      a: "Open Results and switch between the departments in your faculty. Submissions awaiting review are listed with their status; use the return action to send one back for correction.",
    },
    {
      q: "Which students appear under Students?",
      a: "Undergraduate students across the departments in your faculty, with search and export.",
    },
    {
      q: "How do I monitor admissions?",
      a: "Open Admissions to see application and admission activity for your faculty.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
};

// ------------------------------------------------------------------
// Bursary
// ------------------------------------------------------------------

const BURSARY_HELP: RoleHelpContent = {
  description:
    "Guidance for working inside your Bursary portal — student accounts, invoices, payments, waivers and financial reports.",
  workspace:
    "Your bursary portal manages the university’s student finances: issuing invoices, recording payments, approving waivers and scholarships, and clearing students for graduation.",
  startHere: [
    "Review the payment exceptions shown in Reconciliation.",
    "Clear pending waiver and scholarship requests in your workflow.",
    "Run the Revenue and Outstanding reports to understand the current position.",
  ],
  sections: [
    { href: "/portal/bursary", label: "Bursary Dashboard", body: "Financial-management overview." },
    { href: "/portal/bursary/accounts", label: "Student Accounts", body: "Search students and review financial profiles." },
    { href: "/portal/bursary/invoices", label: "Invoices", body: "Issue and manage student invoices." },
    { href: "/portal/bursary/payments", label: "Payments", body: "Payment transactions and receipts." },
    { href: "/portal/bursary/reconciliation", label: "Reconciliation", body: "Match payments and review exceptions." },
    { href: "/portal/bursary/waivers", label: "Waivers", body: "Approve and reject fee waivers." },
    { href: "/portal/bursary/scholarships", label: "Scholarships", body: "Approve and reject scholarship awards." },
    { href: "/portal/bursary/payment-plans", label: "Payment Plans", body: "Installment plans on invoices." },
    { href: "/portal/bursary/clearance", label: "Financial Clearance", body: "Sign off clearance and review obligations." },
    { href: "/portal/bursary/reports", label: "Financial Reports", body: "Revenue, outstanding and activity reports." },
    { href: "/portal/bursary/audit", label: "Audit / Activity", body: "Audit trail and chain integrity." },
  ],
  workflow: [
    { step: "Issue invoices", note: "Create invoices for student fees and charges." },
    { step: "Receive and reconcile payments", note: "Match incoming payments and review exceptions." },
    { step: "Handle waivers and scholarships", note: "Approve or reject with full history." },
    { step: "Clear students", note: "Sign off financial clearance for graduation." },
  ],
  canDo: [
    "Issue and manage student invoices and payment plans.",
    "Record and reconcile payments and issue receipts.",
    "Approve or reject waivers and scholarships.",
    "Sign off financial clearance.",
    "Run revenue, outstanding and activity reports.",
  ],
  cannotDo: [
    "Modify academic records or results.",
    "Approve academic decisions such as admission or graduation eligibility.",
    "View or alter another office’s financial data.",
  ],
  results:
    "Financial Reports gives the revenue, outstanding and activity picture; Reconciliation shows unmatched payments requiring attention.",
  after:
    "Approved waivers and scholarships update the student account immediately and appear in the audit trail. Cleared students become eligible for the next graduation stage.",
  dashboard:
    "Click “Bursary Dashboard” at the top of your sidebar to return to the financial overview at any time.",
  history:
    "Payments, invoices, waivers and clearances are retained with timestamps in the audit trail and reports.",
  faqs: [
    {
      q: "How do I issue an invoice?",
      a: "Open Invoices, search for the student, and create an invoice for the relevant fee. Invoices appear on the student’s Fees & Payments page.",
    },
    {
      q: "How do I approve a waiver?",
      a: "Open Waivers to see pending requests with the applicant’s financial profile. Approve or reject — the decision and reason are recorded.",
    },
    {
      q: "What counts as a reconciliation exception?",
      a: "Payments that do not match an expected transaction appear under Reconciliation for you to review and assign.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
};

// ------------------------------------------------------------------
// Senate Business Committee (SBC) Chairman
// ------------------------------------------------------------------

const SBC_HELP: RoleHelpContent = {
  description:
    "Guidance for working inside your Senate Business Committee portal — university-wide result scrutiny, senate matters and committee decisions.",
  workspace:
    "Your SBC workspace gives you a university-wide, read-only view of the result pipeline and the tools to steer senate business and record committee decisions.",
  startHere: [
    "Open Results / Senate Scrutiny to review the university-wide result pipeline.",
    "Review pending Senate Matters and prepare them for the committee.",
    "Record decisions as they are taken.",
  ],
  sections: [
    { href: "/portal/sbc", label: "SBC Dashboard", body: "Senate scrutiny overview." },
    { href: "/portal/sbc/results", label: "Results / Senate Scrutiny", body: "University-wide result pipeline." },
    { href: "/portal/sbc/matters", label: "Senate Matters", body: "Matters before the committee." },
    { href: "/portal/sbc/decisions", label: "Decisions", body: "Committee resolutions." },
    { href: "/portal/sbc/reports", label: "Reports", body: "Committee reports." },
    { href: "/portal/sbc/communications", label: "Communications", body: "Senate announcements." },
  ],
  workflow: [
    { step: "Monitor the pipeline", note: "Track results from SUBMITTED through HOD_APPROVED to SENATE_APPROVED and FINAL." },
    { step: "Raise matters", note: "Any concern from scrutiny becomes a senate matter." },
    { step: "Record decisions", note: "Committee resolutions are logged against their matters." },
    { step: "Report", note: "Summaries and reports close the loop." },
  ],
  canDo: [
    "View the university-wide result pipeline and audit integrity.",
    "Create and manage senate matters.",
    "Record committee decisions.",
    "Publish committee reports and communications.",
  ],
  cannotDo: [
    "Approve, finalise or modify any result.",
    "Change access permissions or administrative settings.",
    "Edit results or academic records directly.",
  ],
  results:
    "Open Results / Senate Scrutiny for the university-wide pipeline — the SBC view is read-only monitoring.",
  after:
    "Recorded decisions are attached to their matters and appear in reports and the audit trail. Results are never altered from this workspace.",
  dashboard:
    "Click “SBC Dashboard” at the top of your sidebar to return to your scrutiny overview at any time.",
  history:
    "Matters, decisions and reports are retained per session and available from their modules.",
  faqs: [
    {
      q: "Can I approve results from the SBC workspace?",
      a: "No. The SBC workspace is read-only for results — it monitors the pipeline and routes scrutiny through senate matters and decisions.",
    },
    {
      q: "How do I raise a matter for the committee?",
      a: "Open Senate Matters, create the matter and it becomes available for the next meeting cycle.",
    },
    {
      q: "How do I record a decision?",
      a: "Open Decisions, link the resolution to its matter and save. It appears in reports and the audit trail.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
};

// ------------------------------------------------------------------
// DVC Admin / Governance Oversight
// ------------------------------------------------------------------

const DVC_GOVERNANCE_HELP: RoleHelpContent = {
  description:
    "Guidance for your oversight workspace — a read-only, university-wide view of academic and administrative activity.",
  workspace:
    "Your oversight workspace monitors the university as a whole: the results pipeline, population and staffing, exceptions and the audit trail. It is designed for visibility, not day-to-day operations.",
  startHere: [
    "Open Academic Oversight to watch the results pipeline and allocations.",
    "Review the exceptions register for items needing attention.",
    "Run the Audit / Activity view to confirm chain integrity.",
  ],
  sections: [
    { href: "/portal/dvc", label: "Oversight Dashboard", body: "University-wide monitoring." },
    { href: "/portal/dvc/academic", label: "Academic Oversight", body: "Results pipeline and allocations (read-only)." },
    { href: "/portal/dvc/university-overview", label: "University Overview", body: "Population, staffing and faculties." },
    { href: "/portal/dvc/exceptions", label: "Governance Exceptions", body: "Exceptions register." },
    { href: "/portal/dvc/audit", label: "Audit / Activity", body: "Audit trail and chain integrity." },
    { href: "/portal/dvc/reports", label: "Reports", body: "Oversight reports." },
    { href: "/portal/dvc/students", label: "Students", body: "Student register (read-only)." },
    { href: "/portal/dvc/staff", label: "Staff", body: "Staff register (read-only)." },
    { href: "/portal/dvc/communications", label: "Communications", body: "Announcements." },
  ],
  workflow: [
    { step: "Monitor the pipeline", note: "Track results from SUBMITTED through HOD_APPROVED to SENATE_APPROVED and FINAL." },
    { step: "Review exceptions", note: "Identify and escalate anything outside normal bounds." },
    { step: "Verify integrity", note: "Use the audit view to confirm every action is attributable." },
    { step: "Report", note: "Summarise findings for the governance body." },
  ],
  canDo: [
    "View the university-wide results pipeline and academic allocations.",
    "View the student and staff registers.",
    "Review the exceptions register and the full audit trail.",
    "Publish announcements.",
  ],
  cannotDo: [
    "Approve, post, finalise or modify any result.",
    "Approve or reject admissions, waivers, scholarships or clearance.",
    "Change users, permissions or administrative settings.",
  ],
  results:
    "Open Academic Oversight for the results pipeline — your governance view is strictly read-only monitoring.",
  after:
    "Your view never mutates records. Anything that needs action is handled through exceptions, reports or the responsible office.",
  dashboard:
    "Click “Oversight Dashboard” at the top of your sidebar to return to your monitoring overview at any time.",
  history:
    "The audit trail retains every action with a timestamp; reports and exceptions are kept per session.",
  faqs: [
    {
      q: "Why are the results views read-only?",
      a: "The oversight workspace exists to monitor and verify, not to operate. Operational approvals sit with the departments, Exams & Records and Senate processes.",
    },
    {
      q: "What should I do with an exception?",
      a: "Exceptions are the escalation point — raise them to the responsible office or the governance body rather than acting directly.",
    },
    {
      q: "How do I verify chain integrity?",
      a: "Open Audit / Activity to see the immutable trail of every result action with its actor and timestamp.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
};

// ------------------------------------------------------------------
// Vice-Chancellor
// ------------------------------------------------------------------

const VC_HELP: RoleHelpContent = {
  description:
    "Guidance for your executive portal — a university-wide view of results, governance, exceptions and executive reporting.",
  workspace:
    "Your executive portal gives you the university-wide picture: the results pipeline, academic and governance activity, exceptions, audit integrity and executive reporting.",
  startHere: [
    "Open the Executive Dashboard for the university-wide command centre.",
    "Review Results & Records for the executive result pipeline.",
    "Check University Overview for population, staffing and faculties.",
    "Review exceptions and the audit trail.",
  ],
  sections: [
    { href: "/portal/vc", label: "Executive Dashboard", body: "University-wide command centre." },
    { href: "/portal/vc/results", label: "Results & Records", body: "Executive result pipeline." },
    { href: "/portal/vc/university-overview", label: "University Overview", body: "Population, staffing and faculties." },
    { href: "/portal/vc/academic", label: "Academic Affairs", body: "Course allocation and pipeline." },
    { href: "/portal/vc/governance", label: "Governance", body: "Committee activity and oversight." },
    { href: "/portal/vc/exceptions", label: "Exceptions", body: "Governance exceptions register." },
    { href: "/portal/vc/audit", label: "Audit / Activity", body: "Audit trail and chain integrity." },
    { href: "/portal/vc/students", label: "Students", body: "Whole-institution student register." },
    { href: "/portal/vc/staff", label: "Staff", body: "Staff register across the university." },
    { href: "/portal/vc/reports", label: "Reports", body: "Executive reports." },
    { href: "/portal/appointments", label: "Appointments", body: "Approve Dean and Director proposals." },
  ],
  workflow: [
    { step: "Monitor the pipeline", note: "Track results from SUBMITTED through HOD_APPROVED to SENATE_APPROVED and FINAL." },
    { step: "Review governance", note: "Committee activity and the exceptions register." },
    { step: "Verify integrity", note: "Confirm every action is attributable in the audit trail." },
    { step: "Decide on appointments", note: "Approve or return Dean and Director proposals." },
  ],
  canDo: [
    "View the university-wide results pipeline and academic allocations.",
    "View student and staff registers across the institution.",
    "Review exceptions, governance activity and the audit trail.",
    "Approve Dean and Director appointments.",
  ],
  cannotDo: [
    "Post, approve or finalise results in the academic pipeline.",
    "Modify student or staff records directly.",
    "Change users, permissions or administrative settings.",
  ],
  results:
    "Open Results & Records in your sidebar for the executive result pipeline — your executive view is monitoring, not operation.",
  after:
    "Approving an appointment advances it to the next stage; all other actions here are read-only and fully auditable.",
  dashboard:
    "Click “VC Dashboard” at the top of your sidebar to return to the command centre at any time.",
  history:
    "The audit trail, reports and the exceptions register retain the full historical picture across sessions.",
  faqs: [
    {
      q: "How do I approve a Dean or Director appointment?",
      a: "Open Appointments to see proposals awaiting your decision, with their history, then approve or return.",
    },
    {
      q: "Is the results pipeline writable from my portal?",
      a: "No — the executive view monitors the pipeline end-to-end. Operational approvals happen in the departments and at Exams & Records.",
    },
    {
      q: "Where do I verify chain integrity?",
      a: "Open Audit / Activity to review the immutable trail of result actions and their actors.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
};

// ------------------------------------------------------------------
// Prospective Applicant
// ------------------------------------------------------------------

const APPLICANT_HELP: RoleHelpContent = {
  description:
    "Guidance for prospective applicants — tracking your application and acting on offers.",
  workspace:
    "Your applicant portal is where you track the progress of your application and act on any offers you receive.",
  startHere: [
    "Check your application status on the dashboard.",
    "Respond to any offer you receive before its deadline.",
  ],
  sections: [
    { href: "/portal/applications", label: "Applications", body: "Your application status and offers." },
    { href: "/portal/fees", label: "Fees", body: "Any application fees or invoices." },
    { href: "/portal/hostels", label: "Hostels", body: "Accommodation information." },
    { href: "/portal/profiles", label: "Profiles", body: "University profiles." },
    { href: "/portal/postgraduate", label: "Postgraduate", body: "Postgraduate programme information." },
  ],
  workflow: [
    { step: "Submit your application", note: "Your application is reviewed by admissions." },
    { step: "Track status", note: "Watch for Submitted, Under screening and Admitted states." },
    { step: "Accept an offer", note: "Follow the offer instructions before the deadline." },
  ],
  canDo: [
    "View your application status and offers.",
    "Accept or decline an offer.",
    "Raise helpdesk tickets to admissions.",
  ],
  cannotDo: [
    "Register courses, pay semester fees or access student results.",
    "View other applicants’ applications.",
  ],
  results:
    "Your dashboard is the place for application status and offers — results appear only after you become a student.",
  after:
    "Accepting an offer moves you into the admissions flow; your portal is upgraded to a student portal once you matriculate.",
  dashboard:
    "Click your dashboard entry at the top of the sidebar to return to your application overview.",
  history:
    "Your application history and any offers remain visible on the dashboard throughout the cycle.",
  faqs: [
    {
      q: "How do I sign in for the first time?",
      a: "Use the username and password issued to you when you created your application. On first login you must change your password before continuing.",
    },
    {
      q: "How do I track my application?",
      a: "Your dashboard shows your current application status (for example Submitted, Under screening, or Admitted). Check back regularly for updates.",
    },
    {
      q: "I received an offer. What do I do?",
      a: "Your dashboard lists the offers you have received. Follow the instructions on the offer to accept it within the stated deadline.",
    },
    {
      q: "How do I contact admissions?",
      a: "Raise a helpdesk ticket and it will be routed to the Admissions office, or email support@uniabuja.edu.ng.",
    },
  ],
};

// ------------------------------------------------------------------
// Generic staff / module-based roles
// ------------------------------------------------------------------

// Roles without a dedicated workspace use the shared module pages filtered by
// the access-control matrix. Their help sections are derived from those same
// modules so the guidance always matches the sidebar.
function genericHelp(opts: {
  description: string;
  workspace: string;
  startHere: string[];
  canDo: string[];
  cannotDo: string[];
  results: string;
  faqs: HelpFaq[];
  workflow?: HelpWorkflowStep[];
  after?: string;
  history?: string;
}): RoleHelpContent {
  return {
    description: opts.description,
    workspace: opts.workspace,
    startHere: opts.startHere,
    sections: [],
    workflow:
      opts.workflow ?? [{ step: "Open your modules", note: "The sidebar lists every module you have access to." }],
    canDo: opts.canDo,
    cannotDo: opts.cannotDo,
    results: opts.results,
    after:
      opts.after ??
      "Actions you take are recorded with your identity and timestamp. Records move through the approval stages defined by the portal.",
    dashboard:
      "Click the dashboard entry at the top of your sidebar to return to the portal dashboard at any time.",
    history:
      opts.history ??
      "The portal keeps a full audit trail of actions, and module pages retain their records per session.",
    faqs: opts.faqs,
  };
}

const REGISTRY_HELP: RoleHelpContent = genericHelp({
  description:
    "Guidance for the Registry / Admissions office — applications, admissions and student records.",
  workspace:
    "Your registry workspace manages applications and admissions for the university.",
  startHere: [
    "Review incoming applications and their screening status.",
    "Process admissions offers within their deadlines.",
  ],
  canDo: [
    "Process applications and admissions offers.",
    "Maintain student records.",
    "Raise helpdesk tickets for the admissions office.",
  ],
  cannotDo: [
    "Approve or finalise results in the academic pipeline.",
    "Approve financial waivers or scholarships.",
  ],
  results:
    "Results are managed by departments, Exams & Records and Senate processes — not from the registry workspace.",
  faqs: [
    {
      q: "Which modules do I have access to?",
      a: "Your sidebar lists every module granted to the Registry role by the access-control matrix.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
});

const EXAMS_RECORDS_HELP: RoleHelpContent = genericHelp({
  description:
    "Guidance for the Exams & Records office — result finalisation, transcripts and academic records.",
  workspace:
    "Your Exams & Records workspace finalises the result pipeline and manages transcripts and academic records.",
  startHere: [
    "Finalise result submissions that have passed their approvals.",
    "Process transcript requests.",
  ],
  workflow: [
    { step: "Lecturers post results", note: "Lecturers upload result CSVs for their allocated courses." },
    { step: "HoD approves", note: "Heads of Department sign off SUBMITTED results." },
    { step: "Exams & Records finalises", note: "You finalise approved results into the published record." },
  ],
  canDo: [
    "Finalise approved results into the published record.",
    "Process transcript requests.",
    "Manage academic records and result files.",
  ],
  cannotDo: [
    "Post results on behalf of lecturers.",
    "Approve results at department level.",
  ],
  results:
    "The Results module is the pipeline control point where submissions reach you for finalisation.",
  faqs: [
    {
      q: "What arrives at my office for finalisation?",
      a: "Result submissions that have been approved by the department and are awaiting finalisation into the published record.",
    },
    {
      q: "How do I process a transcript?",
      a: "Transcript requests from students are processed from the Transcripts module once the academic record is final.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
});

const STUDENT_AFFAIRS_HELP: RoleHelpContent = genericHelp({
  description:
    "Guidance for Student Affairs & Accommodation — hostels, clearance and student welfare.",
  workspace:
    "Your workspace manages accommodation applications, maintenance and student welfare matters.",
  startHere: [
    "Review hostel applications and allocations.",
    "Handle maintenance requests from residents.",
  ],
  canDo: [
    "Manage hostel applications, allocations and maintenance requests.",
    "Handle student welfare and discipline matters.",
  ],
  cannotDo: [
    "Approve academic results.",
    "Issue or approve financial waivers.",
  ],
  results:
    "Results live in the academic pipeline; your workspace handles accommodation and welfare.",
  faqs: [
    {
      q: "How do I manage hostel applications?",
      a: "Open the Hostels module to review applications, allocate rooms and respond to maintenance requests.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
});

const PG_SCHOOL_HELP: RoleHelpContent = genericHelp({
  description:
    "Guidance for the Postgraduate School — PG applications, supervision and records.",
  workspace:
    "Your workspace manages postgraduate admissions, supervision and student records.",
  startHere: [
    "Review postgraduate applications.",
    "Confirm supervision assignments for admitted students.",
  ],
  canDo: [
    "Process postgraduate applications and admissions.",
    "Manage supervision and PG records.",
  ],
  cannotDo: [
    "Approve undergraduate academic results.",
    "Manage bursary or registry financial data.",
  ],
  results:
    "PG results follow the same pipeline; postgraduate records are managed from the Postgraduate module.",
  faqs: [
    {
      q: "Which module covers postgraduate matters?",
      a: "The Postgraduate module covers applications, supervision and PG student records.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
});

const SIWES_HELP: RoleHelpContent = genericHelp({
  description:
    "Guidance for the SIWES / Industrial Training coordinator — student placements and records.",
  workspace:
    "Your workspace manages student industrial training placements and records.",
  startHere: [
    "Review placement requests and assignments.",
    "Maintain SIWES records for students.",
  ],
  canDo: [
    "Manage SIWES placements and records.",
    "Track students on industrial training.",
  ],
  cannotDo: [
    "Approve or modify academic results.",
  ],
  results:
    "SIWES records are managed from the SIWES module; academic results remain in the academic pipeline.",
  faqs: [
    {
      q: "How do I manage a placement?",
      a: "Open the SIWES module to review requests, assign placements and update student records.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
});

const TIMETABLE_HELP: RoleHelpContent = genericHelp({
  description:
    "Guidance for the Timetable / Venue office — venue scheduling and timetables.",
  workspace:
    "Your workspace manages timetabling and venue allocation for lectures and examinations.",
  startHere: [
    "Confirm current timetables and venue allocations.",
    "Resolve scheduling conflicts as they arise.",
  ],
  canDo: [
    "Manage timetables and venue allocations.",
    "Publish timetable information.",
  ],
  cannotDo: [
    "Approve or modify academic results.",
  ],
  results:
    "Timetable information is published from the Timetabling module; academic results remain in the academic pipeline.",
  faqs: [
    {
      q: "How do I resolve a venue conflict?",
      a: "Open the Timetabling module to review allocations and reassign venues for conflicting slots.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
});

const IT_ADMIN_HELP: RoleHelpContent = genericHelp({
  description:
    "Guidance for the IT / Portal administrator — users, feature flags and system administration.",
  workspace:
    "Your workspace administers the portal itself: users, access, feature flags and API keys.",
  startHere: [
    "Review user accounts and their roles.",
    "Confirm feature flags for the current session.",
  ],
  canDo: [
    "Manage users, roles and system settings.",
    "Manage feature flags and API keys.",
  ],
  cannotDo: [
    "Approve academic results or financial decisions on behalf of business offices.",
  ],
  results:
    "System administration is managed from the Admin module; business results remain in their respective offices.",
  faqs: [
    {
      q: "Where do I manage users?",
      a: "Open the Admin / System module to manage users, roles, feature flags and API keys.",
    },
    {
      q: "How do I raise a helpdesk ticket?",
      a: "Open the Helpdesk page and submit a ticket with a subject, description and priority.",
    },
  ],
});

const VERIFIER_HELP: RoleHelpContent = genericHelp({
  description:
    "Guidance for external / third-party verifiers — confirming the integrity of published records.",
  workspace:
    "Your verifier workspace lets you confirm the integrity and standing of published academic records.",
  startHere: [
    "Open Results to verify a published record.",
    "Confirm the approval and finalisation chain of any result you check.",
  ],
  workflow: [
    { step: "Select the record to verify", note: "Open Results and locate the record or pipeline position you must confirm." },
    { step: "Confirm the chain", note: "Check that every stage — SUBMITTED, HOD_APPROVED, SENATE_APPROVED, FINAL — was recorded." },
  ],
  canDo: [
    "Verify published results and their approval chain.",
    "View the finalisation history of a record.",
  ],
  cannotDo: [
    "Modify any record.",
    "View financial, application or personal data outside the verification scope.",
  ],
  results:
    "Open Results to verify records — your view is read-only confirmation of the published chain.",
  after:
    "Verification never mutates data; your checks rely on the immutable audit trail.",
  faqs: [
    {
      q: "What can I verify?",
      a: "Published results and their approval chain (SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL).",
    },
    {
      q: "Can I modify a record?",
      a: "No. The verifier view is strictly read-only.",
    },
  ],
});

export const ROLE_HELP: Record<string, RoleHelpContent> = {
  STUDENT: STUDENT_HELP,
  LECTURER: LECTURER_HELP,
  HOD: HOD_HELP,
  DEAN: DEAN_HELP,
  BURSARY: BURSARY_HELP,
  SBC_CHAIRMAN: SBC_HELP,
  DVC_OVERSIGHT: DVC_GOVERNANCE_HELP,
  GOVERNANCE_OVERSIGHT_MEMBER: DVC_GOVERNANCE_HELP,
  VC: VC_HELP,
  APPLICANT: APPLICANT_HELP,
  REGISTRY: REGISTRY_HELP,
  EXAMS_RECORDS: EXAMS_RECORDS_HELP,
  STUDENT_AFFAIRS: STUDENT_AFFAIRS_HELP,
  PG_SCHOOL: PG_SCHOOL_HELP,
  SIWES: SIWES_HELP,
  TIMETABLE: TIMETABLE_HELP,
  IT_ADMIN: IT_ADMIN_HELP,
  VERIFIER: VERIFIER_HELP,
};

export function helpForRole(role: string): RoleHelpContent {
  return ROLE_HELP[role] ?? genericFallback(role);
}

// A role that is not in ROLE_HELP still receives accurate, module-derived
// guidance so no user ever sees an empty help page.
function genericFallback(role: string): RoleHelpContent {
  return genericHelp({
    description: "Guidance for your portal workspace — the modules available to your role, plus account and security basics.",
    workspace: `Your ${role} workspace exposes the modules granted to your role. Each module in your sidebar is described below.`,
    startHere: [
      "Open the module that matches the task you need to complete.",
      "Use the Help & Guide link on any page to return to this guide with that page selected.",
    ],
    canDo: [
      "Use every module listed in your sidebar.",
      "Complete the actions your role is granted by the access-control matrix.",
    ],
    cannotDo: [
      "Access modules that are not listed in your sidebar.",
      "Perform actions your role is not granted.",
    ],
    results:
      "Open the Results module from your sidebar, or follow the routing the portal gives you after signing in.",
    faqs: [
      {
        q: "What do I see on my dashboard?",
        a: "Your dashboard shows a summary relevant to your role, such as pending applications, invoices, approvals or requests. The side menu lists the modules you have access to.",
      },
      {
        q: "How do I enable two-factor authentication (MFA)?",
        a: "Go to Account & Security and enable MFA. Scan the QR code with an authenticator app (for example Google Authenticator) and enter the verification code to confirm.",
      },
      {
        q: "How do I raise a helpdesk ticket?",
        a: "Open the Helpdesk page and submit a ticket with a subject, description and priority. Urgent issues are triaged first.",
      },
      {
        q: "Who can see the data I work with?",
        a: "Access is controlled by the portal’s access-control matrix. See the Data Protection (DPO) module for subject-access requests and the privacy policy.",
      },
    ],
  });
}

// Resolves the sidebar module sections for roles that use the generic
// PORTAL_MODULES fallback. Sections mirror exactly what the shell renders so
// the help always matches the menu (including cross-cutting modules).
export function helpSectionsForRole(role: string): HelpSection[] {
  const curated = ROLE_HELP[role]?.sections;
  if (curated && curated.length > 0) return curated;

  const keys = visibleModules(role);
  return [
    ...PORTAL_MODULES.filter((m) => keys.includes(m.key)).map((m) => ({
      href: `/portal/${m.slug}`,
      label: m.title,
      body: m.description,
    })),
    ...Object.keys(CROSS_CUTTING_MODULES)
      .filter((k) => keys.includes(k as ModuleKey))
      .map((k) => {
        const c = CROSS_CUTTING_MODULES[k as ModuleKey]!;
        return { href: c.href, label: c.label, body: c.description };
      }),
  ];
}

// Context-aware help: given the current pathname, return the sidebar section
// the user is on. The `from` parameter may only ever select a section within
// the session-derived role's own content — it can never change the role.
export function helpSectionForPath(role: string, pathname: string): HelpSection | undefined {
  if (!pathname) return undefined;
  const sections = helpSectionsForRole(role);
  const matching = sections.filter((s) => s.href !== "/" && pathname.startsWith(s.href));
  if (matching.length === 0) return undefined;
  matching.sort((a, b) => b.href.length - a.href.length);
  return matching[0];
}

// The "dashboard" target for the help page's back-to-dashboard guidance.
export function helpDashboardForRole(role: string): { href: string; label: string } {
  const dash = dashboardForRole(role);
  return dash ? { href: dash.href, label: dash.label } : { href: "/portal/dashboard", label: "Portal Dashboard" };
}
