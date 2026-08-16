import type { Metadata } from "next";
import { PageHeader, Card } from "@/components/ui";
import { VerifyForm } from "./verify-form";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Verify Results & Transcripts" };

export default function VerifyPage() {
  return (
    <div className="bg-white dark:bg-slate-900">
      <PageHeader
        eyebrow="Public verification"
        title="Verify Results & Transcripts"
        description="Employers, institutions and third parties can confirm the authenticity of an issued transcript using its reference number. Only public verification data is shown."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <Reveal>
          <Card>
            <p className="mb-4 text-sm text-slate/75">
              Enter the reference number printed on the transcript (or in the
              confirmation email). A successful check confirms the record was
              issued by the University of Abuja and carries the issued date.
            </p>
            <VerifyForm />
          </Card>
        </Reveal>
        <Reveal delay={150}>
          <p className="mt-6 text-xs text-slate/70">
            Every verification attempt is logged in the tamper-evident audit
            trail. Digitally-signed transcripts are additionally verifiable
            against the university&apos;s public key.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
