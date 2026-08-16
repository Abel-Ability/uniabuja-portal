// Generates fictitious staff + student demo datasets for the UniAbuja portal.
//
// Sources (live Google Sheets, public gviz CSV endpoints):
//   - Fac_Dept_All : authoritative faculty / department / code list
//   - Centres2     : directorates, centres, institutes, schools
//   - real staff sheet : read ONLY to avoid reusing real staff names
//
// Outputs:
//   data/staff.csv      – 6 staff per unit, HoD per department, Dean per faculty,
//                         distinct director assigned to a directorate/centre
//   data/students.csv   – 5 undergraduates per academic department plus
//                         postgraduate / Institute of Education / distance
//                         learning / remedial students (UA/... numbers)
//
// Run: node scripts/generate-demo-users.mjs

const FAC_DEPT_URL =
  "https://docs.google.com/spreadsheets/d/1cu9Wm1fN8f-cKeDj5LEeSFGxQsF9Z7IAjsBZpF4Pvz8/gviz/tq?tqx=out:csv&sheet=Fac_Dept_All";
const CENTRES_URL =
  "https://docs.google.com/spreadsheets/d/1cu9Wm1fN8f-cKeDj5LEeSFGxQsF9Z7IAjsBZpF4Pvz8/gviz/tq?tqx=out:csv&sheet=Centres2";
const REAL_STAFF_URL =
  "https://docs.google.com/spreadsheets/d/15MYxzouFvc5eFD1IbaubhgrMNarHvZzagYMW7UPv9h8/gviz/tq?tqx=out:csv";

const DEMO_PASSWORD = "UniAbuja@2026";
const YEAR = "26";

// Seeded PRNG so regenerating produces the same roster — this keeps the
// documented demo accounts stable across runs. Change the seed to reshuffle.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20260809);

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function quote(field) {
  const s = String(field ?? "");
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(quote).join(",")).join("\n") + "\n";
}

async function fetchCsv(url) {
  const res = await fetch(url, { headers: { "User-Agent": "uniabuja-portal-generator" } });
  if (!res.ok) throw new Error("fetch failed " + url + " -> " + res.status);
  return res.text();
}

// ---------------------------------------------------------------------------
// Fictitious Nigerian name pools
// ---------------------------------------------------------------------------

const MALE_FIRST = [
  "Chinedu", "Emeka", "Oluwaseun", "Tunde", "Ibrahim", "Musa", "Abubakar", "Sani",
  "Yusuf", "Danladi", "Kelechi", "Obinna", "Ifeanyi", "Nnamdi", "Uche", "Chukwuma",
  "Adebayo", "Ayodele", "Babatunde", "Segun", "Femi", "Kunle", "Wale", "Idris",
  "Abdullahi", "Muhammad", "Bello", "Kolawole", "Ademola", "Dayo", "Efosa", "Ikechukwu",
  "Olawale", "Rotimi", "Sulaiman", "Tayo", "Umar", "Zubairu", "Akintunde", "Bolaji",
  "Chidiebere", "Damilare", "Ebere", "Folorunso", "Ganiyu", "Hamza", "Jibril", "Kabiru",
  "Lukman", "Mustapha", "Nura", "Okwudili", "Prosper", "Rasheed", "Shuaibu", "Taiwo",
  "Usman", "Yakubu", "Zakari", "Emmanuel", "Michael", "Peter", "Samuel", "Joseph",
];

const FEMALE_FIRST = [
  "Amina", "Fatima", "Aisha", "Zainab", "Hauwa", "Ngozi", "Chioma", "Ifeoma",
  "Adaeze", "Chiamaka", "Yetunde", "Funmilayo", "Bosede", "Omolara", "Ijeoma", "Nkechi",
  "Amaka", "Uchechi", "Maryam", "Halima", "Safiya", "Blessing", "Grace", "Peace",
  "Esther", "Kehinde", "Taiwo", "Ronke", "Simisola", "Temitope", "Abimbola", "Adetoun",
  "Khadija", "Mariam", "Nafisat", "Rahma", "Salome", "Zara", "Adanna", "Bisola",
  "Chidinma", "Damilola", "Ebele", "Folake", "Gloria", "Habiba", "Immaculata", "Juliana",
  "Kemi", "Lola", "Mirabel", "Nkiru", "Ogechi", "Patience", "Rukayat", "Saudatu",
  "Tolu", "Ujunwa", "Veronica", "Wuraola", "Yemisi", "Zubaida", "Ezinne", "Oluchi",
];

