import { describe, it, expect } from "vitest";
import { GET as healthGET } from "./health/route";
import { GET as announcementsGET } from "./announcements/route";
import { POST as verifyPOST } from "./verify/transcript/route";
import { POST as verifyResultPOST } from "./verify/result/route";
import { POST as verifyIdPOST } from "./verify/id/route";
import { GET as meGET } from "./me/route";

function req(url: string, init?: RequestInit): Request {
  return new Request(`http://localhost${url}`, init);
}

describe("API v1", () => {
  it("GET /api/v1/health reports ok", async () => {
    const res = await healthGET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json.version).toBe("v1");
    expect(json.checks.database).toBe(true);
  });

  it("GET /api/v1/announcements returns public announcements", async () => {
    const res = await announcementsGET(req("/api/v1/announcements"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.count).toBe(json.items.length);
  });

  it("POST /api/v1/verify/transcript validates reference format", async () => {
    const res = await verifyPOST(
      req("/api/v1/verify/transcript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referenceNo: "bogus" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/verify/transcript returns 404 for unknown reference", async () => {
    const res = await verifyPOST(
      req("/api/v1/verify/transcript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referenceNo: "TXN-2999-999999" }),
      }),
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.verified).toBe(false);
  });

  it("POST /api/v1/verify/transcript verifies an issued seeded transcript", async () => {
    const res = await verifyPOST(
      req("/api/v1/verify/transcript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referenceNo: "TXN-2026-000001" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
    expect(json.status).toBe("ISSUED");
    expect(json.graduate).toBeTruthy();
  });

  it("GET /api/v1/me requires a session", async () => {
    const res = await meGET(req("/api/v1/me"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthenticated");
  });

  it("POST /api/v1/verify/result validates reference format", async () => {
    const res = await verifyResultPOST(
      req("/api/v1/verify/result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referenceNo: "bogus" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/verify/result returns 404 for unknown reference", async () => {
    const res = await verifyResultPOST(
      req("/api/v1/verify/result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referenceNo: "RS-99/999XYZ/999-2025" }),
      }),
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.verified).toBe(false);
  });

  it("POST /api/v1/verify/result verifies a seeded result reference", async () => {
    const res = await verifyResultPOST(
      req("/api/v1/verify/result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referenceNo: "RS-12/345ABC/678-2025" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
    expect(json.graduate).toBeTruthy();
  });

  it("POST /api/v1/verify/result verifies by registration number", async () => {
    const res = await verifyResultPOST(
      req("/api/v1/verify/result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registrationNo: "12/345ABC/678", academicSession: "2025/2026" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
    expect(json.courseCount).toBeGreaterThan(0);
    expect(json.cgpa).toBeTruthy();
  });

  it("POST /api/v1/verify/id validates reference format", async () => {
    const res = await verifyIdPOST(
      req("/api/v1/verify/id", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qrRef: "bogus" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/verify/id verifies a seeded ID card", async () => {
    const res = await verifyIdPOST(
      req("/api/v1/verify/id", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qrRef: "UAID-STU-12/345ABC/678-01" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
    expect(json.kind).toBe("STUDENT");
    expect(json.holder).toBeTruthy();
  });
});
