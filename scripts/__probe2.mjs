const SPREADSHEET_ID = "1cu9Wm1fN8f-cKeDj5LEeSFGxQsF9Z7IAjsBZpF4Pvz8";
const gviz = (sheet) =>
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

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

async function main() {
  const facDept = parseCsv(await (await fetch(gviz("Fac_Dept_All"))).text());
  const staff = parseCsv(await (await fetch(gviz("staff"))).text());

  const units = facDept
    .filter((r) => r.length >= 3 && (r[0] || "").trim() !== "Faculty")
    .map((r) => ({
      faculty: r[0].trim(),
      department: r[1].trim(),
      code: r[2].trim(),
    }))
    .filter((u) => u.faculty && u.department && u.code);

  const academicUnits = units.filter((u) => u.faculty !== "Non-Teaching");
  console.log("academic units:", academicUnits.length);

  // department-code suffix uniqueness within each faculty
  const collisions = [];
  for (const f of [...new Set(academicUnits.map((u) => u.faculty))]) {
    const seen = new Map();
    for (const u of academicUnits.filter((x) => x.faculty === f)) {
      const part = u.code.replace(/[^A-Z0-9]/g, "").slice(-3).toUpperCase();
      if (seen.has(part)) collisions.push(`${f}: ${seen.get(part)} vs ${u.code}`);
      seen.set(part, u.code);
    }
  }
  console.log("dept-code collisions:", collisions.length === 0 ? "none" : collisions.join("; "));

  // staff tab faculty strings
  const staffFaculties = [...new Set(staff.slice(1).map((r) => (r[8] || "").trim()).filter(Boolean))];
  console.log("staff tab faculties:", JSON.stringify(staffFaculties));

  // map each academic department to the staff-tab faculty string
  const mismatch = [];
  for (const u of academicUnits) {
    const staffRow = staff.slice(1).find((r) => (r[9] || "").trim() === u.department);
    if (staffRow && (staffRow[8] || "").trim() !== u.faculty) {
      mismatch.push(`${u.department}: FacDept="${u.faculty}" vs staffTab="${staffRow[8]}"`);
    }
  }
  console.log("faculty mismatches:", mismatch.length === 0 ? "none" : mismatch.join("\n  "));

  // departments in Fac_Dept_All not in staff tab
  const staffDepts = new Set(staff.slice(1).map((r) => (r[9] || "").trim()));
  const missing = academicUnits.filter((u) => !staffDepts.has(u.department));
  console.log("academic depts missing from staff tab:", missing.length);
  if (missing.length) console.log(JSON.stringify(missing.map((u) => u.department)));

  // staff tab depts not academic (non-teaching units)
  const nonAcad = staff.slice(1).filter((r) => (r[8] || "").trim() === "Non-Teaching");
  console.log("staff tab non-teaching rows:", nonAcad.length);

  const byRole = {};
  for (const r of staff.slice(1)) {
    const role = (r[10] || "").trim().toUpperCase();
    byRole[role] = (byRole[role] || 0) + 1;
  }
  console.log("staff role col counts:", JSON.stringify(byRole));

  // academic depts not having an HOD row
  const hods = new Set(staff.slice(1).filter((r) => (r[10] || "").trim().toUpperCase() === "HOD").map((r) => (r[9] || "").trim()));
  const noHod = academicUnits.filter((u) => !hods.has(u.department));
  console.log("academic depts without HOD row:", noHod.length, JSON.stringify(noHod.map((u) => u.department)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
