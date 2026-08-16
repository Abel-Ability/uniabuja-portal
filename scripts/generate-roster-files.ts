// Regenerates data/staff.csv and data/students.csv from the live Google Sheet.
//
//   data/staff.csv    – the full staff roster (staff tab, 15 columns, no password;
//                       phones reconstructed from scientific notation).
//   data/students.csv – fictitious students: 20-25 per department per level across
//                       all five categories (UNDERGRADUATE, DISTANCE_LEARNING,
//                       INSTITUTE_OF_EDUCATION, REMEDIAL, POSTGRADUATE), in the
//                       13-column layout the user pastes into the students tab.
//
// The CSV content is what the user pastes back into the "staff" and "students"
// tabs of the shared spreadsheet (SPREADSHEET_ID). Run with:
//   npx tsx scripts/generate-roster-files.ts
//
// Registration numbers are derived from the admission year so the portal's
// studentLevel() computes the intended level, and sequence blocks are partitioned
// per category so reg numbers never collide within a (department, year) prefix.

import { departmentMaxLevel } from "../src/lib/constants";
import * as fs from "node:fs";

const SPREADSHEET_ID = "1cu9Wm1fN8f-cKeDj5LEeSFGxQsF9Z7IAjsBZpF4Pvz8";
const gviz = (sheet: string) =>
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

// ---------------------------------------------------------------------------
// Seeded PRNG (deterministic output across runs)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20260815);

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function quote(field: unknown): string {
  const s = String(field ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quote).join(",")).join("\n") + "\n";
}

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "uniabuja-portal-generator" } });
  if (!res.ok) throw new Error(`fetch failed ${url} -> ${res.status}`);
  return res.text();
}

