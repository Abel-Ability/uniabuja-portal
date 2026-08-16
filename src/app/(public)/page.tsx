import { prisma } from "@/lib/prisma";
import { getAcademicUnits, getCentres, getSheetDeadlines } from "@/lib/sheets";
import { Hero } from "@/components/hero";
import { NowWidget } from "@/components/now-widget";
import { SectionHeading, PillLink, Card } from "@/components/ui";
import { Reveal } from "@/components/reveal";

const MODULE_HIGHLIGHTS = [
  { title: "Admissions", desc: "UTME, Direct Entry, Postgraduate and Distance Learning applications with real-time tracking and JAMB CAPS sync.", icon: "🎓" },
  { title: "Fees & Payments", desc: "Remita, NIBSS/NIP transfers, cards and USSD with automated receipts and TSA reconciliation.", icon: "💳" },
  { title: "Results & Records", desc: "Senate-approved results, GPA/CGPA aligned to NUC standards, misconduct and appeal workflows.", icon: "📊" },
  { title: "Transcripts", desc: "Digitally-signed transcripts (KMS-held keys) with public verification by reference number.", icon: "📜" },
  { title: "E-Learning (LMS)", desc: "Moodle under SSO with auto-enrolment and grade passback.", icon: "💻" },
  { title: "Clearance & Graduation", desc: "Multi-department clearance, convocation, and automatic NYSC mobilisation handoff.", icon: "🎉" },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [
    academicUnits,
    centres,
    sheetDeadlines,
  ] = await Promise.all([
    getAcademicUnits(),
    getCentres(),
    getSheetDeadlines(),
  ]);

  const deadline =
    sheetDeadlines.find((d) => new Date(d.endsOn) >= new Date());

return (
    <>
      <Hero
        facultyCount={academicUnits.facultyCount}
        departmentCount={academicUnits.departmentCount}
        instituteCentreCount={centres.length}
        
      />
      <NowWidget />

      

    </>
  );
}
