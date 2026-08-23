import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ApplicationIframe } from "./application-iframe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Apply for Admission" };

export default async function Page() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Public Application"
        title="Apply for Admission"
        description="University of Abuja — 2026/27 Admission Exercise"
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <ApplicationIframe />
      </div>
    </div>
  );
}
