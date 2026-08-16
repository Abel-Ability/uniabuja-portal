import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { FloatingActions } from "@/components/floating-actions";
import { getSheetDeadlines } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sheetDeadlines = await getSheetDeadlines();
  const deadline =
    sheetDeadlines.find((d) => new Date(d.endsOn) >= new Date()) ?? null;

  return (
    <>
      <Header deadline={deadline} />
      <main id="main-content">{children}</main>
      <Footer />
      <FloatingActions />
    </>
  );
}
