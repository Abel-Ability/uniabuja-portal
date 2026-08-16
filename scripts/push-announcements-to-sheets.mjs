#!/usr/bin/env node
// Usage: node scripts/push-announcements-to-sheets.mjs <SERVICE_ACCOUNT_KEY.json> <SHEET_ID>
// Requires: npm install googleapis

import fs from "fs";
import { google } from "googleapis";

async function main() {
  const [,, keyPath, sheetId] = process.argv;
  if (!keyPath || !sheetId) {
    console.error("Usage: node scripts/push-announcements-to-sheets.mjs <SERVICE_ACCOUNT_KEY.json> <SHEET_ID>");
    process.exit(1);
  }

  if (!fs.existsSync(keyPath)) {
    console.error(`Key file not found: ${keyPath}`);
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const rows = [
    ["2026-08-03", "SUG Executives Pay Courtesy Visit to Vice‑Chancellor", "Newly elected SUG Executive Council, led by President Eyamu Oghenenyerovwo Peculiar, visited the Vice‑Chancellor to express thanks for a peaceful election and pledged to promote purposeful student leadership.", "/notices"],
    ["2026-08-03", "Veterinary Council of Nigeria Commences Accreditation Visit", "The Veterinary Council of Nigeria, led by Prof. Caleb Kudi, commenced an accreditation exercise at the Faculty of Veterinary Medicine and commended recent progress in facilities and training; the team exited on Thursday.", "/notices"],
    ["2026-08-04", "Vice‑Chancellor Strengthens Ties with Gwagwalada Area Council", "The Vice‑Chancellor visited the Chairman of Gwagwalada Area Council to discuss support for the Giri Staff Quarters solar streetlighting, land matters, admissions and other community issues.", "/notices"],
    ["2026-08-04", "University Moves to Renew Partnership with University of Münster", "A delegation led by Prof. Klaus Stierstorfer met the Vice‑Chancellor to review past collaborations and explore new academic cooperation opportunities.", "/notices"],
    ["2026-08-05", "University Visits Ministry of Foreign Affairs", "University Management held talks at the Federal Ministry of Foreign Affairs to strengthen institutional relations and explore international education and exchange opportunities, including a proposed ECOWAS Club pilot.", "/notices"],
    ["2026-08-05", "Golden Favour Presents Education Transformation Initiative", "Golden Favour Nigeria Ltd. presented the 'One Degree, One Skill, One Future' initiative aimed at boosting vocational and entrepreneurial skills; the University is open to exploring a pilot and funding framework.", "/notices"],
    ["2026-08-06", "Sierra Leone Delegation Visits for Energy Knowledge Exchange", "A Sierra Leone delegation led by Dr. Abdul Rahim Jalloh visited under the REA Country‑to‑Country programme and toured the University’s solar‑hybrid power plant.", "/notices"],
    ["2026-08-06", "University Seeks NITDA Support for Digital Transformation", "The Vice‑Chancellor met NITDA leadership to seek collaboration on digital transformation: labs, smart classrooms, cybersecurity, AI, cloud and innovation hubs.", "/notices"],
    ["2026-08-06", "University Seeks ASR Africa Support for Infrastructure", "The Vice‑Chancellor met ASR Africa to request support for priority infrastructure projects; ASR invited submission of project proposals for its Tertiary Education Grants Programme.", "/notices"],
    ["2026-08-07", "Thailand Ambassador Visits University", "His Excellency Thirapath Mongkolnavin visited the University and the Library team explored plans to establish a Thai Corner.", "/notices"],
  ];

  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Announcements!A:D",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
    const updates = res.data.updates || {};
    console.log(`Appended ${updates.updatedRows ?? rows.length} rows to Announcements!A:D`);
  } catch (err) {
    console.error("Failed to append rows:", err.message || err);
    process.exit(1);
  }
}

main();
