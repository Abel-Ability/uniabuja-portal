import { prisma } from "@/lib/prisma";
import { getAcademicUnits, getCentres, getSheetAnnouncements, getSheetDeadlines } from "@/lib/sheets";
import { Hero } from "@/components/hero";
import { NowWidget } from "@/components/now-widget";
import { SectionHeading, PillLink, Card } from "@/components/ui";
import { AnnouncementMarquee } from "@/components/announcements";
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
    sheetAnnouncements,
    academicUnits,
    centres,
    sheetDeadlines,
    dbAnnouncements,
    dbDeadline,
  ] = await Promise.all([
    getSheetAnnouncements(),
    getAcademicUnits(),
    getCentres(),
    getSheetDeadlines(),
    prisma.announcement.findMany({
      where: { scope: "PUBLIC" },
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
    prisma.academicCalendarEntry.findFirst({
      where: { published: true, scope: "PUBLIC", endsOn: { gte: new Date() } },
      orderBy: { startsOn: "asc" },
      select: { title: true, endsOn: true },
    }),
  ]);

  // Prefer Google Sheets; fall back to the database when a tab is absent/empty.
  const announcements = sheetAnnouncements.length > 0 ? sheetAnnouncements : dbAnnouncements;
  const deadline =
    sheetDeadlines.find((d) => new Date(d.endsOn) >= new Date()) ??
    (dbDeadline ? { title: dbDeadline.title, endsOn: dbDeadline.endsOn.toISOString() } : null);

  return (
    <>
      <Hero
        facultyCount={academicUnits.facultyCount}
        departmentCount={academicUnits.departmentCount}
        instituteCentreCount={centres.length}
        deadline={deadline}
      />
      <NowWidget />

      {/* Recent announcements */}
      <section className="bg-brand-strong px-4 pb-5 pt-2.5 text-white sm:px-6 sm:pb-6 sm:pt-3" aria-labelledby="announcements-heading">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading
              id="announcements-heading"
              title="Recent Announcements"
              className="mb-3"
              light
              action={
                <PillLink
                  href="/notices"
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white hover:text-slate"
                >
                  View all →
                </PillLink>
              }
            />
          </Reveal>
          <Reveal delay={100}>
            <AnnouncementMarquee items={announcements} />
          </Reveal>
        </div>
      </section>

      {/* Modules overview */}
      <section className="bg-white px-4 py-5 sm:px-6 sm:py-6" aria-labelledby="modules-heading">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading id="modules-heading" title="Everything in one portal" />
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_HIGHLIGHTS.map((m, i) => (
              <Reveal key={m.title} delay={i * 90}>
                <Card className="card-lift group flex h-full flex-col gap-1 !p-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="module-icon inline-block text-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110"
                    >
                      {m.icon}
                    </span>
                    <h3 className="font-head text-base font-bold text-slate">{m.title}</h3>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate/70">{m.desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