// Staff phones arrive in scientific notation (8.03E+09) that loses the leading
// "0"; reconstruct the familiar 11-digit Nigerian mobile shape.
function normalizePhone(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const sci = /^(\d+(?:\.\d+)?)E([+-]?\d+)$/i.exec(raw);
  if (sci) {
    const digits = String(Math.round(parseFloat(`${sci[1]}e${sci[2]}`)));
    return digits.length === 10 ? `0${digits}` : digits;
  }
  return raw.replace(/[^0-9]/g, "");
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

const MIDDLE_NAMES = [
  "Olawale", "Chibuzor", "Obinna", "Ibrahim", "Adeola", "Chukwuma", "Ose", "Jibrin",
  "Kehinde", "Boluwatife", "Nwabueze", "Segun", "Abubakar", "Chiamaka", "Ishaku", "Femi",
  "Ogechi", "Damilola", "Umar", "Chidera", "Adaeze", "Zainab", "Ikenna", "Kudirat",
  "Emeka", "Bosede", "Yusuf", "Olamilekan", "Ngozi", "Aminu", "Chidimma", "Rotimi",
  "Hauwa", "Ifeanyi", "Yetunde", "Musa", "Chinwe", "Kabiru", "Omolola", "Sadiq",
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

const STATE_LGA: Record<string, string[]> = {
  "FCT": ["Abaji", "Gwagwalada", "Kwali", "Bwari"],
  "Abia": ["Aba North", "Umuahia North", "Ohafia", "Isiala Ngwa"],
  "Adamawa": ["Yola North", "Mubi North", "Numan", "Ganye"],
  "Akwa Ibom": ["Uyo", "Eket", "Ikot Ekpene", "Oron"],
  "Anambra": ["Awka South", "Onitsha North", "Nnewi North", "Idemili North"],
  "Bauchi": ["Bauchi", "Azare", "Misau", "Ningi"],
  "Bayelsa": ["Yenagoa", "Brass", "Ogbia", "Sagbama"],
  "Benue": ["Makurdi", "Gboko", "Otukpo", "Katsina-Ala"],
  "Borno": ["Maiduguri", "Biu", "Dikwa", "Bama"],
  "Cross River": ["Calabar South", "Ogoja", "Ikom", "Obudu"],
  "Delta": ["Warri South", "Sapele", "Uvwie", "Asaba"],
  "Ebonyi": ["Abakaliki", "Afikpo North", "Onicha", "Ishielu"],
  "Edo": ["Oredo", "Benin City", "Ekpoma", "Auchi"],
  "Ekiti": ["Ado-Ekiti", "Ikere", "Oye", "Ise-Orun"],
  "Enugu": ["Enugu North", "Nsukka", "Udi", "Agwu"],
  "Gombe": ["Gombe", "Kaltungo", "Billiri", "Dukku"],
  "Imo": ["Owerri Municipal", "Okigwe", "Orlu", "Mbaitoli"],
  "Jigawa": ["Dutse", "Hadejia", "Gumel", "Ringim"],
  "Kaduna": ["Kaduna North", "Zaria", "Kafanchan", "Sabon Gari"],
  "Kano": ["Kano Municipal", "Fagge", "Dala", "Gwale"],
  "Katsina": ["Katsina", "Daura", "Funtua", "Malumfashi"],
  "Kebbi": ["Birnin Kebbi", "Argungu", "Jega", "Yauri"],
  "Kogi": ["Lokoja", "Okene", "Idah", "Kabba"],
  "Kwara": ["Ilorin West", "Offa", "Ilorin South", "Moro"],
  "Lagos": ["Alimosho", "Ikeja", "Eti-Osa", "Surulere"],
  "Nasarawa": ["Lafia", "Keffi", "Nasarawa", "Akwanga"],
  "Niger": ["Minna", "Bida", "Suleja", "Kontagora"],
  "Ogun": ["Abeokuta South", "Ijebu Ode", "Sagamu", "Ifo"],
  "Ondo": ["Akure South", "Owo", "Ondo West", "Odigbo"],
  "Osun": ["Osogbo", "Ife Central", "Ilesa East", "Iwo"],
  "Oyo": ["Ibadan North", "Ogbomoso North", "Oyo West", "Saki West"],
  "Plateau": ["Jos North", "Barkin Ladi", "Pankshin", "Shendam"],
  "Rivers": ["Port Harcourt", "Obio-Akpor", "Okrika", "Ahoada East"],
  "Sokoto": ["Sokoto North", "Wamako", "Gwadabawa", "Tambuwal"],
  "Taraba": ["Jalingo", "Wukari", "Bali", "Takum"],
  "Yobe": ["Damaturu", "Potiskum", "Gashua", "Nguru"],
  "Zamfara": ["Gusau", "Kaura Namoda", "Talata Mafara", "Anka"],
};

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function randInt(n: number): number {
  return Math.floor(random() * n);
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(arr.length)];
}

function pad(n: number | string, len: number): string {
  return String(n).padStart(len, "0");
}

// Level -> 2-digit admission year prefix. level = 100 + (CURRENT_SESSION_START_YEAR - admissionYear)*100
// with CURRENT_SESSION_START_YEAR = 2025, so: 100 -> "25", 200 -> "24", 300 -> "23", 400 -> "22",
// 500 -> "21", 600 -> "20".
function yearForLevel(level: number): string {
  const year = 2025 - (level - 100) / 100;
  return String(year).slice(-2);
}

function randomPhone(): string {
  const prefix = pick(["080", "081", "070", "090", "0803", "0806", "0706", "0905"]);
  let digits = "";
  for (let i = 0; i < 8; i++) digits += randInt(10);
  return prefix + digits;
}

function randomDob(admissionYear: number): string {
  const year = admissionYear - 17 - randInt(3); // 17-19 at admission
  const month = 1 + randInt(12);
  const day = 1 + randInt(28);
  return `${pad(day, 2)}/${pad(month, 2)}/${year}`;
}

function randomStateLg(): { state: string; lg: string } {
  const states = Object.keys(STATE_LGA);
  const state = pick(states);
  return { state, lg: pick(STATE_LGA[state]) };
}

function emailFromRegNo(regNo: string): string {
  return regNo.replace(/\//g, "") + "@uniabuja.edu.ng";
}

// ---------------------------------------------------------------------------
// Build students
// ---------------------------------------------------------------------------

type AcademicUnit = { faculty: string; department: string; code: string };

const CATEGORY_BLOCKS: Record<string, number> = {
  UNDERGRADUATE: 0,
  DISTANCE_LEARNING: 1000,
  INSTITUTE_OF_EDUCATION: 2000,
  REMEDIAL: 3000,
};

function buildStudents(units: AcademicUnit[], facultyNum: Record<string, string>) {
  const students: { regNo: string; surname: string; first: string; other: string; faculty: string; department: string; gender: string; state: string; lg: string; dob: string; phone: string; email: string; category: string }[] = [];
  const usedFull = new Set<string>();
  const usedRegs = new Set<string>();

  const newName = (gender: string) => {
    const firstPool = gender === "Male" ? MALE_FIRST : FEMALE_FIRST;
    for (let tries = 0; tries < 400; tries++) {
      const first = pick(firstPool);
      const other = pick(MIDDLE_NAMES);
      const surname = pick(SURNAMES);
      const key = `${first} ${other} ${surname}`;
      if (usedFull.has(key)) continue;
      usedFull.add(key);
      return { first, other, surname, full: key };
    }
    const first = pick(firstPool);
    const surname = pick(SURNAMES);
    return { first, other: pick(MIDDLE_NAMES), surname, full: `${first} ${surname}` };
  };

  const addStudent = (regNo: string, n: ReturnType<typeof newName>, unit: AcademicUnit, category: string, gender: string, admissionYear: number) => {
    if (usedRegs.has(regNo)) throw new Error(`duplicate reg number generated: ${regNo}`);
    usedRegs.add(regNo);
    const { state, lg } = randomStateLg();
    students.push({
      regNo,
      surname: n.surname,
      first: n.first,
      other: n.other,
      faculty: unit.faculty,
      department: unit.department,
      gender,
      state,
      lg,
      dob: randomDob(admissionYear),
      phone: randomPhone(),
      email: emailFromRegNo(regNo),
      category,
    });
  };

  for (const unit of units) {
    const facNum = facultyNum[unit.faculty];
    const dept3 = unit.code.replace(/[^A-Z0-9]/g, "").slice(-3).toUpperCase();
    const maxLevel = departmentMaxLevel(unit.department);

    // UNDERGRADUATE: every level up to the programme duration.
    for (let level = 100; level <= maxLevel; level += 100) {
      const count = 20 + randInt(6); // 20-25
      const base = CATEGORY_BLOCKS.UNDERGRADUATE;
      for (let i = 1; i <= count; i++) {
        const regNo = `${yearForLevel(level)}/${facNum}${dept3}/${pad(base + i, 4)}`;
        const gender = i % 2 === 0 ? "Female" : "Male";
        addStudent(regNo, newName(gender), unit, "UNDERGRADUATE", gender, 2025 - (level - 100) / 100);
      }
    }

    // DISTANCE_LEARNING + INSTITUTE_OF_EDUCATION: 4-year streams.
    for (const category of ["DISTANCE_LEARNING", "INSTITUTE_OF_EDUCATION"] as const) {
      for (let level = 100; level <= 400; level += 100) {
        const count = 20 + randInt(6);
        const base = CATEGORY_BLOCKS[category];
        for (let i = 1; i <= count; i++) {
          const regNo = `${yearForLevel(level)}/${facNum}${dept3}/${pad(base + i, 4)}`;
          const gender = i % 2 === 0 ? "Female" : "Male";
          addStudent(regNo, newName(gender), unit, category, gender, 2025 - (level - 100) / 100);
        }
      }
    }

    // REMEDIAL: one year only.
    {
      const count = 20 + randInt(6);
      const base = CATEGORY_BLOCKS.REMEDIAL;
      for (let i = 1; i <= count; i++) {
        const regNo = `${yearForLevel(100)}/${facNum}${dept3}/${pad(base + i, 4)}`;
        const gender = i % 2 === 0 ? "Female" : "Male";
        addStudent(regNo, newName(gender), unit, "REMEDIAL", gender, 2025);
      }
    }

    // POSTGRADUATE: one cohort per department, provisional UA/PG numbers.
    {
      const count = 20 + randInt(6);
      const deptIndex = units.indexOf(unit);
      const group = pad(2000 + deptIndex, 4);
      for (let i = 1; i <= count; i++) {
        const regNo = `UA/PG${group}/${pad(i, 6)}`;
        const gender = i % 2 === 0 ? "Female" : "Male";
        addStudent(regNo, newName(gender), unit, "POSTGRADUATE", gender, 2023 - randInt(3));
      }
    }
  }

  return students;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [facDeptText, staffText] = await Promise.all([
    fetchCsv(gviz("Fac_Dept_All")),
    fetchCsv(gviz("staff")),
  ]);

  const facDept = parseCsv(facDeptText);
  const staff = parseCsv(staffText);

  const units: AcademicUnit[] = facDept
    .filter((r) => r.length >= 3 && r[0].trim() !== "Faculty")
    .map((r) => ({
      faculty: r[0].trim(),
      department: r[1].trim(),
      code: r[2].trim(),
    }))
    .filter((u) => u.faculty && u.department && u.code && u.faculty !== "Non-Teaching");

  // Faculty numbering: order of appearance in Fac_Dept_All (1-based, 3 digits).
  const facultyOrder = [...new Set(units.map((u) => u.faculty))];
  const facultyNum: Record<string, string> = {};
  facultyOrder.forEach((f, i) => {
    facultyNum[f] = pad(i + 1, 3);
  });

  const students = buildStudents(units, facultyNum);

  // staff.csv: mirror the sheet staff tab (15 cols). Phones reconstructed.
  const staffCsv: string[][] = [
    ["Staff ID", "Title", "Full Name", "First Name", "Surname", "Sex", "Rank", "Status", "Faculty", "Department", "Role", "Position", "Directorate/Centre", "Phone Number", "Email"],
    ...staff.slice(1).map((r) => [
      r[0]?.trim() ?? "",
      r[1]?.trim() ?? "",
      r[2]?.trim() ?? "",
      r[3]?.trim() ?? "",
      r[4]?.trim() ?? "",
      r[5]?.trim() ?? "",
      r[6]?.trim() ?? "",
      r[7]?.trim() ?? "",
      r[8]?.trim() ?? "",
      r[9]?.trim() ?? "",
      r[10]?.trim() ?? "",
      r[11]?.trim() ?? "",
      r[12]?.trim() ?? "",
      normalizePhone(r[13]),
      r[14]?.trim() ?? "",
    ]),
  ];

  // students.csv: 13-column layout the user pastes into the students tab.
  const studentCsv: string[][] = [
    ["Reg No", "Surname", "First Name", "Other names", "Faculty", "Department", "Gender", "State", "Local_Government", "DOB", "Phone", "Email", "Category"],
    ...students.map((s) => [
      s.regNo, s.surname, s.first, s.other, s.faculty, s.department, s.gender,
      s.state, s.lg, s.dob, s.phone, s.email, s.category,
    ]),
  ];

  fs.writeFileSync("data/staff.csv", toCsv(staffCsv), "utf8");
  fs.writeFileSync("data/students.csv", toCsv(studentCsv), "utf8");

  const byCat = students.reduce<Record<string, number>>((m, s) => {
    m[s.category] = (m[s.category] ?? 0) + 1;
    return m;
  }, {});

  console.log("=== SUMMARY ===");
  console.log(`academic units     : ${units.length}`);
  console.log(`faculties numbered : ${Object.keys(facultyNum).length}`);
  console.log(`staff rows written : ${staffCsv.length - 1}`);
  console.log(`students generated : ${students.length}`);
  console.log(`distinct regs      : ${new Set(students.map((s) => s.regNo)).size}`);
  console.log(`by category        : ` + Object.entries(byCat).map(([k, v]) => `${k}: ${v}`).join(", "));
  console.log(`reg sample         : ${students.slice(0, 6).map((s) => s.regNo).join(", ")}`);
  console.log(`files written      : data/staff.csv, data/students.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