const SURNAMES = [
  "Adeyemi", "Ogunleye", "Balogun", "Okafor", "Eze", "Nwankwo", "Okeke", "Umeh",
  "Ibe", "Obi", "Uzor", "Agbo", "Edeh", "Idoko", "Aliyu", "Bello",
  "Sani", "Danjuma", "Usman", "Adamu", "Mohammed", "Lawal", "Adebayo", "Afolabi",
  "Ajayi", "Babalola", "Ojo", "Olawale", "Okoye", "Anyaegbu", "Chukwu", "Nwosu",
  "Ugwu", "Amaechi", "Okoro", "Egbuna", "Nnamdi", "Oduh", "Iwuagwu", "Okafor",
  "Adeoye", "Bankole", "Coker", "Daramola", "Ekanem", "Fagbemi", "Gbadebo", "Ishola",
  "Jaiyeola", "Kazeem", "Ladipo", "Makanjuola", "Nwadike", "Ogunwale", "Peters", "Quadri",
  "Raji", "Sowunmi", "Taiwo", "Uzoma", "Vandu", "Wahab", "Yakubu", "Zubairu",
  "Abiodun", "Chikwendu", "Enwere", "Iroegbu", "Nwagbo", "Onwubiko", "Udeh", "Adeleke",
  "Adigun", "Akinsola", "Alabi", "Adeosun", "Bamgbose", "Edet", "Farouk", "Garba",
  "Hassan", "Jimoh", "Kalu", "Lazarus", "Mgbachi", "Nwachukwu", "Olayinka", "Salami",
];

// ---------------------------------------------------------------------------
// Real staff names (read-only: used to avoid reuse)
// ---------------------------------------------------------------------------

const TITLES_TO_STRIP = [
  "PROF", "DR", "MR", "MRS", "MS", "MISS", "ENG", "ENGR", "BARR", "PHARM",
  "PHAM", "NR", "MAL", "ALH", "REV", "ARCH", "SURG", "MRS.", "MR.", "MS.",
];

