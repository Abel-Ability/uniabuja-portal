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
  for (const sheet of ["Fac_Dept_All", "staff", "students"]) {
    const res = await fetch(gviz(sheet), { headers: { "User-Agent": "uniabuja-probe" } });
    const text = await res.text();
    const rows = parseCsv(text);
    console.log(`=== ${sheet} (${rows.length} rows) ===`);
    console.log("header:", JSON.stringify(rows[0]));
    console.log("row1:", JSON.stringify(rows[1]));
    console.log("row2:", JSON.stringify(rows[2]));
    if (sheet === "Fac_Dept_All") {
      const facs = [...new Set(rows.slice(1).map((r) => r[0]?.trim()).filter(Boolean))];
      console.log("faculties:", facs.length, JSON.stringify(facs));
      const nonTeach = rows.filter((r) => (r[0] || "").trim() === "Non-Teaching");
      console.log("non-teaching units:", nonTeach.length);
      console.log("sample NT:", JSON.stringify(nonTeach.slice(0, 5)));
    }
    if (sheet === "staff") {
      const roles = {};
      for (const r of rows.slice(1)) {
        const role = (r[11] || "").trim();
        roles[role] = (roles[role] || 0) + 1;
      }
      console.log("staff role counts:", JSON.stringify(roles));
      const withPhone = rows.slice(1).filter((r) => (r[14] || "").trim());
      console.log("staff rows w/ phone:", withPhone.length, "sample phones:", JSON.stringify(withPhone.slice(0, 5).map((r) => r[14])));
    }
    if (sheet === "students") {
      const cats = {};
      for (const r of rows.slice(1)) {
        const c = (r[13] || "").trim();
        cats[c] = (cats[c] || 0) + 1;
      }
      console.log("students category counts:", JSON.stringify(cats));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
