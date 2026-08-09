import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { FloatingActions } from "@/components/floating-actions";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
      <FloatingActions />
    </>
  );
}