function normaliseName(raw) {
  let s = String(raw ?? "").toUpperCase();
  for (const t of TITLES_TO_STRIP) s = s.split(t + " ").join(" ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function isRealLike(first, surname, realNames) {
  const f = first.toUpperCase();
  const s = surname.toUpperCase();
  for (const real of realNames) {
    if (real.includes(f + " " + s) || real.includes(s + " " + f)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function randInt(n) {
  return Math.floor(random() * n);
}

function pick(arr) {
  return arr[randInt(arr.length)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function range(start, end) {
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function randomPhone() {
  const prefix = pick(["080", "081", "070", "090", "0803", "0806", "0706", "0905"]);
  let digits = "";
  for (let i = 0; i < 8; i++) digits += randInt(10);
  return prefix + digits;
}

function randomDob() {
  const year = 2005 + randInt(4); // 2005–2008
  const month = 1 + randInt(12);
  const day = 1 + randInt(28);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(day)}/${pad(month)}/${year}`;
}

// ---------------------------------------------------------------------------
// Build staff
// ---------------------------------------------------------------------------

function buildStaff(units, centres, realNames) {
  const staff = [];
  const usedIds = new Set();
  const usedNames = new Set();
  const idPool = shuffle(range(10, 9999)); // 2, 3 or 4 digits

  const academicUnits = units.filter((u) => u.faculty !== "Non-Teaching");
  const nonTeachingUnits = units.filter((u) => u.faculty === "Non-Teaching");

  // faculty numbering (3 digits common to each faculty)
  const facultyOrder = [...new Set(academicUnits.map((u) => u.faculty))];
  const facultyNum = {};
  facultyOrder.forEach((f, i) => {
    facultyNum[f] = String(i + 1).padStart(3, "0");
  });

  // --- role helpers ---
  const NT_ROLE = {
    REGI: "REGISTRY",
    BURS: "BURSARY",
    SAD: "STUDENT_AFFAIRS",
    ITMS: "IT_ADMIN",
  };

  const newStaffId = (prefix) => {
    let id;
    do {
      id = prefix + idPool.pop();
    } while (usedIds.has(id) && idPool.length > 0);
    if (usedIds.has(id)) throw new Error("staff ID pool exhausted");
    usedIds.add(id);
    return id;
  };

  const newName = (gender, avoid) => {
    const firstPool = gender === "Male" ? MALE_FIRST : FEMALE_FIRST;
    for (let tries = 0; tries < 200; tries++) {
      const first = pick(firstPool);
      const surname = pick(SURNAMES);
      const key = first + " " + surname;
      if (usedNames.has(key)) continue;
      if (isRealLike(first, surname, avoid)) continue;
      usedNames.add(key);
      return { first, surname, full: first + " " + surname };
    }
    throw new Error("could not generate a unique fictitious name");
  };

  const gendersForDept = () => shuffle(["Male", "Male", "Male", "Female", "Female", "Female"]);

  // --- academic staff ---
  for (const unit of academicUnits) {
    const genders = gendersForDept();
    const roles = ["Prof.", "Prof.", "Dr.", "Dr.", "", ""];
    const ranks = ["Professor", "Professor", "Associate Professor", "Senior Lecturer", "Lecturer I", "Lecturer II"];
    const members = [];
    for (let i = 0; i < 6; i++) {
      const g = genders[i];
      const n = newName(g, realNames);
      members.push({
        title: roles[i],
        rank: ranks[i],
        sex: g === "Male" ? "Male" : "Female",
        first: n.first,
        surname: n.surname,
        fullName: roles[i] ? `${roles[i]} ${n.full}` : n.full,
        role: "LECTURER",
        position: "Lecturer",
        directorate: "",
      });
    }
    // professors: member[0] = HoD, member[1] = dean candidate
    members[0].role = "HOD";
    members[0].position = "Head of Department";
    for (const m of members) {
      staff.push({
        id: newStaffId("ACA"),
        password: DEMO_PASSWORD,
        title: m.title,
        fullName: m.fullName,
        first: m.first,
        surname: m.surname,
        sex: m.sex,
        rank: m.rank,
        status: "Tenure",
        faculty: unit.faculty,
        department: unit.department,
        role: m.role,
        position: m.position,
        directorate: m.directorate,
        phone: randomPhone(),
        email: "",
      });
    }
  }

  // --- non-teaching staff ---
  for (const unit of nonTeachingUnits) {
    const genders = gendersForDept();
    const role = NT_ROLE[unit.code] ?? "LECTURER";
    for (let i = 0; i < 6; i++) {
      const g = genders[i];
      const n = newName(g, realNames);
      const title = pick(["Mr.", "Mrs.", "Ms.", "Dr.", "Engr."]);
      staff.push({
        id: newStaffId("SS"),
        password: DEMO_PASSWORD,
        title,
        fullName: `${title} ${n.full}`,
        first: n.first,
        surname: n.surname,
        sex: g === "Male" ? "Male" : "Female",
        rank: "Senior Staff",
        status: "Permanent",
        faculty: "Non-Teaching",
        department: unit.department,
        role,
        position: i === 0 ? "Head of Unit" : "Administrative Officer",
        directorate: "",
        phone: randomPhone(),
        email: "",
      });
    }
  }

  // --- office roles from non-teaching staff (Exams / PG School / SIWES) ---
  const NT_OFFICE_ROLES = ["EXAMS_RECORDS", "PG_SCHOOL", "SIWES"];
  const preferUnit = [
    "Registry",
    "Office of Vice-Chancellor",
    "Student Affairs Division",
    "Information & University Relations",
    "Bursary",
    "Legal Affairs/General Counsel",
  ];
  const ntLecturers = staff.filter((s) => s.faculty === "Non-Teaching" && s.role === "LECTURER");
  const ntPool = [
    ...preferUnit.flatMap((u) => ntLecturers.filter((s) => s.department === u)),
    ...ntLecturers,
  ];
  const seen = new Set();
  for (const role of NT_OFFICE_ROLES) {
    const member = ntPool.find((s) => !seen.has(s.id));
    if (!member) throw new Error(`not enough non-teaching staff to assign ${role}`);
    seen.add(member.id);
    member.role = role;
    member.position =
      role === "EXAMS_RECORDS"
        ? "Exams & Records Officer"
        : role === "PG_SCHOOL"
          ? "Postgraduate School Officer"
          : "SIWES / Industrial Training Coordinator";
  }

  // --- deans (one professor per faculty, not an HoD) ---
  for (const f of facultyOrder) {
    const candidates = staff.filter(
      (s) => s.faculty === f && s.rank === "Professor" && s.position !== "Head of Department",
    );
    if (candidates.length === 0) continue;
    const dean = pick(candidates);
    dean.role = "DEAN";
    dean.position = "Dean of Faculty";
  }

  // --- directors (distinct directorates/centres, no HoD / no Dean) ---
  const directorCount = Math.min(academicUnits.length, centres.length);
  const chosenDepts = shuffle(academicUnits).slice(0, directorCount);
  const assignedUnits = shuffle(centres);
  chosenDepts.forEach((unit, idx) => {
    const eligible = staff.filter(
      (s) => s.department === unit.department && s.position !== "Head of Department" && s.position !== "Dean of Faculty",
    );
    if (eligible.length === 0) return;
    const director = pick(eligible);
    const centre = assignedUnits[idx];
    director.position = "Director";
    director.directorate = centre;
    if (centre.toUpperCase().includes("ACADEMIC PLANNING")) {
      director.role = "DIRECTOR_ACADEMIC_PLANNING";
    } else if (director.role === "HOD" || director.role === "DEAN") {
      director.role = "LECTURER";
    }
  });

  // --- VC + DVC: professors with no HoD / Dean / Director role ---
  const nonAdminProfessors = staff.filter(
    (s) => s.rank === "Professor" && s.position === "Lecturer",
  );
  if (nonAdminProfessors.length < 2) {
    throw new Error("need at least 2 non-admin professors for VC/DVC");
  }
  const vc = pick(nonAdminProfessors);
  vc.role = "VC";
  vc.position = "Vice-Chancellor";
  const dvc = pick(nonAdminProfessors.filter((s) => s !== vc));
  dvc.role = "DVC_OVERSIGHT";
  dvc.position = "Deputy Vice-Chancellor (Admin & Academic)";

  // --- SBC Chairman: the first eligible academic lecturer (not HoD / Dean /
  // --- Director / VC / DVC), ordered by staff number. Deterministic so the
  // --- documented SBC test user stays stable across regenerations, and the
  // --- seed's fallback rule converges on the same record.
  const sbcCandidate = staff
    .filter(
      (s) => s.role === "LECTURER" && s.position === "Lecturer" && s.faculty !== "Non-Teaching",
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (sbcCandidate) {
    sbcCandidate.role = "SBC_CHAIRMAN";
  }

  // --- Governance & Oversight committee member: the first eligible academic
  // --- lecturer remaining after the SBC chairman was assigned, ordered by
  // --- staff number. Deterministic so the documented governance test user
  // --- (ACA1011, Prof. Nafisat Daramola, Law/Islamic Law) stays stable across
  // --- regenerations, and the seed's fallback rule converges on the same record.
  const govCandidate = staff
    .filter(
      (s) => s.role === "LECTURER" && s.position === "Lecturer" && s.faculty !== "Non-Teaching",
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (govCandidate) {
    govCandidate.role = "GOVERNANCE_OVERSIGHT_MEMBER";
  }

  // emails from staff id
  for (const s of staff) s.email = s.id.toLowerCase() + "@uniabuja.edu.ng";

  return { staff, facultyNum };
}

// ---------------------------------------------------------------------------
// Build students
// ---------------------------------------------------------------------------

function buildStudents(academicUnits, facultyNum, realNames) {
  const students = [];
  const usedRegs = new Set();
  const usedNames = new Set();

  const newName = (gender, avoid) => {
    const firstPool = gender === "Male" ? MALE_FIRST : FEMALE_FIRST;
    for (let tries = 0; tries < 200; tries++) {
      const first = pick(firstPool);
      const surname = pick(SURNAMES);
      const key = first + " " + surname;
      if (usedNames.has(key)) continue;
      if (isRealLike(first, surname, avoid)) continue;
      usedNames.add(key);
      return { first, surname, full: first + " " + surname };
    }
    throw new Error("could not generate a unique student name");
  };

  for (const unit of academicUnits) {
    const code = unit.code; // e.g. PSC-CSC
    const dept3 = code.replace(/[^A-Z0-9]/g, "").slice(-3).toUpperCase();
    const facNum = facultyNum[unit.faculty];
    for (let i = 0; i < 5; i++) {
      const gender = i % 2 === 0 ? "Female" : "Male"; // alternate for mix
      const n = newName(gender, realNames);
      let regNo;
      do {
        const suffix = "0" + String(randInt(1000)).padStart(3, "0"); // 0### (0000–0999)
        regNo = `${YEAR}/${facNum}${dept3}/${suffix}`;
      } while (usedRegs.has(regNo));
      usedRegs.add(regNo);
      students.push({
        regNo,
        username: regNo,
        password: DEMO_PASSWORD,
        fullName: n.full,
        first: n.first,
        surname: n.surname,
        faculty: unit.faculty,
        department: unit.department,
        gender,
        dob: randomDob(),
        email: regNo.replace(/\//g, "") + "@uniabuja.edu.ng",
        category: "UNDERGRADUATE",
      });
    }
  }

  // Non-undergraduate streams. PG numbers are issued only after admission via
  // the PG School, even where the programme is hosted by a directorate. IOE /
  // DL / RM students keep their academic unit in the department column; the
  // Category column carries the stream.
  const OTHER_CATEGORIES = [
    { key: "POSTGRADUATE", prefix: "PG", perUnit: 1 },
    { key: "INSTITUTE_OF_EDUCATION", prefix: "IOE", perUnit: 1 },
    { key: "DISTANCE_LEARNING", prefix: "DL", perUnit: 1 },
    { key: "REMEDIAL", prefix: "RM", perUnit: 1 },
  ];
  for (const cat of OTHER_CATEGORIES) {
    for (const unit of academicUnits) {
      for (let i = 0; i < cat.perUnit; i++) {
        const gender = i % 2 === 0 ? "Female" : "Male";
        const n = newName(gender, realNames);
        let regNo;
        do {
          const group = String(randInt(10000)).padStart(4, "0");
          const serial = String(randInt(1000000)).padStart(6, "0");
          regNo = `UA/${cat.prefix}${group}/${serial}`;
        } while (usedRegs.has(regNo));
        usedRegs.add(regNo);
        students.push({
          regNo,
          username: regNo,
          password: DEMO_PASSWORD,
          fullName: n.full,
          first: n.first,
          surname: n.surname,
          faculty: unit.faculty,
          department: unit.department,
          gender,
          dob: randomDob(),
          email: regNo.replace(/\//g, "") + "@uniabuja.edu.ng",
          category: cat.key,
        });
      }
    }
  }
  return students;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [facDeptText, centresText, realStaffText] = await Promise.all([
    fetchCsv(FAC_DEPT_URL),
    fetchCsv(CENTRES_URL),
    fetchCsv(REAL_STAFF_URL),
  ]);

  const facDept = parseCsv(facDeptText);
  const centres = parseCsv(centresText)
    .map((r) => r[0]?.trim())
    .filter((v) => v && !/centre\/directorate/i.test(v));
  const realStaff = parseCsv(realStaffText);

  const units = facDept
    .filter((r) => r.length >= 3 && r[0].trim() !== "Faculty")
    .map((r) => ({
      faculty: r[0].trim(),
      department: r[1].trim(),
      code: r[2].trim(),
    }))
    .filter((u) => u.faculty && u.department && u.code);

  const realNames = realStaff.map((r) => {
    const idx = r.findIndex((c) => /name/i.test(c));
    return idx >= 0 ? normaliseName(r[idx]) : "";
  }).filter(Boolean);

  const academicUnits = units.filter((u) => u.faculty !== "Non-Teaching");
  const nonTeachingUnits = units.filter((u) => u.faculty === "Non-Teaching");

  // verify dept-code uniqueness within each faculty (for reg numbers)
  const collisions = [];
  for (const f of [...new Set(academicUnits.map((u) => u.faculty))]) {
    const seen = new Map();
    for (const u of academicUnits.filter((x) => x.faculty === f)) {
      const part = u.code.replace(/[^A-Z0-9]/g, "").slice(-3).toUpperCase();
      if (seen.has(part)) collisions.push(`${f}: ${seen.get(part)} vs ${u.code}`);
      seen.set(part, u.code);
    }
  }

  const { staff, facultyNum } = buildStaff(units, centres, realNames);
  const students = buildStudents(academicUnits, facultyNum, realNames);

  const staffCsv = [
    ["Staff ID", "Password", "Title", "Full Name", "First Name", "Surname", "Sex", "Rank", "Status", "Faculty", "Department", "Role", "Position", "Directorate/Centre", "Phone Number", "Email"],
    ...staff.map((s) => [
      s.id, s.password, s.title, s.fullName, s.first, s.surname, s.sex, s.rank,
      s.status, s.faculty, s.department, s.role, s.position, s.directorate, s.phone, s.email,
    ]),
  ];

  const studentCsv = [
    ["Registration Number", "Username", "Password", "Full Name", "First Name", "Surname", "Faculty", "Department", "Gender", "Date of Birth", "Email", "Category"],
    ...students.map((st) => [
      st.regNo, st.username, st.password, st.fullName, st.first, st.surname,
      st.faculty, st.department, st.gender, st.dob, st.email, st.category,
    ]),
  ];

  const fs = await import("node:fs");
  fs.writeFileSync("data/staff.csv", toCsv(staffCsv), "utf8");
  fs.writeFileSync("data/students.csv", toCsv(studentCsv), "utf8");

  const deans = staff.filter((s) => s.role === "DEAN").length;
  const hods = staff.filter((s) => s.role === "HOD").length;
  const directors = staff.filter((s) => s.position === "Director").length;
  const apu = staff.filter((s) => s.role === "DIRECTOR_ACADEMIC_PLANNING").length;

  const firstOf = (role) => staff.find((s) => s.role === role) ?? null;
  const keyAccounts = [
    ["VC", firstOf("VC")],
    ["DVC_OVERSIGHT", firstOf("DVC_OVERSIGHT")],
    ["REGISTRY", firstOf("REGISTRY")],
    ["BURSARY", firstOf("BURSARY")],
    ["STUDENT_AFFAIRS", firstOf("STUDENT_AFFAIRS")],
    ["EXAMS_RECORDS", firstOf("EXAMS_RECORDS")],
    ["PG_SCHOOL", firstOf("PG_SCHOOL")],
    ["SIWES", firstOf("SIWES")],
    ["DIRECTOR_ACADEMIC_PLANNING", firstOf("DIRECTOR_ACADEMIC_PLANNING")],
    ["IT_ADMIN", firstOf("IT_ADMIN")],
    ["HOD (Computer Science)", staff.find((s) => s.role === "HOD" && s.department === "Computer Science") ?? null],
    ["DEAN (Physical Science)", staff.find((s) => s.role === "DEAN" && s.faculty === "Physical Science") ?? null],
    ["LECTURER (Computer Science)", staff.find((s) => s.role === "LECTURER" && s.department === "Computer Science") ?? null],
    ["SBC_CHAIRMAN", firstOf("SBC_CHAIRMAN")],
    ["GOVERNANCE_OVERSIGHT_MEMBER", firstOf("GOVERNANCE_OVERSIGHT_MEMBER")],
  ];

  console.log("=== SUMMARY ===");
  console.log(`units loaded        : ${units.length} (academic ${academicUnits.length}, non-teaching ${nonTeachingUnits.length})`);
  console.log(`directorates loaded : ${centres.length}`);
  console.log(`dept-code collisions: ${collisions.length === 0 ? "none" : collisions.join("; ")}`);
  console.log(`real names skipped  : ${realNames.length} loaded for collision avoidance`);
  console.log(`faculties numbered  : ${Object.keys(facultyNum).length}`);
  console.log(`--- staff ---`);
  console.log(`staff generated     : ${staff.length}`);
  console.log(`HoDs                : ${hods}`);
  console.log(`Deans               : ${deans}`);
  console.log(`Directors           : ${directors} (of which Academic Planning: ${apu})`);
  console.log(`distinct IDs        : ${new Set(staff.map((s) => s.id)).size}`);
  console.log(`ID prefix sample    : ${staff.slice(0, 6).map((s) => s.id).join(", ")}`);
  console.log("--- KEY ACCOUNTS ---");
  for (const [label, m] of keyAccounts) {
    if (m) console.log(`${label.padEnd(28)} ${m.id.padEnd(10)} ${m.fullName}  (${m.department})`);
  }
  console.log(`--- students ---`);
  console.log(`students generated  : ${students.length}`);
  console.log(`distinct reg numbers: ${new Set(students.map((s) => s.regNo)).size}`);
  const byCat = students.reduce((m, s) => {
    m[s.category] = (m[s.category] ?? 0) + 1;
    return m;
  }, {});
  console.log(`by category         : ` + Object.entries(byCat).map(([k, v]) => `${k}: ${v}`).join(", "));
  console.log(`reg sample          : ${students.slice(0, 6).map((s) => s.regNo).join(", ")}`);
  console.log(`files written       : data/staff.csv, data/students.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
